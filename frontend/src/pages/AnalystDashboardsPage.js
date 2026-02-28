/**
 * Dashboard Manager (Analyst)
 *
 * - Current Dashboards: one small card per role (student, staff, dean, etc.), showing
 *   which dashboard is currently deployed for that role.
 * - Custom Dashboards: all other dashboards that can be edited / previewed / swapped in.
 *
 * Swaps are handled by /api/dashboard-manager/swap and immediately reflected in both sections.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/modal';
import { RefreshCw, Filter as FilterIcon, LayoutGrid, List, Loader2, Trash2, XCircle } from 'lucide-react';

const KPI_OPTIONS = [
  'total_students',
  'avg_grade',
  'failed_exams',
  'missed_exams',
  'avg_attendance',
  'retention_rate',
  'graduation_rate',
];

const CHART_OPTIONS = [
  'student_distribution',
  'grades_over_time',
  'payment_status',
  'grade_distribution',
  'top_students',
  'payment_trends',
  'attendance_trends',
];

const ROLE_FILTER_OPTIONS = [
  'student',
  'staff',
  'analyst',
  'sysadmin',
  'dean',
  'hod',
  'finance',
  'hr',
  'senate',
];

const ALL_ROLES = [
  'student',
  'staff',
  'hod',
  'dean',
  'senate',
  'finance',
  'hr',
  'analyst',
  'sysadmin',
];

const AnalystDashboardsPage = () => {
  const { user } = useAuth();
  const [currentByRole, setCurrentByRole] = useState([]);
  const [customDashboards, setCustomDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('');
  const [search, setSearch] = useState('');
  const [createdByFilter, setCreatedByFilter] = useState('all'); // all | me
  const [viewMode, setViewMode] = useState('grid'); // grid | list (grid is primary)

  const [swapConfirm, setSwapConfirm] = useState({ open: false, dash: null, targetRole: '' });
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, dash: null });
  const [messageModal, setMessageModal] = useState({ open: false, message: '' });
  const [removingRole, setRemovingRole] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [contentDashboard, setContentDashboard] = useState(null);
  const [previewDashboard, setPreviewDashboard] = useState(null);
  const [contentForm, setContentForm] = useState({
    kpis: ['total_students', 'avg_grade', 'failed_exams'],
    charts: ['student_distribution', 'grades_over_time'],
  });
  const [savingContent, setSavingContent] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    roles: ['analyst'],
  });

  const canManage = (user?.role || '').toString().toLowerCase() === 'analyst';

  const normalizeRole = (role) => (role || '').toString().toLowerCase();

  const isKpiAllowedForRole = (kpiKey, targetRole) => {
    const r = normalizeRole(targetRole);
    if (r === 'finance') return false;
    if (r === 'student') {
      return ['avg_grade', 'failed_exams', 'missed_exams', 'avg_attendance'].includes(kpiKey);
    }
    return KPI_OPTIONS.includes(kpiKey);
  };

  const isChartAllowedForRole = (chartKey, targetRole) => {
    const r = normalizeRole(targetRole);
    if (chartKey === 'student_distribution') {
      return ['senate', 'dean', 'hod', 'staff', 'analyst'].includes(r);
    }
    if (chartKey === 'grades_over_time') {
      return r !== 'finance';
    }
    if (chartKey === 'payment_status') {
      return ['dean', 'hod', 'student', 'finance', 'senate'].includes(r);
    }
    if (chartKey === 'grade_distribution') {
      return r !== 'finance';
    }
    if (chartKey === 'top_students') {
      return ['senate', 'dean', 'hod', 'staff'].includes(r);
    }
    if (chartKey === 'payment_trends') {
      return r === 'finance' || r === 'senate';
    }
    if (chartKey === 'attendance_trends') {
      return r !== 'finance';
    }
    return true;
  };

  const labelForKpi = (key) => {
    switch (key) {
      case 'total_students':
        return 'Total Students';
      case 'avg_grade':
        return 'Average Grade';
      case 'failed_exams':
        return 'Failed Exams';
      case 'missed_exams':
        return 'Missed Exams';
      case 'avg_attendance':
        return 'Average Attendance';
      case 'retention_rate':
        return 'Retention Rate';
      case 'graduation_rate':
        return 'Graduation Rate';
      default:
        return key.replace(/_/g, ' ');
    }
  };

  const labelForChart = (key) => {
    switch (key) {
      case 'student_distribution':
        return 'Student Distribution by Department';
      case 'grades_over_time':
        return 'Trend Analysis of Grades Over Time';
      case 'payment_status':
        return 'Payment Status';
      case 'grade_distribution':
        return 'Grade Distribution';
      case 'top_students':
        return 'Top 10 Students';
      case 'payment_trends':
        return 'Payment Trends Over Time';
      case 'attendance_trends':
        return 'Attendance Trends';
      default:
        return key.replace(/_/g, ' ');
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const params = {};
      if (filterRole) params.role = filterRole;
      if (createdByFilter === 'me') params.created_by = 'me';

      const [currentResp, customResp] = await Promise.all([
        axios.get('/api/dashboard-manager/current', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get('/api/dashboard-manager/custom', {
          headers: { Authorization: `Bearer ${token}` },
          params,
        }),
      ]);

      // Ensure we always have the 9 roles, even if backend missed some
      const current = currentResp.data?.roles || [];
      const byRole = {};
      current.forEach((item) => {
        byRole[normalizeRole(item.role)] = item;
      });
      const merged = ALL_ROLES.map((r) => byRole[r] || { role: r, dashboard: null });

      setCurrentByRole(merged);
      setCustomDashboards(customResp.data?.dashboards || []);
    } catch (err) {
      console.error('Error loading dashboard manager data:', err);
      setCurrentByRole([]);
      setCustomDashboards([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterRole, createdByFilter]);

  // Filtering helpers
  const matchesSearch = (text) => {
    if (!search.trim()) return true;
    const s = search.trim().toLowerCase();
    return (text || '').toString().toLowerCase().includes(s);
  };

  const filteredCurrent = currentByRole.filter((entry) => {
    if (filterRole && normalizeRole(entry.role) !== filterRole) return false;
    const dash = entry.dashboard;
    if (!dash) return matchesSearch(entry.role);
    return (
      matchesSearch(dash.name) ||
      matchesSearch(dash.description) ||
      matchesSearch(dash.created_by_username) ||
      matchesSearch(entry.role)
    );
  });

  const filteredCustom = customDashboards.filter((dash) => {
    if (filterRole) {
      const roles = Array.isArray(dash.roles) ? dash.roles.map(normalizeRole) : [];
      if (!roles.includes(filterRole)) return false;
    }
    return (
      matchesSearch(dash.name) ||
      matchesSearch(dash.description) ||
      matchesSearch(dash.created_by_username)
    );
  });

  const parseDefinition = (dash) => {
    let def = dash.definition;
    try {
      if (typeof def === 'string') {
        def = JSON.parse(def);
      }
    } catch {
      def = {};
    }
    return def && typeof def === 'object' ? def : {};
  };

  const openContentEditor = (dash, previewOnly = false) => {
    const def = parseDefinition(dash);
    const kpis =
      def && Array.isArray(def.kpis) && def.kpis.length > 0
        ? def.kpis
        : KPI_OPTIONS;
    const charts =
      def && Array.isArray(def.charts) && def.charts.length > 0
        ? def.charts
        : CHART_OPTIONS;
    setContentDashboard({ ...dash, previewOnly });
    setContentForm({ kpis, charts });
  };

  const handleSwapFromCustom = (dash) => {
    const roles = Array.isArray(dash.roles) ? dash.roles.map(normalizeRole) : [];
    const targetRole = filterRole || roles[0] || 'analyst';
    if (!targetRole) {
      setMessageModal({ open: true, message: 'Select a role filter or assign at least one role to this dashboard first.' });
      return;
    }
    setSwapConfirm({ open: true, dash, targetRole });
  };

  const handleSwapConfirm = async () => {
    const { dash, targetRole } = swapConfirm;
    if (!dash) return;
    setSwapConfirm((prev) => ({ ...prev, open: false }));
    try {
      await axios.post(
        '/api/dashboard-manager/swap',
        { role: targetRole, dashboard_id: dash.id },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      await loadData();
    } catch (err) {
      console.error('Error swapping dashboard:', err);
      const msg = err?.response?.data?.error || err?.message || 'Unknown error while swapping dashboard.';
      setMessageModal({ open: true, message: `Failed to swap dashboard: ${msg}` });
    }
  };

  const getRolesWhereCurrent = (dashboardId) => {
    if (!dashboardId) return [];
    return currentByRole
      .filter((e) => e.dashboard && e.dashboard.id === dashboardId)
      .map((e) => e.role);
  };

  const handleRemoveCurrent = async (role) => {
    setRemovingRole(role);
    try {
      await axios.post(
        '/api/dashboard-manager/remove-current',
        { role },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      await loadData();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to remove current dashboard.';
      setMessageModal({ open: true, message: msg });
    } finally {
      setRemovingRole(null);
    }
  };

  const handleDeleteCustom = (dash) => {
    const rolesUsing = getRolesWhereCurrent(dash.id);
    if (rolesUsing.length > 0) {
      setMessageModal({
        open: true,
        message: `Cannot delete: this dashboard is the current dashboard for role(s): ${rolesUsing.join(', ')}. Remove it from current dashboard for those roles first.`,
      });
      return;
    }
    setDeleteConfirm({ open: true, dash });
  };

  const handleDeleteConfirm = async () => {
    const { dash } = deleteConfirm;
    if (!dash) return;
    setDeleteConfirm((prev) => ({ ...prev, open: false }));
    setDeletingId(dash.id);
    try {
      await axios.delete(`/api/dashboards/${dash.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      await loadData();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to delete dashboard.';
      setMessageModal({ open: true, message: msg });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveContent = async () => {
    if (!contentDashboard) return;
    try {
      setSavingContent(true);
      const roles = Array.isArray(contentDashboard.roles)
        ? contentDashboard.roles
        : [];
      await axios.put(
        `/api/dashboards/${contentDashboard.id}`,
        {
          name: contentDashboard.name,
          description: contentDashboard.description,
          roles,
          definition: {
            template: 'analytics_dashboard',
            source: 'analyst_dashboard',
            kpis: contentForm.kpis,
            charts: contentForm.charts,
          },
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );
      setContentDashboard(null);
      await loadData();
    } catch (err) {
      console.error('Error updating dashboard content:', err);
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        'Unknown error while updating dashboard content.';
      setMessageModal({ open: true, message: `Failed to update content: ${msg}` });
    } finally {
      setSavingContent(false);
    }
  };

  const handleCreateDashboard = async () => {
    try {
      const roles = createForm.roles;
      const primaryRole = roles[0] || 'analyst';
      const defaultKpis = KPI_OPTIONS.filter((k) =>
        isKpiAllowedForRole(k, primaryRole)
      );
      const defaultCharts = CHART_OPTIONS.filter((c) =>
        isChartAllowedForRole(c, primaryRole)
      );

      await axios.post(
        '/api/dashboards',
        {
          name: createForm.name.trim(),
          description: createForm.description.trim(),
          roles,
          definition: {
            template: 'analytics_dashboard',
            source: 'analyst_dashboard',
            kpis: defaultKpis,
            charts: defaultCharts,
          },
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );
      setShowCreate(false);
      await loadData();
    } catch (err) {
      console.error('Error creating dashboard:', err);
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        'Unknown error while creating dashboard.';
      setMessageModal({ open: true, message: `Failed to create dashboard: ${msg}` });
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard Manager"
        subtitle="Review and manage dashboards across roles. Analysts can preview, edit content, and swap current dashboards per role."
        actions={
          <div className="flex items-center gap-2">
            {canManage && (
              <Button
                size="sm"
                className="gap-2"
                onClick={() => {
                  setCreateForm({
                    name: '',
                    description: '',
                    roles: ['analyst'],
                  });
                  setShowCreate(true);
                }}
              >
                + Add dashboard
              </Button>
            )}
            <Button
              size="sm"
              className="gap-2"
              onClick={loadData}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Global filters + view toggle */}
      <Card className="border shadow-sm">
        <CardHeader className="p-4 pb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">Filters</CardTitle>
            <CardDescription className="text-xs">
              Filter by role, creator, or name to quickly find dashboards.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <FilterIcon className="h-4 w-4 text-muted-foreground" />
              <select
                className="border rounded-md px-2 py-1 text-xs bg-background"
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
              >
                <option value="">All roles</option>
                {ROLE_FILTER_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
              <select
                className="border rounded-md px-2 py-1 text-xs bg-background"
                value={createdByFilter}
                onChange={(e) => setCreatedByFilter(e.target.value)}
              >
                <option value="all">Created by: All</option>
                <option value="me">Created by: Me</option>
              </select>
            </div>
            <Input
              placeholder="Search dashboards..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-xs w-full sm:w-56"
            />
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                className="h-8 w-8"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant={viewMode === 'list' ? 'default' : 'outline'}
                className="h-8 w-8"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Current Dashboards */}
      <Card className="border shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-semibold">Current Dashboards</CardTitle>
          <CardDescription className="text-xs">
            One card per role showing the dashboard currently deployed. Use Custom Dashboards to swap.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading current dashboards…
            </div>
          ) : (
            <div
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'
                  : 'space-y-2'
              }
            >
              {filteredCurrent.map((entry) => {
                const rname = entry.role;
                const dash = entry.dashboard;
                return (
                  <div
                    key={rname}
                    className="border rounded-md px-3 py-2 flex flex-col justify-between text-[11px] min-h-[110px]"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                          {rname}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Current
                        </span>
                      </div>
                      <div className="font-semibold text-xs">
                        {dash ? dash.name : 'No current dashboard assigned'}
                      </div>
                      {dash && dash.description && (
                        <div className="text-muted-foreground line-clamp-2">
                          {dash.description}
                        </div>
                      )}
                      {dash && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground">
                            Created by{' '}
                            <span className="font-medium">{dash.created_by_username}</span>
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Roles:{' '}
                            {Array.isArray(dash.roles) && dash.roles.length > 0
                              ? dash.roles.join(', ')
                              : 'None'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 mt-2">
                      {dash ? (
                        <>
                          <Button
                            size="xs"
                            variant="outline"
                            className="h-6 px-2 text-[10px]"
                            onClick={() =>
                              setPreviewDashboard((prev) =>
                                prev && prev.id === dash.id ? null : dash
                              )
                            }
                          >
                            {previewDashboard && previewDashboard.id === dash.id
                              ? 'Hide'
                              : 'Preview'}
                          </Button>
                          {canManage && (
                            <>
                              <Button
                                size="xs"
                                variant="outline"
                                className="h-6 px-2 text-[10px]"
                                onClick={() => openContentEditor(dash, false)}
                              >
                                Edit content
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                className="h-6 px-2 text-[10px] text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => handleRemoveCurrent(rname)}
                                disabled={!!removingRole}
                              >
                                {removingRole === rname ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                                <span className="ml-0.5">Remove current</span>
                              </Button>
                            </>
                          )}
                        </>
                      ) : (
                        canManage && (
                          <span className="text-[10px] text-muted-foreground">
                            Use a Custom dashboard and &quot;Make current&quot; to assign one.
                          </span>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Dashboards */}
      <Card className="border shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-semibold">Custom Dashboards</CardTitle>
          <CardDescription className="text-xs">
            Dashboards available for assignment or swap. Preview and tweak content before making them current.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading custom dashboards…
            </div>
          ) : filteredCustom.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
              No custom dashboards found for the current filters.
            </div>
          ) : (
            <div
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'
                  : 'space-y-2'
              }
            >
              {filteredCustom.map((dash) => {
                const roles = Array.isArray(dash.roles) ? dash.roles : [];
                return (
                  <div
                    key={dash.id}
                    className="border rounded-md px-3 py-2 flex flex-col justify-between text-[11px] min-h-[110px]"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                          Custom
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-700 border border-slate-200">
                          Draft
                        </span>
                      </div>
                      <div className="font-semibold text-xs">{dash.name}</div>
                      {dash.description && (
                        <div className="text-muted-foreground line-clamp-2">
                          {dash.description}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">
                          Created by{' '}
                          <span className="font-medium">{dash.created_by_username}</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Roles: {roles.length > 0 ? roles.join(', ') : 'None'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 mt-2">
                      <Button
                        size="xs"
                        variant="outline"
                        className="h-6 px-2 text-[10px]"
                        onClick={() =>
                          setPreviewDashboard((prev) =>
                            prev && prev.id === dash.id ? null : dash
                          )
                        }
                      >
                        {previewDashboard && previewDashboard.id === dash.id
                          ? 'Hide'
                          : 'Preview'}
                      </Button>
                      {canManage && (
                        <>
                          <Button
                            size="xs"
                            variant="outline"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => openContentEditor(dash, false)}
                          >
                            Edit content
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => handleSwapFromCustom(dash)}
                          >
                            Make current
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            className="h-6 px-2 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteCustom(dash)}
                            disabled={!!deletingId}
                          >
                            {deletingId === dash.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            <span className="ml-0.5">Delete</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full preview below Custom Dashboards – behaves like Open/Hide */}
      {previewDashboard && (
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2">
            {(() => {
              const dash = previewDashboard;
              const def = parseDefinition(dash);
              const kpis =
                Array.isArray(def.kpis) && def.kpis.length > 0
                  ? def.kpis
                  : KPI_OPTIONS;
              const charts =
                Array.isArray(def.charts) && def.charts.length > 0
                  ? def.charts
                  : CHART_OPTIONS;
              return (
                <>
                  <CardTitle className="text-base font-semibold">
                    {dash.name || 'Custom Dashboard'}
                  </CardTitle>
                  {dash.description && (
                    <CardDescription className="text-xs">
                      {dash.description}
                    </CardDescription>
                  )}
                  <CardContent className="mt-3 px-0 pb-4 space-y-3">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        KPIs
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {kpis.map((k) => (
                          <div
                            key={k}
                            className="rounded-md border px-2 py-2 text-[11px] bg-muted/40"
                          >
                            {labelForKpi(k)}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Charts
                      </p>
                      <div className="space-y-2">
                        {charts.map((c) => (
                          <div
                            key={c}
                            className="rounded-md border px-3 py-3 text-[11px] bg-muted/20"
                          >
                            {labelForChart(c)} (chart area)
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </>
              );
            })()}
          </CardHeader>
        </Card>
      )}

      {/* Content editor / preview modal */}
      {contentDashboard && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md border">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {contentDashboard.previewOnly ? 'Preview Dashboard Content' : 'Edit Dashboard Content'}
              </h2>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setContentDashboard(null)}
              >
                Close
              </button>
            </div>
            <div className="px-4 py-3 space-y-3 text-xs">
              <div>
                <div className="font-semibold text-[11px] mb-1">
                  {contentDashboard.name || 'Untitled dashboard'}
                </div>
                {contentDashboard.description && (
                  <div className="text-[11px] text-muted-foreground">
                    {contentDashboard.description}
                  </div>
                )}
              </div>
              {(() => {
                const firstRole =
                  filterRole ||
                  (Array.isArray(contentDashboard.roles) && contentDashboard.roles[0]) ||
                  'analyst';
                const allowedKpis = KPI_OPTIONS.filter((k) =>
                  isKpiAllowedForRole(k, firstRole)
                );
                const allowedCharts = CHART_OPTIONS.filter((c) =>
                  isChartAllowedForRole(c, firstRole)
                );
                return (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs font-medium">
                        KPIs to show{' '}
                        <span className="text-[10px] text-muted-foreground">
                          (filtered for role {firstRole})
                        </span>
                      </p>
                      <div className="grid grid-cols-2 gap-1">
                        {allowedKpis.map((key) => (
                          <label
                            key={key}
                            className="flex items-center gap-1 text-[11px] cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              className="h-3 w-3"
                              disabled={contentDashboard.previewOnly}
                              checked={contentForm.kpis.includes(key)}
                              onChange={(e) => {
                                if (contentDashboard.previewOnly) return;
                                const checkedNow = e.target.checked;
                                setContentForm((prev) => {
                                  const setVals = new Set(prev.kpis);
                                  if (checkedNow) {
                                    setVals.add(key);
                                  } else {
                                    setVals.delete(key);
                                  }
                                  return { ...prev, kpis: Array.from(setVals) };
                                });
                              }}
                            />
                            <span>{labelForKpi(key)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium">
                        Charts to show{' '}
                        <span className="text-[10px] text-muted-foreground">
                          (RBAC charts for role {firstRole})
                        </span>
                      </p>
                      <div className="grid grid-cols-2 gap-1">
                        {allowedCharts.map((key) => (
                          <label
                            key={key}
                            className="flex items-center gap-1 text-[11px] cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              className="h-3 w-3"
                              disabled={contentDashboard.previewOnly}
                              checked={contentForm.charts.includes(key)}
                              onChange={(e) => {
                                if (contentDashboard.previewOnly) return;
                                const checkedNow = e.target.checked;
                                setContentForm((prev) => {
                                  const setVals = new Set(prev.charts);
                                  if (checkedNow) {
                                    setVals.add(key);
                                  } else {
                                    setVals.delete(key);
                                  }
                                  return { ...prev, charts: Array.from(setVals) };
                                });
                              }}
                            />
                            <span>{labelForChart(key)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {/* Simple visual preview of layout */}
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium">Preview layout</p>
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">
                          KPIs
                        </p>
                        <div className="grid grid-cols-2 gap-1">
                          {contentForm.kpis
                            .filter((k) => allowedKpis.includes(k))
                            .map((k) => (
                              <div
                                key={k}
                                className="rounded-md border px-2 py-1.5 text-[11px] bg-muted/40"
                              >
                                {labelForKpi(k)}
                              </div>
                            ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">
                          Charts
                        </p>
                        <div className="space-y-1">
                          {contentForm.charts
                            .filter((c) => allowedCharts.includes(c))
                            .map((c) => (
                              <div
                                key={c}
                                className="rounded-md border px-2 py-2 text-[11px] bg-muted/20"
                              >
                                {labelForChart(c)} (chart area)
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
            {!contentDashboard.previewOnly && (
              <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setContentDashboard(null)}
                  disabled={savingContent}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="gap-2"
                  disabled={
                    savingContent ||
                    (contentForm.kpis.length === 0 && contentForm.charts.length === 0)
                  }
                  onClick={handleSaveContent}
                >
                  {savingContent && <Loader2 className="h-3 w-3 animate-spin" />}
                  Save content
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add dashboard modal */}
      {showCreate && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md border">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold">Add Dashboard</h2>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowCreate(false)}
              >
                Close
              </button>
            </div>
            <div className="px-4 py-3 space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="create-name">
                  Dashboard name *
                </label>
                <Input
                  id="create-name"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="h-8 text-xs"
                  placeholder="e.g. Tuition, Students Distribution in the faculty"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="create-description">
                  Description
                </label>
                <textarea
                  id="create-description"
                  className="w-full rounded-md border px-2 py-1.5 text-xs bg-background min-h-[60px]"
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Short description for this dashboard."
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium">Assign to roles *</p>
                <div className="grid grid-cols-2 gap-1">
                  {ROLE_FILTER_OPTIONS.map((r) => {
                    const checked = createForm.roles.includes(r);
                    return (
                      <label
                        key={r}
                        className="flex items-center gap-1 text-[11px] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="h-3 w-3"
                          checked={checked}
                          onChange={(e) => {
                            const checkedNow = e.target.checked;
                            setCreateForm((prev) => {
                              const setVals = new Set(prev.roles);
                              if (checkedNow) {
                                setVals.add(r);
                              } else {
                                setVals.delete(r);
                              }
                              return { ...prev, roles: Array.from(setVals) };
                            });
                          }}
                        />
                        <span>{r.charAt(0).toUpperCase() + r.slice(1)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="gap-2"
                disabled={!createForm.name.trim() || createForm.roles.length === 0}
                onClick={handleCreateDashboard}
              >
                Create dashboard
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Swap confirmation modal */}
      <Modal open={swapConfirm.open} onClose={() => setSwapConfirm((p) => ({ ...p, open: false }))} maxWidth="max-w-md">
        <ModalHeader
          title="Confirm dashboard swap"
          onClose={() => setSwapConfirm((p) => ({ ...p, open: false }))}
        />
        <ModalBody>
          <p className="text-sm text-muted-foreground">
            Swap current dashboard for role <strong className="text-foreground">{swapConfirm.targetRole}</strong> with
            &quot;<strong className="text-foreground">{swapConfirm.dash?.name}</strong>&quot;?
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setSwapConfirm((p) => ({ ...p, open: false }))}>
            Cancel
          </Button>
          <Button onClick={handleSwapConfirm}>
            Confirm swap
          </Button>
        </ModalFooter>
      </Modal>

      {/* Message / error modal */}
      <Modal open={messageModal.open} onClose={() => setMessageModal((p) => ({ ...p, open: false }))} maxWidth="max-w-md">
        <ModalHeader
          title="Notice"
          onClose={() => setMessageModal((p) => ({ ...p, open: false }))}
        />
        <ModalBody>
          <p className="text-sm text-muted-foreground">{messageModal.message}</p>
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => setMessageModal((p) => ({ ...p, open: false }))}>OK</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default AnalystDashboardsPage;

