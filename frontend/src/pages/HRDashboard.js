/**
 * HR Dashboard - Smooth, Clean UI
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { Loader2, Users, Building2, Activity, Banknote } from 'lucide-react';
import { KPICard } from '../components/ui/kpi-card';
import {
  kpiStripCardClass,
  chartSurfaceCard,
  chartCardHeaderClass,
  chartCardTitleClass,
  chartCardDescriptionClass,
  chartEmptyStateClass,
} from '../lib/analytics-ui';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { WELCOME_BACK_DURATION_MS } from '../constants/welcome';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  Sci3DFullPieChart,
  SciBarChart,
  SciDonutChart,
  SciStackedAreaChart,
  UCU_COLORS,
} from '../components/charts/EChartsComponents';
import { CHART_PALETTE_THEME, MODERN_CHART_PALETTE } from '../lib/chartTheme';
import { abbreviateOrgLabel } from '../lib/hrChartLabels';

/** Taller HR charts + readable axis text */
const HR_CHART_MIN_HEIGHT = 420;
const HR_CHART_MAX_HEIGHT = 580;
const HR_AXIS_FONT_SIZE = 13;
const HR_CHART_GRID = { top: 44, bottom: 68, left: 8, right: 8 };

const HR_SERIES_LABELS = {
  lecturers: 'Lec.',
  assistant_lecturers: 'Asst.',
  other_staff: 'Other',
};

/** Stable colors for role-mix donut (keys = API role_group). */
const HR_ROLE_MIX_COLORS = {
  senate: UCU_COLORS.navy,
  dean: UCU_COLORS.blue,
  hod: UCU_COLORS['blue-light'],
  lecturer: UCU_COLORS.cyan,
  assistant_lecturer: UCU_COLORS.gold,
  finance: UCU_COLORS.green,
  hr: '#A855F7',
  other: UCU_COLORS.maroon,
};

/** Stacked areas for `employee_attendance_trend` (counts per day). */
const HR_ATTENDANCE_STACK_SERIES = [
  { key: 'present_days', label: 'Present', color: '#10B981', areaOpacity: 0.45 },
  { key: 'absent_days', label: 'Absent', color: '#EF4444', areaOpacity: 0.4 },
  { key: 'late_days', label: 'Late', color: UCU_COLORS.gold, areaOpacity: 0.4 },
  { key: 'leave_days', label: 'On leave', color: UCU_COLORS.navy, areaOpacity: 0.35 },
];

