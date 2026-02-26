/**
 * Analyst Dashboards Management
 * - Analysts can see ALL dashboards in the system (scope=all)
 * - Edit assignments (roles) and the dashboard content (KPIs & charts)
 * - Other roles will still use their own dashboards views (if wired later)
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { RefreshCw, Filter as FilterIcon, Loader2 } from 'lucide-react';

// Base KPI keys used across dashboards; actual visibility is filtered per role.
const KPI_OPTIONS = [
  'total_students',
  'avg_grade',
  'failed_exams',
  'missed_exams',
  'avg_attendance',
  'retention_rate',
  'graduation_rate',
];

// RBAC-aware chart identifiers, aligned with RoleBasedCharts:
// - student_distribution: Student Distribution by Department
// - grades_over_time: Trend Analysis of Grades Over Time
// - payment_status: Payment Status / My Payment Status
// - grade_distribution: Grade Distribution
// - top_students: Top 10 Students
// - payment_trends: Payment Trends Over Time
// - attendance_trends: Attendance Trends
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

const AnalystDashboardsPage = () => {
  const { user } = useAuth();
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editRoles, setEditRoles] = useState([]);
  const [savingId, setSavingId] = useState(null);
  const [contentDashboard, setContentDashboard] = useState(null);
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
    if (r === 'finance') {
      // Finance focuses on payment charts; keep KPIs minimal for now
      return false;
    }
    if (r === 'student') {
      return ['avg_grade', 'failed_exams', 'missed_exams', 'avg_attendance'].includes(kpiKey);
    }
    // Dean / HOD / Senate / Staff / Analyst see full academic KPIs, scoped by their faculty/department/institution
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

  const loadAllDashboards = async () => {
    try {
      setLoading(true);
      const resp = await axios.get('/api/dashboards', {
        params: { scope: 'all' },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setDashboards(resp.data?.dashboards || []);
    } catch (err) {
      console.error('Error loading dashboards (scope=all):', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllDashboards();
  }, []);

  const filtered = dashboards.filter((d) => {
    const matchesRole =
      !filterRole ||
      (Array.isArray(d.roles) && d.roles.map((r) => (r || '').toLowerCase()).includes(filterRole));
    const s = search.trim().toLowerCase();
    const matchesSearch =
      !s ||
      (d.name || '').toLowerCase().includes(s) ||
      (d.description || '').toLowerCase().includes(s) ||
      (d.created_by_username || '').toLowerCase().includes(s);
    return matchesRole && matchesSearch;
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboards Manager"
        subtitle="Review and manage all dashboards across roles. Analysts can adjust role access and content."
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
              onClick={loadAllDashboards}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      />

      <Card className="border shadow-sm">
        <CardHeader className="p-4 pb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">All Dashboards</CardTitle>
            <CardDescription className="text-xs">
              Filter by role or search by name/creator to quickly find dashboards.
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
            </div>
            <Input
              placeholder="Search dashboards..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-xs w-full sm:w-56"
            />
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading dashboards…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
              No dashboards found for the current filter.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((dash) => {
                const isEditing = editingId === dash.id;
                const roles = Array.isArray(dash.roles) ? dash.roles : [];
                const editableRoles = isEditing ? editRoles : roles;

                return (
                  <div
                    key={dash.id}
                    className="border rounded-md px-3 py-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[11px]"
                  >
                    <div className="space-y-1">
                      <div className="font-semibold text-xs">{dash.name}</div>
                      {dash.description && (
                        <div className="text-muted-foreground line-clamp-2">{dash.description}</div>
                      )}
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">
                          Created by <span className="font-medium">{dash.created_by_username}</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Roles:{' '}
                          {editableRoles.length > 0 ? editableRoles.join(', ') : 'None'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {canManage && (
                        <>
                          {isEditing ? (
                            <>
                              <select
                                multiple
                                className="border rounded-md px-1 py-1 text-[10px] bg-background min-w-[120px] max-h-20"
                                value={editableRoles}
                                onChange={(e) => {
                                  const opts = Array.from(e.target.selectedOptions).map((o) =>
                                    (o.value || '').toLowerCase()
                                  );
                                  setEditRoles(opts);
                                }}
                              >
                                {ROLE_FILTER_OPTIONS.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                              <Button
                                size="xs"
                                className="h-6 px-2 text-[10px]"
                                disabled={savingId === dash.id}
                                onClick={async () => {
                                  try {
                                    setSavingId(dash.id);
                                    await axios.put(
                                      `/api/dashboards/${dash.id}`,
                                      {
                                        name: dash.name,
                                        description: dash.description,
                                        definition: dash.definition || {},
                                        roles: editableRoles,
                                      },
                                      {
                                        headers: {
                                          Authorization: `Bearer ${localStorage.getItem('token')}`,
                                        },
                                      }
                                    );
                                    setEditingId(null);
                                    setEditRoles([]);
                                    await loadAllDashboards();
                                  } catch (err) {
                                    console.error('Error updating dashboard roles:', err);
                                    const msg =
                                      err?.response?.data?.error ||
                                      err?.message ||
                                      'Unknown error while updating dashboard.';
                                    // eslint-disable-next-line no-alert
                                    alert(`Failed to update dashboard: ${msg}`);
                                  } finally {
                                    setSavingId(null);
                                  }
                                }}
                              >
                                {savingId === dash.id ? 'Saving…' : 'Save'}
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                className="h-6 px-2 text-[10px]"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditRoles([]);
                                }}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="xs"
                                variant="outline"
                                className="h-6 px-2 text-[10px]"
                                onClick={() => {
                                  setEditingId(dash.id);
                                  setEditRoles(roles.map((r) => (r || '').toLowerCase()));
                                }}
                              >
                                Edit roles
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                className="h-6 px-2 text-[10px]"
                                onClick={() => {
                                  let def = {};
                                  try {
                                    if (typeof dash.definition === 'string') {
                                      def = JSON.parse(dash.definition);
                                    } else if (dash.definition && typeof dash.definition === 'object') {
                                      def = dash.definition;
                                    }
                                  } catch {
                                    def = {};
                                  }
                                  const kpis =
                                    Array.isArray(def.kpis) && def.kpis.length > 0
                                      ? def.kpis
                                      : ['total_students', 'avg_grade', 'failed_exams'];
                                  const charts =
                                    Array.isArray(def.charts) && def.charts.length > 0
                                      ? def.charts
                                      : ['fex'];
                                  setContentDashboard(dash);
                                  setContentForm({ kpis, charts });
                                }}
                              >
                                Edit content
                              </Button>
                            </>
                          )}
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
      {contentDashboard && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md border">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold">Edit Dashboard Content</h2>
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
                const targetRole =
                  filterRole ||
                  (Array.isArray(contentDashboard.roles) && contentDashboard.roles[0]) ||
                  'analyst';
                const allowedKpis = KPI_OPTIONS.filter((k) => isKpiAllowedForRole(k, targetRole));
                const allowedCharts = CHART_OPTIONS.filter((c) =>
                  isChartAllowedForRole(c, targetRole)
                );
                return (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs font-medium">
                        KPIs to show{' '}
                        <span className="text-[10px] text-muted-foreground">
                          (filtered for role {targetRole})
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
                              checked={contentForm.kpis.includes(key)}
                              onChange={(e) => {
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
                          (RBAC charts for role {targetRole})
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
                              checked={contentForm.charts.includes(key)}
                              onChange={(e) => {
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
                  </>
                );
              })()}
            </div>
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
                onClick={async () => {
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
                    await loadAllDashboards();
                  } catch (err) {
                    console.error('Error updating dashboard content:', err);
                    const msg =
                      err?.response?.data?.error ||
                      err?.message ||
                      'Unknown error while updating dashboard content.';
                    // eslint-disable-next-line no-alert
                    alert(`Failed to update content: ${msg}`);
                  } finally {
                    setSavingContent(false);
                  }
                }}
              >
                {savingContent && <Loader2 className="h-3 w-3 animate-spin" />}
                Save content
              </Button>
            </div>
          </div>
        </div>
      )}
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
                  placeholder="e.g. Students distribution in the faculty"
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
                disabled={
                  !createForm.name.trim() || createForm.roles.length === 0
                }
                onClick={async () => {
                  try {
                    const primaryRole =
                      (createForm.roles[0] && createForm.roles[0].toLowerCase()) ||
                      'analyst';
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
                        roles: createForm.roles,
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
                    await loadAllDashboards();
                  } catch (err) {
                    console.error('Error creating dashboard:', err);
                    const msg =
                      err?.response?.data?.error ||
                      err?.message ||
                      'Unknown error while creating dashboard.';
                    // eslint-disable-next-line no-alert
                    alert(`Failed to create dashboard: ${msg}`);
                  }
                }}
              >
                Create dashboard
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalystDashboardsPage;

