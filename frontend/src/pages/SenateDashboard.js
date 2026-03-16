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
  const [enrollmentByYear, setEnrollmentByYear] = useState([]);
  const [riskSummary, setRiskSummary] = useState(null);
  const [highSchoolRisk, setHighSchoolRisk] = useState({ by_school: [], by_district: [] });
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
      const token = sessionStorage.getItem('ucu_session_token');
      const [statsRes, enrollmentRes, riskRes, hsRes] = await Promise.all([
        axios.get('/api/dashboard/stats', {
          headers: { Authorization: `Bearer ${token}` },
          params: filters
        }),
        axios.get('/api/analytics/enrollment-by-year', {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { enrollment_by_year: [] } })),
        axios
          .get('/api/analytics/academic-risk-summary', {
            headers: { Authorization: `Bearer ${token}` },
            params: filters,
          })
          .catch(() => ({ data: { summary: null } })),
        axios
          .get('/api/analytics/high-school-risk-correlation', {
            headers: { Authorization: `Bearer ${token}` },
            params: filters,
          })
          .catch(() => ({ data: { by_school: [], by_district: [] } })),
      ]);
      setStats(statsRes.data);
      setEnrollmentByYear(enrollmentRes.data?.enrollment_by_year || []);
      setRiskSummary(riskRes.data?.summary || null);
      setHighSchoolRisk({
        by_school: hsRes.data?.by_school || [],
        by_district: hsRes.data?.by_district || [],
      });
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setEnrollmentByYear([]);
      setRiskSummary(null);
      setHighSchoolRisk({ by_school: [], by_district: [] });
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
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    All course enrollments in the warehouse.
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
                    Enrollment rate (Y1 Sem 1)
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatPercent(
                      (enrollmentByYear && enrollmentByYear.length > 0
                        ? enrollmentByYear[enrollmentByYear.length - 1].enrollment_rate
                        : 0) || 0
                    )}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Latest academic year, restricted to Year 1 / Semester 1.
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
                  High-risk and resilient schools based on FCW/MEX/FEX and average grade in the latest years.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                  <div className="border rounded-md px-3 py-2 bg-muted/40">
                    <p className="text-[11px] text-muted-foreground font-semibold mb-1">
                      Top high-risk schools (by FCW rate)
                    </p>
                    <ul className="space-y-1 max-h-40 overflow-y-auto">
                      {(highSchoolRisk.by_school || [])
                        .slice(0, 5)
                        .map((s) => (
                          <li key={`${s.school}-${s.district}`} className="flex justify-between gap-2">
                            <span className="truncate">
                              {s.school} <span className="text-[10px] text-muted-foreground">({s.district})</span>
                            </span>
                            <span className="font-medium">
                              {formatPercent((s.fcw_rate ?? 0) * 100)}
                            </span>
                          </li>
                        ))}
                      {(!highSchoolRisk.by_school || highSchoolRisk.by_school.length === 0) && (
                        <li className="text-muted-foreground">No high-school risk data available.</li>
                      )}
                    </ul>
                  </div>
                  <div className="border rounded-md px-3 py-2 bg-muted/40">
                    <p className="text-[11px] text-muted-foreground font-semibold mb-1">
                      High-performing districts (avg grade)
                    </p>
                    <ul className="space-y-1 max-h-40 overflow-y-auto">
                      {(highSchoolRisk.by_district || [])
                        .slice(0, 5)
                        .map((d) => (
                          <li key={d.district} className="flex justify-between gap-2">
                            <span className="truncate">{d.district}</span>
                            <span className="font-medium">
                              {formatNumber(d.avg_grade ?? 0)}
                            </span>
                          </li>
                        ))}
                      {(!highSchoolRisk.by_district || highSchoolRisk.by_district.length === 0) && (
                        <li className="text-muted-foreground">No district-level risk data available.</li>
                      )}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 3: Academic risk summary (FCW/MEX/FEX) */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Academic risk summary (FCW / MEX / FEX)</CardTitle>
              <CardDescription className="text-xs">
                Summarized FCW, MEX, FEX counts and average grade from <code>v_student_risk_summary</code>,
                scoped by Senate role and filters.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {riskSummary ? (
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
                  <div className="border rounded-md px-3 py-2 bg-muted/40">
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">FCW</p>
                    <p className="mt-1 text-lg font-semibold">
                      {formatNumber(riskSummary.fcw_count)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Failed coursework records.</p>
                  </div>
                  <div className="border rounded-md px-3 py-2 bg-muted/40">
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">MEX</p>
                    <p className="mt-1 text-lg font-semibold">
                      {formatNumber(riskSummary.mex_count)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Missed exam records.</p>
                  </div>
                  <div className="border rounded-md px-3 py-2 bg-muted/40">
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">FEX</p>
                    <p className="mt-1 text-lg font-semibold">
                      {formatNumber(riskSummary.fex_count)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Failed exam records.</p>
                  </div>
                  <div className="border rounded-md px-3 py-2 bg-muted/40">
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                      Courses analyzed
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {formatNumber(riskSummary.total_courses)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Total unique course records in summary.</p>
                  </div>
                  <div className="border rounded-md px-3 py-2 bg-muted/40">
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                      Avg grade (all courses)
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {formatNumber(riskSummary.avg_grade)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      From <code>v_student_risk_summary</code>.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No academic risk summary available for the current filters.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default SenateDashboard;
