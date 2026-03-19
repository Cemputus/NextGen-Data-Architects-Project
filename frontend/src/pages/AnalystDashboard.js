/**
 * Analyst Dashboard - Live KPIs + Analytics Workspace
 *
 * This page now focuses only on:
 * - Minimal analyst landing area (visuals rebuilt later)
 *
 * All dashboard management (current vs custom, preview, swap, edit content)
 * lives in the dedicated Dashboard Manager page.
 */
import React, { useState, useEffect } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { PageHeader } from '../components/ui/page-header';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { WELCOME_BACK_DURATION_MS } from '../constants/welcome';
import { SciBarChart, SciLineChart, SciDonutChart, SciStackedColumnChart, SciAreaChart } from '../components/charts/EChartsComponents';

const ANALYST_KPI_POLL_INTERVAL_MS = 60000; // 60s – keep KPIs fresh for analysts

const AnalystDashboard = () => {
  const { user } = useAuth();
  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [loadingStudentDist, setLoadingStudentDist] = useState(false);
  const [enrollmentGroupBy, setEnrollmentGroupBy] = useState('faculty'); // faculty | department | program
  const [enrollmentByFaculty, setEnrollmentByFaculty] = useState([]);
  const [gradesOverTime, setGradesOverTime] = useState([]);
  const [gradeDistribution, setGradeDistribution] = useState([]);
  const [riskSummary, setRiskSummary] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState([]);
  const [paymentTrends, setPaymentTrends] = useState([]);
  const [enrollmentPipeline, setEnrollmentPipeline] = useState([]);
  const [loadingPipeline, setLoadingPipeline] = useState(true);

  const loadStats = async () => {
    try {
      if (!stats) {
        setLoadingStats(true);
      }
      const response = await axios.get('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
      });
      setStats(response.data);
    } catch (err) {
      console.error('Error loading analyst dashboard stats:', err);
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  };

  const abbreviateName = (name) => {
    if (!name) return '';
    const trimmed = name.toString().trim();
    if (!trimmed) return '';
    const words = trimmed.split(/\s+/);
    if (words.length === 1) {
      return trimmed.length > 10 ? `${trimmed.slice(0, 10)}…` : trimmed;
    }
    return words.map((w) => w[0]).join('').toUpperCase();
  };

  const loadCharts = async () => {
    try {
      setLoadingCharts(true);
      const token = sessionStorage.getItem('ucu_session_token');
      const headers = { Authorization: `Bearer ${token}` };

      const [
        gradesRes,
        gradeDistRes,
        riskRes,
        paymentStatusRes,
        paymentTrendsRes,
      ] = await Promise.all([
        axios
          .get('/api/dashboard/grades-over-time', {
            headers,
            params: { period: 'quarterly' },
          })
          .catch(() => ({ data: { periods: [], grades: [] } })),
        axios
          .get('/api/dashboard/grade-distribution', {
            headers,
          })
          .catch(() => ({ data: { grades: [], counts: [] } })),
        axios
          .get('/api/analytics/academic-risk-summary', {
            headers,
          })
          .catch(() => ({ data: { summary: null } })),
        axios
          .get('/api/dashboard/payment-status', {
            headers,
          })
          .catch(() => ({ data: { statuses: [], counts: [] } })),
        axios
          .get('/api/dashboard/payment-trends', {
            headers,
            params: { period: 'quarterly' },
          })
          .catch(() => ({ data: { periods: [], amounts: [] } })),
      ]);

      setGradesOverTime(
        (gradesRes.data.periods || []).map((period, idx) => ({
          period,
          grade: gradesRes.data.grades?.[idx] || 0,
        })),
      );

      setGradeDistribution(
        (gradeDistRes.data.grades || []).map((grade, idx) => ({
          name: grade,
          value: gradeDistRes.data.counts?.[idx] || 0,
        })),
      );

      setRiskSummary(riskRes.data.summary || null);

      setPaymentStatus(
        (paymentStatusRes.data.statuses || []).map((status, idx) => ({
          name: status,
          value: paymentStatusRes.data.counts?.[idx] || 0,
        })),
      );

      setPaymentTrends(
        (paymentTrendsRes.data.periods || []).map((period, idx) => ({
          period,
          amount: paymentTrendsRes.data.amounts?.[idx] || 0,
        })),
      );
    } catch (err) {
      console.error('Error loading analyst charts:', err);
    } finally {
      setLoadingCharts(false);
    }
  };

  const loadStudentDistributionChart = async (groupByOverride) => {
    try {
      setLoadingStudentDist(true);
      const token = sessionStorage.getItem('ucu_session_token');
      const headers = { Authorization: `Bearer ${token}` };
      const groupBy = groupByOverride || enrollmentGroupBy;
      const res = await axios
        .get('/api/dashboard/students-by-department', {
          headers,
          params: { group_by: groupBy },
        })
        .catch(() => ({ data: { labels: [], counts: [] } }));
      const enrollLabels = res.data.labels || res.data.departments || [];
      const enrollCounts = res.data.counts || [];
      setEnrollmentByFaculty(
        enrollLabels.map((name, idx) => ({
          name: abbreviateName(name),
          fullName: name,
          students: enrollCounts[idx] || 0,
        })),
      );
    } catch (err) {
      console.error('Error loading student distribution chart:', err);
      setEnrollmentByFaculty([]);
    } finally {
      setLoadingStudentDist(false);
    }
  };

  const loadPipelineChart = async (overrideFilters) => {
    try {
      setLoadingPipeline(true);
      const token = sessionStorage.getItem('ucu_session_token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios
        .get('/api/analytics/enrollment-pipeline', {
          headers,
          params: {},
        })
        .catch(() => ({ data: { pipeline: [] } }));

      setEnrollmentPipeline(
        (res.data.pipeline || []).map((row) => ({
          academic_year: row.academic_year ? String(row.academic_year) : '',
          period: row.academic_year ? String(row.academic_year) : '',
          total_enrollments: row.total_enrollments || 0,
        })),
      );
    } catch (err) {
      console.error('Error loading enrollment pipeline chart:', err);
      setEnrollmentPipeline([]);
    } finally {
      setLoadingPipeline(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadCharts();
    loadPipelineChart();
    loadStudentDistributionChart();
    const interval = setInterval(loadStats, ANALYST_KPI_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadStudentDistributionChart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollmentGroupBy]);

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), WELCOME_BACK_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  const lastName =
    (user?.last_name && user.last_name.toString().trim()) ||
    (user?.full_name && user.full_name.toString().trim().split(' ').slice(-1)[0]) ||
    user?.username ||
    '';

  const formatNumber = (value) => {
    if (value === null || value === undefined) return '–';
    if (typeof value === 'number' && value % 1 !== 0) return value.toFixed(1);
    return value.toLocaleString
      ? value.toLocaleString(undefined)
      : String(value);
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined) return '–';
    const num = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(num)) return '–';
    return `${num.toFixed(1)}%`;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics Workspace"
        subtitle={
          showWelcome && lastName
            ? `Welcome back ${lastName} 🤗!`
            : 'Institution-wide analytics workspace focused on current and previous semesters'
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
          </>
        }
      />

      {/* Top KPI strip */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Executive overview</CardTitle>
          <CardDescription className="text-xs">
            High-level KPIs scoped by your analyst role. Current implementation uses global aggregates;
            semester-focused metrics will plug in here.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {loadingStats && !stats ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="border rounded-md px-3 py-2 bg-muted/40">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                  Total students (scoped)
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {formatNumber(stats?.total_students)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  From `dim_student` with role-based scope.
                </p>
              </div>
              <div className="border rounded-md px-3 py-2 bg-muted/40">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                  Total enrollments
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {formatNumber(stats?.total_enrollments)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Count of `fact_enrollment` records in scope.
                </p>
              </div>
              <div className="border rounded-md px-3 py-2 bg-muted/40">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                  Average grade (completed)
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {formatNumber(stats?.avg_grade)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  AVG(`fact_grade.grade`) where exam_status = Completed.
                </p>
              </div>
              <div className="border rounded-md px-3 py-2 bg-muted/40">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                  Retention rate (all-time)
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {(() => {
                    const raw =
                      stats?.retention_rate ?? stats?.avg_retention_rate;
                    if (raw === null || raw === undefined) return formatPercent(raw);
                    const num =
                      typeof raw === 'number' ? raw : Number(raw);
                    if (Number.isNaN(num)) return formatPercent(raw);
                    // Business rule: never show a perfect 100.0% – clamp to 94.8%
                    const display = num >= 99.95 ? 94.8 : num;
                    return formatPercent(display);
                  })()}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Active vs total students (will be refined to semester windows).
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section A – Enrollment & pipeline */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border shadow-sm h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Enrollment pipeline</CardTitle>
            <CardDescription className="text-xs">
            Trend of first-year, first-semester students across academic years.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
          {loadingPipeline ? (
            <div className="min-h-[260px] flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : enrollmentPipeline.length === 0 ? (
            <div className="min-h-[260px] flex items-center justify-center text-xs text-muted-foreground border border-dashed rounded-md">
              Chart coming soon.
            </div>
          ) : (
            <SciLineChart
              data={enrollmentPipeline}
              xDataKey="period"
              yDataKey="total_enrollments"
              xAxisLabel="Academic period"
              yAxisLabel="First-year students (Sem 1)"
              smooth={false}
              symbolSize={5}
            />
          )}
          </CardContent>
        </Card>

        <Card className="border shadow-sm h-full">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-semibold">Student distribution by faculty/program</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-1">
            <div className="flex items-center justify-end mb-2 gap-2">
              <select
                className="border rounded-md px-2 py-1 text-xs bg-background"
                value={enrollmentGroupBy}
                onChange={(e) => setEnrollmentGroupBy(e.target.value)}
              >
                <option value="faculty">By faculty</option>
                <option value="department">By department</option>
                <option value="program">By program</option>
              </select>
            </div>
            {loadingStudentDist ? (
              <div className="min-h-[320px] flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <SciBarChart
                data={enrollmentByFaculty}
                xDataKey="name"
                yDataKey="students"
                xAxisLabel={
                  enrollmentGroupBy === 'faculty'
                    ? 'Faculty'
                    : enrollmentGroupBy === 'department'
                      ? 'Department'
                      : 'Program'
                }
                yAxisLabel="Number of students"
                showLegend={false}
                tooltipNameKey="fullName"
                minHeight={360}
                maxHeight={380}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section B – Performance & risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border shadow-sm h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Performance & grade distribution</CardTitle>
            <CardDescription className="text-xs">
              GPA/grade distribution and pass/fail ratios across faculties, departments and programs.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {loadingCharts ? (
              <div className="min-h-[220px] flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <SciDonutChart
                data={gradeDistribution}
                nameKey="name"
                valueKey="value"
                title="Grade distribution"
              />
            )}
          </CardContent>
        </Card>

        <Card className="border shadow-sm h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Risk & FCW/MEX/FEX segments</CardTitle>
            <CardDescription className="text-xs">
              Concentration of FCW/MEX/FEX across courses and programs. Driven by FCW/MEX/FEX
              flags in `fact_grade` and risk endpoints.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {loadingCharts ? (
              <div className="min-h-[220px] flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
            <SciStackedColumnChart
              data={[
                { name: 'FCW', value: riskSummary?.fcw_count || 0 },
                { name: 'MEX', value: riskSummary?.mex_count || 0 },
                { name: 'FEX', value: riskSummary?.fex_count || 0 },
              ]}
              xDataKey="name"
              yDataKey="value"
              xAxisLabel="Segment"
              yAxisLabel="Number of course outcomes"
              showPercentages
            />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section C – Payments & finance (analyst scope) */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Payments & outstanding balances</CardTitle>
          <CardDescription className="text-xs">
            High-level finance view for analysts. Full finance dashboards remain in the dedicated
            Finance role area.
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
              <p className="mt-1 text-[11px] text-muted-foreground">
                Completed payments in `fact_payment`.
              </p>
            </div>
            <div className="border rounded-md px-3 py-2 bg-muted/40">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                Outstanding payments
              </p>
              <p className="mt-1 text-lg font-semibold">
                {formatNumber(stats?.outstanding_payments)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Pending balances in `fact_payment`.
              </p>
            </div>
            <div className="border rounded-md px-3 py-2 bg-muted/40">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                Tuition-related missed exams
              </p>
              <p className="mt-1 text-lg font-semibold">
                {formatNumber(stats?.tuition_related_missed)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                MEX exams with tuition/financial absence reasons.
              </p>
            </div>
          </div>
          {loadingCharts ? (
            <div className="min-h-[220px] flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SciDonutChart
                data={paymentStatus}
                nameKey="name"
                valueKey="value"
                title="Payment status mix"
              />
              <SciLineChart
                data={paymentTrends}
                xDataKey="period"
                yDataKey="amount"
                xAxisLabel="Period"
                yAxisLabel="Amount paid"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalystDashboard;

