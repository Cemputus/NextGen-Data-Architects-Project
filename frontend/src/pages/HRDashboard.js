/**
 * HR Dashboard - Smooth, Clean UI
 */
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { WELCOME_BACK_DURATION_MS } from '../constants/welcome';

const HRDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({});
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    loadHRData();
  }, [filters]);

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
      const response = await axios.get('/api/analytics/hr', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        params: filters
      }).catch(() => {
        return axios.get('/api/dashboard/stats', {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
          params: filters
        });
      });
      
      // Use backend HR analytics directly so filters reflect lecturers, assistant lecturers,
      // other staff, attendance and payroll scoped by faculty/department.
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
      });
    } catch (err) {
      console.error('Error loading HR data:', err);
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

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading HR data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Top HR KPI strip */}
          <Card className="border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold">Workforce overview</CardTitle>
              <CardDescription className="text-xs">
                HR KPIs computed from the HR analytics endpoint, scoped by faculty/department filters where applied.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="border rounded-md px-3 py-2 bg-muted/40">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    Total employees
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatNumber(stats?.total_employees)}
                  </p>
                </div>
                <div className="border rounded-md px-3 py-2 bg-muted/40">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    Departments
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatNumber(stats?.total_departments)}
                  </p>
                </div>
                <div className="border rounded-md px-3 py-2 bg-muted/40">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    Attendance rate
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatPercent(stats?.attendance_rate)}
                  </p>
                </div>
                <div className="border rounded-md px-3 py-2 bg-muted/40">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    Total payroll
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatNumber(stats?.total_payroll)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Row 1: Headcount distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border shadow-sm h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Employees by faculty</CardTitle>
                <CardDescription className="text-xs">
                  Headcount per faculty, built from `employees_by_faculty` and scoped via filters.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="min-h-[220px] flex items-center justify-center border border-dashed rounded-md text-xs text-muted-foreground">
                  Bar chart placeholder for employees by faculty.
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Employees by department</CardTitle>
                <CardDescription className="text-xs">
                  Department distribution, using `employees_by_department` filtered by current faculty where set.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="min-h-[220px] flex items-center justify-center border border-dashed rounded-md text-xs text-muted-foreground">
                  Bar chart placeholder for employees by department.
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Role mix & attendance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border shadow-sm h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Role mix</CardTitle>
                <CardDescription className="text-xs">
                  Lecturers, assistant lecturers, HR/finance/admin and other roles, summarised from HR analytics.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="min-h-[220px] flex items-center justify-center border border-dashed rounded-md text-xs text-muted-foreground">
                  Donut / stacked bar chart placeholder for role mix.
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Attendance trend</CardTitle>
                <CardDescription className="text-xs">
                  Employee attendance trend over time from `employee_attendance_trend`.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="min-h-[220px] flex items-center justify-center border border-dashed rounded-md text-xs text-muted-foreground">
                  Line / area chart placeholder for attendance trend.
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 3: Payroll analysis */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Payroll by role</CardTitle>
              <CardDescription className="text-xs">
                High-level view of payroll distribution by role group, based on `payroll_by_role`.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="min-h-[220px] flex items-center justify-center border border-dashed rounded-md text-xs text-muted-foreground">
                Stacked column / bar chart placeholder for payroll by role.
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default HRDashboard;
