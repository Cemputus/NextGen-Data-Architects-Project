/**
 * HOD Dashboard - Smooth, Clean UI
 */
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { WELCOME_BACK_DURATION_MS } from '../constants/welcome';

const HODDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({});
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    loadDepartmentData();
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

  const loadDepartmentData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/analytics/department', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        params: filters
      });
      setStats(response.data);
    } catch (err) {
      console.error('Error loading department data:', err);
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
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Department Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {showWelcome && lastName
              ? `Welcome back ${lastName} 🤗!`
              : 'Department-level analytics and insights'}
          </p>
        </div>
        <ExportButtons stats={stats} filters={filters} filename="hod_dashboard" />
      </div>

      {/* Filters */}
      <GlobalFilterPanel onFilterChange={setFilters} pageName="hod_dashboard" hideFaculty hideDepartment />

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading department data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Top department KPI strip */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Department overview</CardTitle>
              <CardDescription className="text-xs">
                Key KPIs for your department, scoped via the HOD role. Semester-focused analytics will refine these metrics.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="border rounded-md px-3 py-2 bg-muted/40">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    Students in department
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatNumber(stats?.total_students)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Role- and filter-scoped headcount.
                  </p>
                </div>
                <div className="border rounded-md px-3 py-2 bg-muted/40">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    Enrollments
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatNumber(stats?.total_enrollments)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Course enrollments within the department.
                  </p>
                </div>
                <div className="border rounded-md px-3 py-2 bg-muted/40">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    Average grade
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatNumber(stats?.avg_grade)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Completed exams only for department courses.
                  </p>
                </div>
                <div className="border rounded-md px-3 py-2 bg-muted/40">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    Retention rate
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatPercent(stats?.retention_rate ?? stats?.avg_retention_rate)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Active vs total students in the department.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Row 1: Courses & performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border shadow-sm h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Courses & class sizes</CardTitle>
                <CardDescription className="text-xs">
                  Overview of course enrollments and class sizes within your department.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="min-h-[220px] flex items-center justify-center border border-dashed rounded-md text-xs text-muted-foreground">
                  Course enrollment / class size chart placeholder.
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Course difficulty & FCW/MEX/FEX</CardTitle>
                <CardDescription className="text-xs">
                  Courses with high FCW/MEX/FEX incidence and lower pass rates, based on `fact_grade`.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="min-h-[220px] flex items-center justify-center border border-dashed rounded-md text-xs text-muted-foreground">
                  Difficult courses / risk heatmap placeholder.
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Attendance & finance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border shadow-sm h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Attendance patterns</CardTitle>
                <CardDescription className="text-xs">
                  Attendance levels and trends across your department&apos;s courses.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="min-h-[220px] flex items-center justify-center border border-dashed rounded-md text-xs text-muted-foreground">
                  Attendance trend chart placeholder.
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Payments & tuition-related risk</CardTitle>
                <CardDescription className="text-xs">
                  Outstanding balances and tuition-related missed exams (MEX) within the department.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div className="border rounded-md px-3 py-2 bg-muted/40">
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                      Total payments
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {formatNumber(stats?.total_payments)}
                    </p>
                  </div>
                  <div className="border rounded-md px-3 py-2 bg-muted/40">
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                      Outstanding
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {formatNumber(stats?.outstanding_payments)}
                    </p>
                  </div>
                  <div className="border rounded-md px-3 py-2 bg-muted/40">
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                      Tuition-related MEX
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {formatNumber(stats?.tuition_related_missed)}
                    </p>
                  </div>
                </div>
                <div className="min-h-[180px] flex items-center justify-center border border-dashed rounded-md text-xs text-muted-foreground">
                  Payment & risk segmentation chart placeholder.
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default HODDashboard;