function formatAttendanceDateLabel(iso) {
  if (iso == null || iso === '') return '';
  const s = String(iso);
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

const HRDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [filters, setFilters] = useState({});
  const debouncedFilters = useDebouncedValue(filters, 300);
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    loadHRData();
  }, [debouncedFilters]);

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), WELCOME_BACK_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  const lastName =
    (user?.last_name && user.last_name.toString().trim()) ||
    (user?.full_name && user.full_name.toString().trim().split(' ').slice(-1)[0]) ||
    user?.username ||
    '';

  const loadHRData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const response = await axios.get('/api/analytics/hr', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        params: debouncedFilters,
      });
      if (response.data?.error) {
        setLoadError(response.data.detail || response.data.error);
        setStats(null);
        return;
      }
      // Backend: warehouse path uses dim_employee; legacy path adds attendance & payroll from administration DB.
      setStats({
        total_employees: response.data.total_employees || 0,
        total_departments: response.data.total_departments || 0,
        attendance_rate: response.data.attendance_rate || 0,
        total_payroll: response.data.total_payroll || 0,
        lecturers: response.data.lecturers || 0,
        assistant_lecturers: response.data.assistant_lecturers || 0,
        other_staff: response.data.other_staff || 0,
        employees_by_department: response.data.employees_by_department || [],
        employees_by_faculty: response.data.employees_by_faculty || [],
        employees_list: response.data.employees_list || [],
        lecturer_employment: response.data.lecturer_employment || [],
        attendance_by_role: response.data.attendance_by_role || [],
        employee_attendance_trend: response.data.employee_attendance_trend || [],
        payroll_by_role: response.data.payroll_by_role || [],
        retained_employees_total: response.data.retained_employees_total || 0,
        retained_employees_by_department: response.data.retained_employees_by_department || [],
        role_mix: response.data.role_mix || [],
      });
    } catch (err) {
      console.error('Error loading HR data:', err);
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        err.message ||
        'Could not load HR analytics.';
      setLoadError(msg);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (value) => {
    if (value === null || value === undefined) return '–';
    if (typeof value === 'number' && value % 1 !== 0) return value.toFixed(1);
    return value.toLocaleString ? value.toLocaleString(undefined) : String(value);
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined) return '–';
    const num = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(num)) return '–';
    return `${num.toFixed(1)}%`;
  };

  /** From GET /api/analytics/hr → employees_by_faculty (legacy + warehouse paths). */
  const employeesByFacultyChartData = useMemo(() => {
    const rows = stats?.employees_by_faculty;
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows
      .map((r) => {
        const name = r.faculty_name ?? r.FacultyName ?? 'Unknown';
        const full = String(name);
        return {
          faculty_name: full,
          faculty_short: abbreviateOrgLabel(full, 14),
          total_employees: Number(r.total_employees ?? r.total ?? 0) || 0,
          lecturers: Number(r.lecturers ?? 0) || 0,
          assistant_lecturers: Number(r.assistant_lecturers ?? 0) || 0,
          other_staff: Number(r.other_staff ?? 0) || 0,
        };
      })
      .filter((r) => r.total_employees > 0 || r.lecturers > 0 || r.assistant_lecturers > 0 || r.other_staff > 0)
      .sort((a, b) => b.total_employees - a.total_employees);
  }, [stats?.employees_by_faculty]);

  /** By department (optionally scoped to one faculty via filters). */
  const employeesByDepartmentChartData = useMemo(() => {
    const rows = stats?.employees_by_department;
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows
      .map((r) => {
        const dept = r.department_name ?? r.DepartmentName ?? 'Unknown';
        const fac = r.faculty_name ?? r.FacultyName ?? '';
        const full = String(dept);
        const tooltipLine = fac ? `${full} — ${fac}` : full;
        return {
          department_name: full,
          department_short: abbreviateOrgLabel(full, 12),
          tooltip_label: tooltipLine,
          total_employees: Number(r.total_employees ?? r.total ?? 0) || 0,
          lecturers: Number(r.lecturers ?? 0) || 0,
          assistant_lecturers: Number(r.assistant_lecturers ?? 0) || 0,
          other_staff: Number(r.other_staff ?? 0) || 0,
        };
      })
      .filter((r) => r.total_employees > 0 || r.lecturers > 0 || r.assistant_lecturers > 0 || r.other_staff > 0)
      .sort((a, b) => b.total_employees - a.total_employees)
      .slice(0, 20);
  }, [stats?.employees_by_department]);

  /** Role mix from API: counts by role_group (faculty/dept scoped; ignores employee-role filter). */
  const roleMixDonutData = useMemo(() => {
    const rows = stats?.role_mix;
    if (!Array.isArray(rows) || !rows.length) return [];
    return rows
      .map((r) => {
        const key = (r.role_group || '').toString().toLowerCase();
        const value = Number(r.count ?? r.headcount ?? 0) || 0;
        return {
          name: r.label || key || 'Other',
          value,
          color: HR_ROLE_MIX_COLORS[key],
        };
      })
      .filter((d) => d.value > 0);
  }, [stats?.role_mix]);

  /** Daily rows from `employee_attendance_trend` (legacy / linked administration DB). */
  const attendanceTrendChartData = useMemo(() => {
    const rows = stats?.employee_attendance_trend;
    if (!Array.isArray(rows) || !rows.length) return [];
    return [...rows]
      .map((r) => ({
        date_label: formatAttendanceDateLabel(r.date),
        present_days: Number(r.present_days) || 0,
        absent_days: Number(r.absent_days) || 0,
        late_days: Number(r.late_days) || 0,
        leave_days: Number(r.leave_days) || 0,
        present_rate: Number(r.present_rate) || 0,
        total_records: Number(r.total_records) || 0,
      }))
      .filter(
        (r) =>
          r.present_days + r.absent_days + r.late_days + r.leave_days > 0 || r.total_records > 0
      )
      .sort((a, b) => String(a.date_label).localeCompare(String(b.date_label)));
  }, [stats?.employee_attendance_trend]);

  /** 3D pie slices from `payroll_by_role` (total_net_pay per role_category). */
  const payrollByRoleChartData = useMemo(() => {
    const rows = stats?.payroll_by_role;
    if (!Array.isArray(rows) || !rows.length) return [];
    const sorted = [...rows]
      .map((r) => ({
        name: String(r.role_category ?? r.RoleCategory ?? 'Unknown'),
        value: Number(r.total_net_pay ?? r.TotalNetPay) || 0,
        employee_count: Number(r.employee_count ?? 0) || 0,
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
    return sorted.map((d, i) => ({
      ...d,
      color: MODERN_CHART_PALETTE[i % MODERN_CHART_PALETTE.length],
    }));
  }, [stats?.payroll_by_role]);

  const chartWrapClass = 'min-h-[440px] w-full';
  const roleMixWrapClass = 'min-h-[400px] w-full';
  const attendanceTrendWrapClass = 'min-h-[400px] w-full';
  const payrollByRoleWrapClass = 'min-h-[400px] w-full';

  return (
    <div className="space-y-4">
      {/* Header with Export */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">HR Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {showWelcome && lastName
              ? `Welcome back ${lastName} 🤗!`
              : 'Human resources analytics and management'}
          </p>
        </div>
        <ExportButtons stats={stats} filters={filters} filename="hr_dashboard" />
      </div>

      {/* Filters */}
      <GlobalFilterPanel
        onFilterChange={(next) => {
          // When a faculty is chosen, clear senate/finance/HR role_group because they are not faculty-based
          const cleaned = { ...next };
          if (
            cleaned.faculty_id &&
            (cleaned.role_group === 'finance' ||
              cleaned.role_group === 'hr' ||
              cleaned.role_group === 'senate')
          ) {
            delete cleaned.role_group;
          }
          setFilters(cleaned);
        }}
        pageName="hr_dashboard"
        hideHighSchool
        hideAcademic
      />

      {/* Employee role filter (Senate, Deans, HODs, Lecturers, etc.) */}
      <div className="flex flex-wrap items-center gap-2 mb-2 text-xs sm:text-sm">
        <span className="text-muted-foreground font-medium">Employee role filter:</span>
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={filters.role_group || ''}
          onChange={(e) => {
            const value = e.target.value;
            setFilters((prev) => {
              const next = { ...prev };
              if (!value) {
                delete next.role_group;
              } else {
                next.role_group = value;
              }
              return next;
            });
          }}
        >
          <option value="">All roles</option>
          <option value="dean">Deans / Faculty heads</option>
          <option value="hod">HODs</option>
          <option value="lecturer">Lecturers</option>
          <option value="assistant_lecturer">Assistant Lecturers</option>
          {!filters.faculty_id && (
            <>
              <option value="senate">Senate members</option>
              <option value="finance">Finance staff</option>
              <option value="hr">HR staff</option>
            </>
          )}
          <option value="other">Other employees</option>
        </select>
      </div>

      {loadError && !loading ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {loadError}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading HR data...</p>
          </div>
        </div>
      ) : loadError ? null : (
        <>
          {/* Top HR KPI strip */}
          <Card className={kpiStripCardClass}>
            <CardHeader className={chartCardHeaderClass}>
              <CardTitle className="text-base font-semibold tracking-tight">Workforce overview</CardTitle>
              <CardDescription className={chartCardDescriptionClass}>
                HR KPIs from the data warehouse (headcount by faculty/department), scoped by filters below.
                {stats &&
                (stats.total_employees ?? 0) > 0 &&
                !(stats.attendance_by_role?.length || stats.payroll_by_role?.length) &&
                (stats.attendance_rate ?? 0) === 0 &&
                (Number(stats.total_payroll) || 0) === 0 ? (
                  <span className="block mt-1 text-amber-700 dark:text-amber-400">
                    When administration HR tables have no attendance or payroll rows, charts and KPIs can still be
                    filled from <code className="text-xs">dim_employee</code> (synthetic attendance and estimated
                    payroll by role).
                  </span>
                ) : null}
              </CardDescription>
                </CardHeader>
            <CardContent className="pt-0 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <KPICard
                  title="Total employees"
                  value={formatNumber(stats?.total_employees)}
                  icon={Users}
                  subtitle="Headcount in current filter scope."
                />
                <KPICard
                  title="Departments"
                  value={formatNumber(stats?.total_departments)}
                  icon={Building2}
                  subtitle="Distinct departments represented."
                />
                <KPICard
                  title="Attendance rate"
                  value={formatPercent(stats?.attendance_rate)}
                  icon={Activity}
                  subtitle={
                    stats && (stats.attendance_rate ?? 0) === 0 && !(stats.attendance_by_role?.length)
                      ? 'No attendance rows in current data source.'
                      : 'From HR attendance analytics.'
                  }
                />
                <KPICard
                  title="Total payroll"
                  value={formatNumber(stats?.total_payroll)}
                  icon={Banknote}
                  subtitle={
                    stats && (Number(stats.total_payroll) || 0) === 0 && !(stats.payroll_by_role?.length)
                      ? 'No payroll rows in current data source.'
                      : 'Aggregate net pay in scope (administration payroll or estimated by role from dims).'
                  }
                />
              </div>
                </CardContent>
              </Card>

          {/* Row 1: Headcount distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className={chartSurfaceCard('h-full')}>
              <CardHeader className={chartCardHeaderClass}>
                <CardTitle className={chartCardTitleClass}>Employees by faculty</CardTitle>
                <CardDescription className={chartCardDescriptionClass}>
                  Headcount per faculty from HR analytics. Axis: abbreviated labels — hover for full name. Legend:{' '}
                  <span className="font-medium text-foreground/90">Lec.</span> lecturers,{' '}
                  <span className="font-medium text-foreground/90">Asst.</span> assistant lecturers,{' '}
                  <span className="font-medium text-foreground/90">Other</span> remaining staff.
                  </CardDescription>
                </CardHeader>
              <CardContent className="pt-0">
                {employeesByFacultyChartData.length > 0 ? (
                  <div className={chartWrapClass}>
                    <SciBarChart
                      data={employeesByFacultyChartData}
                      xDataKey="faculty_short"
                      tooltipNameKey="faculty_name"
                      yDataKeys={[
                        { key: 'lecturers', label: HR_SERIES_LABELS.lecturers, color: UCU_COLORS.cyan },
                        {
                          key: 'assistant_lecturers',
                          label: HR_SERIES_LABELS.assistant_lecturers,
                          color: UCU_COLORS.gold,
                        },
                        { key: 'other_staff', label: HR_SERIES_LABELS.other_staff, color: UCU_COLORS.maroon },
                      ]}
                      xAxisLabel="Faculty (short)"
                      yAxisLabel="Employees"
                      showLegend
                      showGrid
                      axisFontSize={HR_AXIS_FONT_SIZE}
                      gridPadding={HR_CHART_GRID}
                      minHeight={HR_CHART_MIN_HEIGHT}
                      maxHeight={HR_CHART_MAX_HEIGHT}
                    />
                  </div>
                ) : (
                  <div className={cn(chartEmptyStateClass, 'min-h-[280px]')}>
                    No faculty headcount for the current filters. Run ETL to load{' '}
                    <code className="text-xs">dim_employee</code> or widen filters (e.g. clear faculty / role).
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className={chartSurfaceCard('h-full')}>
              <CardHeader className={chartCardHeaderClass}>
                <CardTitle className={chartCardTitleClass}>Employees by department</CardTitle>
                <CardDescription className={chartCardDescriptionClass}>
                  Top 20 departments by headcount. Same legend as faculty chart (Lec. / Asst. / Other). Hover for full
                  department and faculty.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {employeesByDepartmentChartData.length > 0 ? (
                  <div className={chartWrapClass}>
                    <SciBarChart
                      data={employeesByDepartmentChartData}
                      xDataKey="department_short"
                      tooltipNameKey="tooltip_label"
                      yDataKeys={[
                        { key: 'lecturers', label: HR_SERIES_LABELS.lecturers, color: UCU_COLORS.cyan },
                        {
                          key: 'assistant_lecturers',
                          label: HR_SERIES_LABELS.assistant_lecturers,
                          color: UCU_COLORS.gold,
                        },
                        { key: 'other_staff', label: HR_SERIES_LABELS.other_staff, color: UCU_COLORS.maroon },
                      ]}
                      xAxisLabel="Department (short)"
                      yAxisLabel="Employees"
                      showLegend
                      showGrid
                      axisFontSize={HR_AXIS_FONT_SIZE}
                      xAxisLabelRotate={employeesByDepartmentChartData.length > 8 ? 38 : 22}
                      gridPadding={{ ...HR_CHART_GRID, bottom: 72 }}
                      minHeight={HR_CHART_MIN_HEIGHT}
                      maxHeight={HR_CHART_MAX_HEIGHT}
                    />
                  </div>
                ) : (
                  <div className={cn(chartEmptyStateClass, 'min-h-[280px]')}>
                    No department headcount for the current filters. Run ETL or adjust filters.
                  </div>
                )}
              </CardContent>
            </Card>
                  </div>

          {/* Row 2: Role mix & attendance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className={chartSurfaceCard('h-full')}>
              <CardHeader className={chartCardHeaderClass}>
                <CardTitle className={chartCardTitleClass}>Role mix</CardTitle>
                <CardDescription className={chartCardDescriptionClass}>
                  Share of staff by position type (lecturers, assistant lecturers, finance, HR, Senate, etc.). Data
                  comes from <code className="text-[10px]">role_mix</code> on the HR analytics API. Uses the same
                  faculty/department filters as above; the <strong>employee role</strong> dropdown does{' '}
                  <strong>not</strong> change this chart so you always see the full mix in scope.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {roleMixDonutData.length > 0 ? (
                  <div className={roleMixWrapClass}>
                    <SciDonutChart
                      data={roleMixDonutData}
                      nameKey="name"
                      valueKey="value"
                      colors={CHART_PALETTE_THEME}
                      innerRadius="52%"
                      minHeight={400}
                      maxHeight={520}
                      />
                    </div>
                ) : (
                  <div className={cn(chartEmptyStateClass, 'min-h-[300px]')}>
                    No role breakdown for the current faculty/department filters. Run ETL to load employees or clear
                    filters.
                  </div>
                )}
                </CardContent>
              </Card>

            <Card className={chartSurfaceCard('h-full')}>
              <CardHeader className={chartCardHeaderClass}>
                <CardTitle className={chartCardTitleClass}>Attendance trend</CardTitle>
                <CardDescription className={chartCardDescriptionClass}>
                  Stacked daily counts from <code className="text-[10px]">employee_attendance_trend</code> (Present,
                  Absent, Late, On leave). Scoped by faculty/department filters; employee-role filter does not apply.
                  Each point also carries <code className="text-[10px]">present_rate</code> (% present vs absent) in
                  the API for exports.
                  </CardDescription>
                </CardHeader>
              <CardContent className="pt-0">
                {attendanceTrendChartData.length > 0 ? (
                  <div className={attendanceTrendWrapClass}>
                    <SciStackedAreaChart
                      data={attendanceTrendChartData}
                      xDataKey="date_label"
                      seriesKeys={HR_ATTENDANCE_STACK_SERIES}
                      xAxisLabel="Date"
                      yAxisLabel="Attendance records"
                      minHeight={HR_CHART_MIN_HEIGHT}
                      maxHeight={HR_CHART_MAX_HEIGHT}
                      axisFontSize={HR_AXIS_FONT_SIZE}
                    />
                  </div>
                ) : (
                  <div className={cn(chartEmptyStateClass, 'min-h-[300px]')}>
                    No attendance series yet — needs staff in <code className="text-xs">dim_employee</code> (run
                    ETL) or administration <code className="text-xs">ucu_sourcedb2.employee_attendance</code>. When
                    dims exist but admin tables are empty, the API derives the trend from warehouse employees.
                    </div>
                  )}
                </CardContent>
              </Card>
          </div>

          {/* Row 3: Payroll analysis */}
          <Card className={chartSurfaceCard()}>
            <CardHeader className={chartCardHeaderClass}>
              <CardTitle className={chartCardTitleClass}>Payroll by role</CardTitle>
              <CardDescription className={chartCardDescriptionClass}>
                <span className="font-medium text-foreground/90">3D pie chart.</span> Share of total net pay by role
                category from <code className="text-xs">payroll_by_role</code>. When administration payroll is empty,
                amounts are estimated from scoped warehouse employees (same role buckets as HR analytics).
              </CardDescription>
                </CardHeader>
            <CardContent className="pt-0">
              {payrollByRoleChartData.length > 0 ? (
                <div className={cn(payrollByRoleWrapClass, 'w-full')} data-chart-container>
                  <Sci3DFullPieChart
                    data={payrollByRoleChartData}
                    nameKey="name"
                    valueKey="value"
                    colors={MODERN_CHART_PALETTE}
                    minHeight={HR_CHART_MIN_HEIGHT}
                    maxHeight={HR_CHART_MAX_HEIGHT}
                    outerRadius="68%"
                    emphasizeDepth
                  />
                </div>
              ) : (
                <div className={cn(chartEmptyStateClass, 'min-h-[220px]')}>
                  No payroll by role yet — needs staff in <code className="text-xs">dim_employee</code> (run ETL) or
                  rows in <code className="text-xs">ucu_sourcedb2.payroll</code>. With dims only, the API estimates
                  payroll by role for the chart and total payroll KPI.
                  </div>
              )}
                </CardContent>
              </Card>
        </>
      )}
    </div>
  );
};

export default HRDashboard;
