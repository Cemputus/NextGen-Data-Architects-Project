/**
 * Senate Dashboard - Smooth, Clean UI
 */
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { WELCOME_BACK_DURATION_MS } from '../constants/welcome';
import { SkeletonCard, Skeleton } from '../components/ui/skeleton';

const SenateDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [filters, setFilters] = useState({});

  useEffect(() => {
    loadDashboardData();
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

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        params: filters
      });
      setStats(response.data);
    } catch (err) {
      console.error('Error loading dashboard:', err);
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

  const exportReport = async (format) => {
    try {
      const response = await axios.get(`/api/export/${format}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        params: filters,
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `senate-report.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error exporting report:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Senate Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {showWelcome && lastName
              ? `Welcome back ${lastName} 🤗!`
              : 'Institution-wide analytics and comprehensive reporting'}
          </p>
        </div>
        <ExportButtons
          stats={stats}
          filters={filters}
          filename="senate_dashboard"
          chartSelectors={[
            '.recharts-wrapper', // All recharts components
            '[class*="chart"]',
            '[data-chart]',
            '[data-chart-container]',
            '.h-\\[350px\\]', // Chart containers with specific heights
            '.h-\\[300px\\]'
          ]}
        />
      </div>

      {/* Filters */}
      <GlobalFilterPanel onFilterChange={setFilters} pageName="senate_dashboard" />

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <Skeleton className="h-[320px] w-full rounded-lg" />
        </div>
      ) : (
        <>
          {/* Top institution KPI strip */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Institution overview</CardTitle>
              <CardDescription className="text-xs">
                Institution-wide KPIs from the warehouse, scoped by your Senate role and global filters.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="border rounded-md px-3 py-2 bg-muted/40">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    Total students
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatNumber(stats?.total_students)}
                  </p>
                </div>
                <div className="border rounded-md px-3 py-2 bg-muted/40">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    Enrollments
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatNumber(stats?.total_enrollments)}
                  </p>
                </div>
                <div className="border rounded-md px-3 py-2 bg-muted/40">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    Average grade
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatNumber(stats?.avg_grade)}
                  </p>
                </div>
                <div className="border rounded-md px-3 py-2 bg-muted/40">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    Retention rate
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatPercent(stats?.retention_rate ?? stats?.avg_retention_rate)}
                  </p>
                </div>
                <div className="border rounded-md px-3 py-2 bg-muted/40">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    Graduation rate
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatPercent(stats?.graduation_rate ?? stats?.avg_graduation_rate)}
                  </p>
                </div>
                <div className="border rounded-md px-3 py-2 bg-muted/40">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    Total revenue
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatNumber(stats?.total_payments)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Row 1: Enrollment & faculty comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border shadow-sm h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Enrollment by faculty</CardTitle>
                <CardDescription className="text-xs">
                  Distribution of students and enrollments across faculties, respecting RBAC scope for Senate.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="min-h-[220px] flex items-center justify-center border border-dashed rounded-md text-xs text-muted-foreground">
                  Stacked / grouped bar chart placeholder for faculty enrollment.
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">FCW/MEX/FEX by faculty</CardTitle>
                <CardDescription className="text-xs">
                  High-level view of risk segments (FCW, MEX, FEX) by faculty, built on FCW/MEX/FEX facts.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="min-h-[220px] flex items-center justify-center border border-dashed rounded-md text-xs text-muted-foreground">
                  Heatmap / stacked bar chart placeholder for risk by faculty.
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Finance & recruitment */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border shadow-sm h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Payment status mix</CardTitle>
                <CardDescription className="text-xs">
                  Completed vs pending payments at institution level, from `fact_payment`.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="min-h-[220px] flex items-center justify-center border border-dashed rounded-md text-xs text-muted-foreground">
                  Donut chart placeholder for payment status distribution.
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Feeder schools & outcomes</CardTitle>
                <CardDescription className="text-xs">
                  Role-ready container for high-school recruitment and performance analytics (FCW/MEX/FEX by school).
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="min-h-[220px] flex items-center justify-center border border-dashed rounded-md text-xs text-muted-foreground">
                  Matrix / heatmap placeholder for high school vs outcomes.
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default SenateDashboard;
