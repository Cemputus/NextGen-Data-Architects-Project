/**
 * Analyst Dashboard - Smooth, Clean UI
 */
import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Filter, FileText, Plus, Users, Activity, AlertTriangle, GraduationCap, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { PageHeader } from '../components/ui/page-header';
import { KPICard } from '../components/ui/kpi-card';
import { DashboardGrid } from '../components/ui/dashboard-grid';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ExportButtons from '../components/ExportButtons';
import FEXAnalytics from './FEXAnalytics';
import HighSchoolAnalytics from './HighSchoolAnalytics';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const ANALYST_KPI_POLL_INTERVAL_MS = 60000; // 60s – keep KPIs fresh for analysts

const AnalystDashboard = () => {
  const { user } = useAuth();
  const [filters, setFilters] = useState({});
  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [dashboards, setDashboards] = useState([]);
  const [loadingDashboards, setLoadingDashboards] = useState(true);
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [editingDashboard, setEditingDashboard] = useState(null);
  const [dashboardForm, setDashboardForm] = useState({
    name: '',
    description: '',
    roles: ['analyst'],
    kpis: ['total_students', 'avg_grade', 'failed_exams'],
    charts: ['fex'],
  });
  const [savingDashboard, setSavingDashboard] = useState(false);
  const [activeDashboardId, setActiveDashboardId] = useState(null);

  const ROLE_OPTIONS = [
    { value: 'analyst', label: 'Analyst' },
    { value: 'sysadmin', label: 'System Admin' },
    { value: 'staff', label: 'Staff' },
    { value: 'student', label: 'Student' },
    { value: 'dean', label: 'Dean' },
    { value: 'hod', label: 'HOD' },
    { value: 'finance', label: 'Finance' },
    { value: 'hr', label: 'HR' },
    { value: 'senate', label: 'Senate' },
  ];

  const KPI_OPTIONS = [
    { value: 'total_students', label: 'Total Students', icon: Users },
    { value: 'avg_grade', label: 'Average Grade', icon: TrendingUp },
    { value: 'failed_exams', label: 'Failed Exams (FEX)', icon: AlertTriangle },
    { value: 'missed_exams', label: 'Missed Exams (MEX)', icon: Activity },
    { value: 'avg_attendance', label: 'Avg Attendance', icon: Activity },
    { value: 'retention_rate', label: 'Retention Rate', icon: BarChart3 },
    { value: 'graduation_rate', label: 'Graduation Rate', icon: GraduationCap },
  ];

  const CHART_OPTIONS = [
    { value: 'fex', label: 'FEX Analytics', component: FEXAnalytics },
    { value: 'highschool', label: 'High School Analytics', component: HighSchoolAnalytics },
  ];

  const loadStats = async () => {
    try {
      if (!stats) {
        setLoadingStats(true);
      }
      const response = await axios.get('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: filters,
      });
      setStats(response.data);
    } catch (err) {
      console.error('Error loading analyst dashboard stats:', err);
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  };

  const loadDashboards = async () => {
    try {
      setLoadingDashboards(true);
      const response = await axios.get('/api/dashboards', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setDashboards(response.data?.dashboards || []);
    } catch (err) {
      console.error('Error loading dashboards:', err);
    } finally {
      setLoadingDashboards(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadDashboards();
    const interval = setInterval(loadStats, ANALYST_KPI_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 30000);
    return () => clearTimeout(timer);
  }, []);

  const lastName =
    (user?.last_name && user.last_name.toString().trim()) ||
    (user?.full_name && user.full_name.toString().trim().split(' ').slice(-1)[0]) ||
    user?.username ||
    '';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics Workspace"
        subtitle={
          showWelcome && lastName
            ? `Welcome back ${lastName} 🤗!`
            : 'Live analytics workspace powered by the data warehouse'
        }
        actions={
          <>
            <Button
              onClick={() => {
                setRefreshing(true);
                loadStats();
              }}
              disabled={refreshing || loadingStats}
              className="gap-2"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing || loadingStats ? 'Refreshing…' : 'Refresh KPIs'}
            </Button>
            <ExportButtons filename="analyst_workspace" />
            <Button
              className="gap-2"
              size="default"
              onClick={() => {
                setEditingDashboard(null);
                setDashboardForm({
                  name: '',
                  description: '',
                  roles: ['analyst'],
                  kpis: ['total_students', 'avg_grade', 'failed_exams'],
                  charts: ['fex'],
                });
                setActiveDashboardId(null);
                setShowDashboardModal(true);
              }}
            >
              <Plus className="h-4 w-4" />
              New Dashboard
            </Button>
          </>
        }
      />

      {/* Live KPIs – ETL-driven, scoped by filters */}
      {loadingStats && !stats ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DashboardGrid cols={{ default: 1, sm: 2, md: 3, lg: 4 }}>
          <KPICard
            title="Total Students"
            value={stats?.total_students ?? 0}
            icon={Users}
            subtitle="Scoped by applied filters"
          />
          <KPICard
            title="Average Grade"
            value={stats?.avg_grade ?? 0}
            icon={TrendingUp}
            subtitle="Completed exams only"
          />
          <KPICard
            title="Failed Exams (FEX)"
            value={stats?.failed_exams ?? 0}
            icon={AlertTriangle}
            subtitle="Total failed exam records"
          />
          <KPICard
            title="Missed Exams (MEX)"
            value={stats?.missed_exams ?? 0}
            icon={Activity}
            subtitle="Total missed exam records"
          />
          <KPICard
            title="Avg Attendance"
            value={stats?.avg_attendance ?? 0}
            icon={Activity}
            subtitle="Average total hours attended"
          />
          <KPICard
            title="Retention Rate"
            value={`${stats?.retention_rate ?? 0}%`}
            icon={BarChart3}
            subtitle="Active students / total"
          />
          <KPICard
            title="Graduation Rate"
            value={`${stats?.graduation_rate ?? 0}%`}
            icon={GraduationCap}
            subtitle="Graduated / total"
          />
        </DashboardGrid>
      )}

      {/* Filters */}
      <GlobalFilterPanel onFilterChange={setFilters} />

      {/* Custom Dashboards visible to this analyst (role-based) */}
      <Card className="border shadow-sm">
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base font-semibold">Custom Dashboards</CardTitle>
            <CardDescription className="text-xs">
              Dashboards created by analysts and assigned to roles/users. Visible across sessions and devices.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={loadDashboards}
            disabled={loadingDashboards}
          >
            <RefreshCw className={`h-4 w-4 ${loadingDashboards ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {loadingDashboards ? (
            <div className="flex items-center justify-center py-4 text-xs text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading dashboards…</span>
            </div>
          ) : dashboards.length === 0 ? (
            <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
              No dashboards yet. Click the New Dashboard button to create one.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dashboards.map((dash) => (
                <Card
                  key={dash.id}
                  className={`border transition-colors cursor-pointer ${
                    activeDashboardId === dash.id ? 'border-primary' : 'hover:border-primary/40'
                  }`}
                >
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-sm font-semibold truncate">{dash.name}</CardTitle>
                    {dash.description && (
                      <CardDescription className="text-[11px] line-clamp-2">
                        {dash.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="p-3 pt-0 text-[11px] text-muted-foreground space-y-1">
                    <div>
                      <span className="font-medium">Roles:</span>{' '}
                      {(dash.roles || []).length > 0 ? dash.roles.join(', ') : 'None'}
                    </div>
                    <div>
                      <span className="font-medium">Users:</span>{' '}
                      {(dash.users || []).length > 0 ? dash.users.join(', ') : '—'}
                    </div>
                    <div className="text-[10px]">
                      Created by <span className="font-medium">{dash.created_by_username}</span>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        size="xs"
                        variant={activeDashboardId === dash.id ? 'default' : 'outline'}
                        className="h-6 px-2 text-[10px]"
                        onClick={() => {
                          setActiveDashboardId((prev) => (prev === dash.id ? null : dash.id));
                        }}
                      >
                        {activeDashboardId === dash.id ? 'Hide' : 'Open'}
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => {
                          let parsedDef = {};
                          try {
                            if (typeof dash.definition === 'string') {
                              parsedDef = JSON.parse(dash.definition);
                            } else if (dash.definition && typeof dash.definition === 'object') {
                              parsedDef = dash.definition;
                            }
                          } catch {
                            parsedDef = {};
                          }
                          setEditingDashboard(dash);
                          setDashboardForm({
                            name: dash.name || '',
                            description: dash.description || '',
                            roles:
                              Array.isArray(dash.roles) && dash.roles.length > 0
                                ? dash.roles
                                : ['analyst'],
                            kpis:
                              Array.isArray(parsedDef.kpis) && parsedDef.kpis.length > 0
                                ? parsedDef.kpis
                                : ['total_students', 'avg_grade', 'failed_exams'],
                            charts:
                              Array.isArray(parsedDef.charts) && parsedDef.charts.length > 0
                                ? parsedDef.charts
                                : ['fex'],
                          });
                          setShowDashboardModal(true);
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active custom dashboard preview */}
      {activeDashboardId && (
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2">
            {(() => {
              const dash = dashboards.find((d) => d.id === activeDashboardId);
              if (!dash) return null;
              let parsedDef = {};
              try {
                if (typeof dash.definition === 'string') {
                  parsedDef = JSON.parse(dash.definition);
                } else if (dash.definition && typeof dash.definition === 'object') {
                  parsedDef = dash.definition;
                }
              } catch {
                parsedDef = {};
              }
              const selectedKpis =
                Array.isArray(parsedDef.kpis) && parsedDef.kpis.length > 0
                  ? parsedDef.kpis
                  : ['total_students', 'avg_grade', 'failed_exams'];
              const selectedCharts =
                Array.isArray(parsedDef.charts) && parsedDef.charts.length > 0
                  ? parsedDef.charts
                  : ['fex'];

              return (
                <>
                  <CardTitle className="text-base font-semibold">
                    {dash.name || 'Custom Dashboard'}
                  </CardTitle>
                  {dash.description && (
                    <CardDescription className="text-xs">{dash.description}</CardDescription>
                  )}
                  <CardContent className="mt-3 px-0 pb-4 space-y-4">
                    {/* KPIs section */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        KPIs
                      </p>
                      <DashboardGrid cols={{ default: 1, sm: 2, md: 3, lg: 4 }}>
                        {KPI_OPTIONS.filter((k) => selectedKpis.includes(k.value)).map((kpi) => {
                          const value =
                            kpi.value === 'total_students'
                              ? stats?.total_students ?? 0
                              : kpi.value === 'avg_grade'
                              ? stats?.avg_grade ?? 0
                              : kpi.value === 'failed_exams'
                              ? stats?.failed_exams ?? 0
                              : kpi.value === 'missed_exams'
                              ? stats?.missed_exams ?? 0
                              : kpi.value === 'avg_attendance'
                              ? stats?.avg_attendance ?? 0
                              : kpi.value === 'retention_rate'
                              ? `${stats?.retention_rate ?? 0}%`
                              : kpi.value === 'graduation_rate'
                              ? `${stats?.graduation_rate ?? 0}%`
                              : 0;

                          const subtitle =
                            kpi.value === 'total_students'
                              ? 'Scoped by applied filters'
                              : kpi.value === 'avg_grade'
                              ? 'Completed exams only'
                              : kpi.value === 'failed_exams'
                              ? 'Total failed exam records'
                              : kpi.value === 'missed_exams'
                              ? 'Total missed exam records'
                              : kpi.value === 'avg_attendance'
                              ? 'Average total hours attended'
                              : kpi.value === 'retention_rate'
                              ? 'Active students / total'
                              : kpi.value === 'graduation_rate'
                              ? 'Graduated / total'
                              : '';

                          return (
                            <KPICard
                              key={kpi.value}
                              title={kpi.label}
                              value={value}
                              icon={kpi.icon}
                              subtitle={subtitle}
                            />
                          );
                        })}
                      </DashboardGrid>
                    </div>

                    {/* Charts section */}
                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Charts
                      </p>
                      {CHART_OPTIONS.filter((c) => selectedCharts.includes(c.value)).map((chart) => {
                        const ChartComponent = chart.component;
                        return (
                          <Card key={chart.value} className="border shadow-sm">
                            <CardHeader className="p-4 pb-2">
                              <CardTitle className="text-sm font-semibold">{chart.label}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                              <ChartComponent filters={filters} onFilterChange={setFilters} />
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </CardContent>
                </>
              );
            })()}
          </CardHeader>
        </Card>
      )}

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="fex" className="space-y-3">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1 p-1">
          <TabsTrigger value="fex" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            FEX Analytics
          </TabsTrigger>
          <TabsTrigger value="highschool" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            High School
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Custom
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fex" className="space-y-3">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold">Failed Exam (FEX) Analytics</CardTitle>
              <CardDescription className="text-xs">Analyze student performance and identify at-risk students</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <FEXAnalytics filters={filters} onFilterChange={setFilters} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="highschool" className="space-y-3">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold">High School Analytics</CardTitle>
              <CardDescription className="text-xs">Track student performance by high school and district</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <HighSchoolAnalytics filters={filters} onFilterChange={setFilters} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-3">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold">Custom Analytics Builder</CardTitle>
              <CardDescription className="text-xs">
                Create custom analytics dashboards. Use the full Analytics Builder for advanced charts and saved filters.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-3">
                <div className="min-h-[160px] flex items-center justify-center text-muted-foreground text-sm border border-dashed rounded-lg">
                  <div className="text-center p-4 space-y-2">
                    <BarChart3 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="font-medium">Use Analytics → Workspace for full chart builder</p>
                    <p className="text-xs text-muted-foreground">
                      Filters you set here are shared with the Analytics pages and are automatically remembered.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-3">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold">Saved Reports</CardTitle>
              <CardDescription className="text-xs">Access and manage your saved analytics reports</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="min-h-[200px] max-h-[320px] flex items-center justify-center text-muted-foreground text-sm border border-dashed rounded-lg">
                <div className="text-center p-4">
                  <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                  <p>No saved reports yet</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Simple Add Dashboard modal */}
      {showDashboardModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md border">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {editingDashboard ? 'Edit Dashboard' : 'Add Dashboard'}
              </h2>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowDashboardModal(false)}
              >
                Close
              </button>
            </div>
            <div className="px-4 py-3 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="dashboard-name">
                  Dashboard name *
                </label>
                <input
                  id="dashboard-name"
                  type="text"
                  className="w-full rounded-md border px-2 py-1.5 text-xs bg-background"
                  value={dashboardForm.name}
                  onChange={(e) =>
                    setDashboardForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="e.g. At-risk students by faculty"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="dashboard-description">
                  Description
                </label>
                <textarea
                  id="dashboard-description"
                  className="w-full rounded-md border px-2 py-1.5 text-xs bg-background min-h-[60px]"
                  value={dashboardForm.description}
                  onChange={(e) =>
                    setDashboardForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Optional description for other users."
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium">Assign to roles *</p>
                <div className="grid grid-cols-2 gap-1">
                  {ROLE_OPTIONS.map((opt) => {
                    const checked = dashboardForm.roles.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className="flex items-center gap-1 text-[11px] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="h-3 w-3"
                          checked={checked}
                          onChange={(e) => {
                            const checkedNow = e.target.checked;
                            setDashboardForm((prev) => {
                              const rolesSet = new Set(prev.roles);
                              if (checkedNow) {
                                rolesSet.add(opt.value);
                              } else {
                                rolesSet.delete(opt.value);
                              }
                              return { ...prev, roles: Array.from(rolesSet) };
                            });
                          }}
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium">Select KPIs for this dashboard</p>
                <div className="grid grid-cols-2 gap-1">
                  {KPI_OPTIONS.map((opt) => {
                    const checked = dashboardForm.kpis.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className="flex items-center gap-1 text-[11px] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="h-3 w-3"
                          checked={checked}
                          onChange={(e) => {
                            const checkedNow = e.target.checked;
                            setDashboardForm((prev) => {
                              const kpiSet = new Set(prev.kpis);
                              if (checkedNow) {
                                kpiSet.add(opt.value);
                              } else {
                                kpiSet.delete(opt.value);
                              }
                              return { ...prev, kpis: Array.from(kpiSet) };
                            });
                          }}
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium">Select charts for this dashboard</p>
                <div className="grid grid-cols-2 gap-1">
                  {CHART_OPTIONS.map((opt) => {
                    const checked = dashboardForm.charts.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className="flex items-center gap-1 text-[11px] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="h-3 w-3"
                          checked={checked}
                          onChange={(e) => {
                            const checkedNow = e.target.checked;
                            setDashboardForm((prev) => {
                              const chartSet = new Set(prev.charts);
                              if (checkedNow) {
                                chartSet.add(opt.value);
                              } else {
                                chartSet.delete(opt.value);
                              }
                              return { ...prev, charts: Array.from(chartSet) };
                            });
                          }}
                        />
                        <span>{opt.label}</span>
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
                onClick={() => setShowDashboardModal(false)}
                disabled={savingDashboard}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="gap-2"
                disabled={
                  savingDashboard ||
                  !dashboardForm.name.trim() ||
                  dashboardForm.roles.length === 0 ||
                  (dashboardForm.kpis.length === 0 && dashboardForm.charts.length === 0)
                }
                onClick={async () => {
                  try {
                    setSavingDashboard(true);
                    const payload = {
                      name: dashboardForm.name.trim(),
                      description: dashboardForm.description.trim(),
                      definition: {
                        template: 'analytics_dashboard',
                        source: 'analyst_dashboard',
                        kpis: dashboardForm.kpis,
                        charts: dashboardForm.charts,
                      },
                      roles: dashboardForm.roles,
                    };
                    if (editingDashboard?.id) {
                      await axios.put(`/api/dashboards/${editingDashboard.id}`, payload, {
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                      });
                    } else {
                      await axios.post('/api/dashboards', payload, {
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                      });
                    }
                    setShowDashboardModal(false);
                    setEditingDashboard(null);
                    await loadDashboards();
                  } catch (err) {
                    console.error('Error saving dashboard:', err);
                    const msg =
                      err?.response?.data?.error ||
                      err?.message ||
                      'Unknown error while saving dashboard.';
                    // Surface backend validation/permission errors to the analyst
                    // so it is clear why the dashboard did not save.
                    // eslint-disable-next-line no-alert
                    alert(`Failed to save dashboard: ${msg}`);
                  } finally {
                    setSavingDashboard(false);
                  }
                }}
              >
                {savingDashboard && <Loader2 className="h-3 w-3 animate-spin" />}
                Save dashboard
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalystDashboard;
