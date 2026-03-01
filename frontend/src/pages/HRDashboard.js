/**
 * HR Dashboard - Smooth, Clean UI
 */
import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, UserCheck, Calendar, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ModernStatsCards from '../components/ModernStatsCards';
import RoleBasedCharts from '../components/RoleBasedCharts';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { WELCOME_BACK_DURATION_MS } from '../constants/welcome';
import { SciBarChart, SciLineChart } from '../components/charts/EChartsComponents';

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
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: filters
      }).catch(() => {
        return axios.get('/api/dashboard/stats', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
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

  // Derived chart data for employees per faculty/department
  const employeesBreakdown = useMemo(() => {
    if (!stats) return { byFaculty: [], byDeptInFaculty: [] };

    const byFaculty = (stats.employees_by_faculty || []).map((row) => ({
      name: row.faculty_name || 'Unknown',
      total: row.total_employees || 0,
    }));

    const byDeptInFaculty = (stats.employees_by_department || []).map((row) => ({
      name: row.department_name || 'Unknown',
      faculty_name: row.faculty_name || 'Unknown',
      total: row.total_employees || 0,
    }));

    return { byFaculty, byDeptInFaculty };
  }, [stats]);

  const attendanceTrend = useMemo(
    () =>
      (stats?.employee_attendance_trend || []).map((row) => ({
        period: row.date,
        attendance: row.present_rate || 0,
      })),
    [stats]
  );

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
          {/* KPI Cards */}
          <ModernStatsCards stats={stats} type="hr" />

          {/* Main Analytics Tabs */}
          <Tabs defaultValue="overview" className="space-y-3">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1 p-1">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="employees" className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Employees
              </TabsTrigger>
              <TabsTrigger value="attendance" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Attendance
              </TabsTrigger>
              <TabsTrigger value="payroll" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Payroll
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-3">
              <Card className="border shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold">HR Overview</CardTitle>
                  <CardDescription className="text-xs">Key workforce metrics and trends</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <RoleBasedCharts filters={filters} type="hr" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="employees" className="space-y-3">
              <Card className="border shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold">Employees by Faculty / Department</CardTitle>
                  <CardDescription className="text-xs">
                    Use the faculty and department filters above. With{" "}
                    <span className="font-semibold">All Faculties</span> selected you see staff counts per faculty.
                    When you choose a specific faculty and department you see staff counts for that department only,
                    including lecturers, assistant lecturers and other staff.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  {filters.faculty_id ? (
                    <SciBarChart
                      data={employeesBreakdown.byDeptInFaculty}
                      xDataKey="name"
                      yDataKey="total"
                      xAxisLabel="Department"
                      yAxisLabel="Number of Employees"
                    />
                  ) : (
                    <SciBarChart
                      data={employeesBreakdown.byFaculty}
                      xDataKey="name"
                      yDataKey="total"
                      xAxisLabel="Faculty"
                      yAxisLabel="Number of Employees"
                    />
                  )}
                  <div className="text-xs text-muted-foreground">
                    Titles and roles included in these counts: <span className="font-semibold">Lecturers</span>,{" "}
                    <span className="font-semibold">Assistant Lecturers</span>, and{" "}
                    <span className="font-semibold">Other staff</span> (HR, Finance, and administrative roles).
                  </div>

                  {stats?.lecturer_employment?.length ? (
                    <div className="mt-4">
                      <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                        Lecturer employment type (Full-time vs Part-time)
                      </h3>
                      <SciBarChart
                        data={stats.lecturer_employment.map((row) => ({
                          name: row.employment_type || 'Unknown',
                          total: row.total || 0,
                        }))}
                        xDataKey="name"
                        yDataKey="total"
                        xAxisLabel="Employment Type"
                        yAxisLabel="Number of Lecturers"
                      />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="attendance" className="space-y-3">
              <Card className="border shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold">Employee Attendance Trend</CardTitle>
                  <CardDescription className="text-xs">
                    Attendance trend over time for employees matching the current faculty / department filters.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {attendanceTrend.length ? (
                    <SciLineChart
                      data={attendanceTrend}
                      xDataKey="period"
                      yDataKey="attendance"
                      xAxisLabel="Date"
                      yAxisLabel="Attendance Rate (%)"
                    />
                  ) : (
                    <div className="min-h-[200px] flex items-center justify-center text-muted-foreground text-sm border border-dashed rounded-lg">
                      No employee attendance records for the selected filters. Try switching to All Faculties or
                      another department.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payroll" className="space-y-3">
              <Card className="border shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold">Payroll Management</CardTitle>
                  <CardDescription className="text-xs">Payroll totals, trends, and department breakdown</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="min-h-[200px] max-h-[320px] flex items-center justify-center text-muted-foreground text-sm">
                    Payroll analytics visualization
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default HRDashboard;
