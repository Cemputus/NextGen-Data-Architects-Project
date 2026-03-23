/**
 * Finance Dashboard - Smooth, Clean UI
 */
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { Loader2, Users, Activity, Receipt, CreditCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { WELCOME_BACK_DURATION_MS } from '../constants/welcome';
import { SciLineChart, SciBarChart, SciDonutChart } from '../components/charts/EChartsComponents';
import { KPICard } from '../components/ui/kpi-card';
import {
  kpiStripCardClass,
  chartSurfaceCard,
  chartCardHeaderClass,
  chartCardTitleClass,
  chartCardDescriptionClass,
} from '../lib/analytics-ui';
import { MODERN_CHART_PALETTE } from '../lib/chartTheme';

const FinanceDashboard = () => {
  const { user } = useAuth();
  const role = (user?.role || '').toString().toLowerCase();
  const lockedFacultyId = role === 'dean' ? user?.faculty_id : undefined;
  const lockedDepartmentId = role === 'hod' ? user?.department_id : undefined;
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({});
  const [showWelcome, setShowWelcome] = useState(true);
  const [paymentTrends, setPaymentTrends] = useState([]);
  const [outstandingFacultyProgram, setOutstandingFacultyProgram] = useState([]);
  const [paymentStatusMix, setPaymentStatusMix] = useState([]);
  const [highRiskDebtSegments, setHighRiskDebtSegments] = useState([]);
  const [tuitionDefaultersBar, setTuitionDefaultersBar] = useState([]);
  const [tuitionPaymentTrendsDim, setTuitionPaymentTrendsDim] = useState([]);

  useEffect(() => {
    loadFinanceData();
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

  const loadFinanceData = async () => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem('ucu_session_token');
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.get('/api/analytics/finance', {
        headers,
        params: filters
      }).catch(() => {
        return axios.get('/api/dashboard/stats', {
          headers,
          params: filters
        });
      });
      
      setStats({
        total_revenue: response.data.total_payments,
        outstanding: response.data.total_pending,
        payment_rate: response.data.payment_rate,
        total_students: response.data.total_students
      });

      const tuitionTrendPeriod = (() => {
        const effective = { ...filters };
        if (lockedFacultyId != null && lockedFacultyId !== '') {
          if (effective.faculty_id != null && String(effective.faculty_id) === String(lockedFacultyId)) {
            delete effective.faculty_id;
          }
        }
        if (lockedDepartmentId != null && lockedDepartmentId !== '') {
          if (effective.department_id != null && String(effective.department_id) === String(lockedDepartmentId)) {
            delete effective.department_id;
          }
        }
        return Object.keys(effective).length > 0 ? 'quarterly' : 'yearly';
      })();

      const [
        defRes,
        trendsRes,
        paymentTrendsRes,
        outstandingRes,
        paymentStatusRes,
        highRiskRes,
      ] = await Promise.all([
        axios
          .get('/api/dashboard/tuition-defaulters', { headers, params: filters })
          .catch(() => ({ data: { tuition_defaulters: [], semester_id: null } })),
        axios
          .get('/api/dashboard/tuition-payment-trends-dimensions', {
            headers,
            params: { period: tuitionTrendPeriod, ...filters },
          })
          .catch(() => ({
            data: {
              periods: [],
              faculty_amounts: [],
              department_amounts: [],
              program_amounts: [],
            },
          })),
        axios
          .get('/api/dashboard/payment-trends', {
            headers,
            params: { period: 'quarterly', ...filters },
          })
          .catch(() => ({ data: { periods: [], amounts: [] } })),
        axios
          .get('/api/dashboard/outstanding-by-faculty-program', {
            headers,
            params: { ...filters },
          })
          .catch(() => ({ data: { outstanding_by_faculty_program: [], semester_id: null } })),
        axios
          .get('/api/dashboard/payment-status', {
            headers,
            params: { ...filters },
          })
          .catch(() => ({ data: { statuses: [], counts: [] } })),
        axios
          .get('/api/dashboard/high-risk-debt-segments', {
            headers,
            params: { ...filters },
          })
          .catch(() => ({
            data: { high_risk_debt_segments: [], semester_id: null },
          })),
      ]);

      setTuitionDefaultersBar(
        (defRes.data?.tuition_defaulters || []).map((r) => ({
          ...r,
          name: abbreviateTuitionDefaulterLabel(r),
        })),
      );

      const periods = trendsRes.data?.periods || [];
      const fa = trendsRes.data?.faculty_amounts || [];
      const da = trendsRes.data?.department_amounts || [];
      const pa = trendsRes.data?.program_amounts || [];
      setTuitionPaymentTrendsDim(
        periods.map((p, idx) => ({
          period: abbreviatePeriod(p),
          faculty_amount: Number(fa[idx] ?? 0) || 0,
          department_amount: Number(da[idx] ?? 0) || 0,
          program_amount: Number(pa[idx] ?? 0) || 0,
        })),
      );

      setPaymentTrends(
        (paymentTrendsRes.data?.periods || []).map((p, idx) => ({
          period: abbreviatePeriod(p),
          amount: paymentTrendsRes.data?.amounts?.[idx] ?? 0,
        })),
      );

      setOutstandingFacultyProgram(
        (outstandingRes.data?.outstanding_by_faculty_program || []).map((r) => ({
          ...r,
          name: abbreviateFacultyProgramLabel(r),
        })),
      );

      const statusPairs = (paymentStatusRes.data?.statuses || []).map((s, idx) => ({
        status: String(s ?? '').trim(),
        count: Number(paymentStatusRes.data?.counts?.[idx] ?? 0) || 0,
      }));

      const completed = statusPairs
        .filter((x) => ['completed', 'success'].includes(x.status.toLowerCase()))
        .reduce((acc, x) => acc + x.count, 0);
      const pending = statusPairs
        .filter((x) => ['pending', 'failed'].includes(x.status.toLowerCase()))
        .reduce((acc, x) => acc + x.count, 0);
      const partial = statusPairs
        .filter((x) => x.status.toLowerCase() === 'partial')
        .reduce((acc, x) => acc + x.count, 0);

      setPaymentStatusMix(
        [
          { name: 'Completed', value: completed },
          { name: 'Pending', value: pending },
          { name: 'Partial', value: partial },
        ].filter((d) => d.value > 0),
      );

      setHighRiskDebtSegments(
        (highRiskRes.data?.high_risk_debt_segments || []).map((r) => ({
          ...r,
          // Backend already sends labels like "Intake 2024"
          segment: String(r?.segment ?? r?.name ?? '').trim() || 'Intake',
          outstanding: Number(r?.outstanding ?? r?.value ?? 0) || 0,
        })),
      );
    } catch (err) {
      console.error('Error loading finance data:', err);
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

  // Professional UGX formatting for KPI tiles (UI only).
  // Example: 119,445,136,148 => UGX 119,445.1M
  const formatUGX = (value) => {
    if (value === null || value === undefined) return 'UGX –';
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return 'UGX –';
    const millions = num / 1_000_000;
    return `UGX ${millions.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  };

  const abbreviateName = (name) => {
    if (!name) return '';
    const trimmed = String(name).trim();
    if (!trimmed) return '';
    const words = trimmed.split(/\s+/);
    if (words.length === 1) {
      return trimmed.length > 10 ? `${trimmed.slice(0, 10)}…` : trimmed;
    }
    return words.map((w) => w[0]).join('').toUpperCase();
  };

  const abbreviatePeriod = (period) => {
    const s = String(period ?? '').trim();
    const m = /^Q(\d)\s+(\d{4})$/i.exec(s);
    if (m) return `Q${m[1]}'${m[2].slice(2)}`;
    const m2 = /^Sem\s*(\d+)/i.exec(s);
    if (m2) return `Sem ${m2[1]}`;
    if (s.length > 14) return `${s.slice(0, 12)}…`;
    return s;
  };

  const abbreviateTuitionDefaulterLabel = (row) => {
    const dimension = String(row?.dimension ?? '').toLowerCase();
    const rawName = String(row?.name ?? '').trim();
    const parts = rawName.includes(':') ? rawName.split(':') : [rawName];
    const suffix = parts.slice(1).join(':').trim() || rawName;
    const shortSuffix = abbreviateName(suffix);
    if (dimension === 'faculty') return `Fac ${shortSuffix}`;
    if (dimension === 'department') return `Dept ${shortSuffix}`;
    if (dimension === 'program') return `Prog ${shortSuffix}`;
    return shortSuffix || rawName;
  };

  const abbreviateFacultyProgramLabel = (row) => {
    const raw = String(row?.name ?? '').trim();
    if (!raw) return raw;
    const parts = raw.split(' / ');
    const fac = parts[0] ?? '';
    const prog = parts.slice(1).join(' / ');
    const shortFac = abbreviateName(fac);
    const shortProg = abbreviateName(prog);
    if (shortFac && shortProg) return `${shortFac} / ${shortProg}`;
    return shortFac || shortProg || raw;
  };

  return (
    <div className="space-y-4">
      {/* Header with Export */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Finance Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {showWelcome && lastName
              ? `Welcome back ${lastName} 🤗!`
              : 'Financial analytics and payment insights'}
          </p>
        </div>
        <ExportButtons stats={stats} filters={filters} filename="finance_dashboard" />
      </div>

      {/* Filters */}
      <GlobalFilterPanel
        onFilterChange={setFilters}
        pageName="finance_dashboard"
        lockedFacultyId={lockedFacultyId}
        lockedDepartmentId={lockedDepartmentId}
      />

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading financial data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Top finance KPI strip */}
          <Card className={kpiStripCardClass}>
            <CardHeader className={chartCardHeaderClass}>
              <CardTitle className="text-base font-semibold tracking-tight">Finance overview</CardTitle>
              <CardDescription className={chartCardDescriptionClass}>
                Institution-wide finance KPIs, scoped to the Finance role via the finance analytics/dashboard endpoints.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <KPICard
                  title="Total revenue"
                  value={formatUGX(stats?.total_revenue)}
                  icon={Receipt}
                />
                <KPICard
                  title="Outstanding"
                  value={formatUGX(stats?.outstanding)}
                  icon={CreditCard}
                />
                <KPICard
                  title="Payment rate"
                  value={formatPercent(stats?.payment_rate)}
                  icon={Activity}
                />
                <KPICard
                  title="Students in scope"
                  value={formatNumber(stats?.total_students)}
                  icon={Users}
                />
              </div>
            </CardContent>
          </Card>

          {/* Row 1: Revenue & outstanding */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className={chartSurfaceCard('h-full')}>
              <CardHeader className={chartCardHeaderClass}>
                <CardTitle className={chartCardTitleClass}>Revenue trend</CardTitle>
                <CardDescription className={chartCardDescriptionClass}>
                  Quarter-by-quarter revenue trend using payment facts; filters control faculty/department scope.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <SciLineChart
                  data={paymentTrends}
                  xDataKey="period"
                  yDataKey="amount"
                  xAxisLabel="Period"
                  yAxisLabel="Revenue"
                  showLegend={false}
                  minHeight={420}
                  maxHeight={640}
                  gridPadding={{ bottom: 70 }}
                />
              </CardContent>
            </Card>

            <Card className={chartSurfaceCard('h-full')}>
              <CardHeader className={chartCardHeaderClass}>
                <CardTitle className={chartCardTitleClass}>Outstanding by faculty/program</CardTitle>
                <CardDescription className={chartCardDescriptionClass}>
                  Breakdown of outstanding balances by faculty and program, supporting drilldowns.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <SciBarChart
                  data={outstandingFacultyProgram}
                  xDataKey="name"
                  yDataKey="value"
                  xAxisLabel="Faculty / Program"
                  yAxisLabel="Outstanding"
                  showLegend={false}
                  xAxisLabelRotate={35}
                  axisFontSize={11}
                  showGrid
                  gridPadding={{ bottom: 115 }}
                  fillColor={MODERN_CHART_PALETTE[4]}
                  minHeight={420}
                  maxHeight={620}
                />
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Payment mix & risk */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className={chartSurfaceCard('h-full')}>
              <CardHeader className={chartCardHeaderClass}>
                <CardTitle className={chartCardTitleClass}>Payment status mix</CardTitle>
                <CardDescription className={chartCardDescriptionClass}>
                  Status distribution (Completed vs Pending vs Partial) from `fact_payment`.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <SciDonutChart
                  data={paymentStatusMix}
                  title="Payment status"
                  colors={[
                    MODERN_CHART_PALETTE[0], // Completed
                    MODERN_CHART_PALETTE[1], // Pending
                    MODERN_CHART_PALETTE[2], // Partial
                  ]}
                />
              </CardContent>
            </Card>

            <Card className={chartSurfaceCard('h-full')}>
              <CardHeader className={chartCardHeaderClass}>
                <CardTitle className={chartCardTitleClass}>High-risk debt segments</CardTitle>
                <CardDescription className={chartCardDescriptionClass}>
                  Space for cohorts with persistent or large outstanding balances (e.g. by program or intake year).
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {highRiskDebtSegments.length > 0 ? (
                  <SciBarChart
                    data={highRiskDebtSegments}
                    xDataKey="segment"
                    yDataKey="outstanding"
                    xAxisLabel="Cohort (intake year)"
                    yAxisLabel="Outstanding"
                    showLegend={false}
                    xAxisLabelRotate={35}
                    axisFontSize={11}
                    showGrid
                    gridPadding={{ bottom: 115 }}
                    fillColor={MODERN_CHART_PALETTE[2]}
                    minHeight={420}
                    maxHeight={620}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground px-2 py-8 text-center">
                    No high-risk debt segments for the selected filters.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Row 3: Tuition analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className={chartSurfaceCard('h-full')}>
              <CardHeader className={chartCardHeaderClass}>
                <CardTitle className={chartCardTitleClass}>Tuition/fees defaulters</CardTitle>
                <CardDescription className={chartCardDescriptionClass}>
                  Bar chart of students with pending/failed tuition payments by faculty, department, and program.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <SciBarChart
                  data={tuitionDefaultersBar}
                  xDataKey="name"
                  yDataKey="value"
                  xAxisLabel="Faculty / Department / Program"
                  yAxisLabel="Defaulters"
                  showLegend={false}
                  xAxisLabelRotate={35}
                  axisFontSize={12}
                  showGrid
                  gridPadding={{ bottom: 125 }}
                  fillColor={MODERN_CHART_PALETTE[0]}
                  minHeight={440}
                  maxHeight={620}
                />
              </CardContent>
            </Card>

            <Card className={chartSurfaceCard('h-full')}>
              <CardHeader className={chartCardHeaderClass}>
                <CardTitle className={chartCardTitleClass}>Tuition payment trends</CardTitle>
                <CardDescription className={chartCardDescriptionClass}>
                  Time series of avg completed tuition payments over time for{" "}
                  {filters?.program_id
                    ? 'the selected program'
                    : filters?.department_id
                      ? 'the selected department'
                      : filters?.faculty_id
                        ? 'the selected faculty'
                        : 'all faculties'}.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <SciLineChart
                  data={tuitionPaymentTrendsDim}
                  xDataKey="period"
                  yDataKey={
                    filters?.program_id
                      ? 'program_amount'
                      : filters?.department_id
                        ? 'department_amount'
                        : 'faculty_amount'
                  }
                  xAxisLabel="Period"
                  yAxisLabel={`Avg completed tuition payment${
                    filters?.program_id
                      ? ' (Program)'
                      : filters?.department_id
                        ? ' (Department)'
                        : filters?.faculty_id
                          ? ' (Faculty)'
                          : ' (All Faculties)'
                  }`}
                  showLegend={false}
                  showGrid
                  minHeight={360}
                  maxHeight={580}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default FinanceDashboard;
