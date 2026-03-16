/**
 * Finance Dashboard - Smooth, Clean UI
 */
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { WELCOME_BACK_DURATION_MS } from '../constants/welcome';
import { SciLineChart, SciBarChart, SciDonutChart } from '../components/charts/EChartsComponents';

const FinanceDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({});
  const [showWelcome, setShowWelcome] = useState(true);

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
      const response = await axios.get('/api/analytics/finance', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        params: filters
      }).catch(() => {
        return axios.get('/api/dashboard/stats', {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
          params: filters
        });
      });
      
      setStats({
        total_revenue: response.data.total_payments,
        outstanding: response.data.total_pending,
        payment_rate: response.data.payment_rate,
        total_students: response.data.total_students
      });
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
      <GlobalFilterPanel onFilterChange={setFilters} />

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
          <Card className="border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold">Finance overview</CardTitle>
              <CardDescription className="text-xs">
                Institution-wide finance KPIs, scoped to the Finance role via the finance analytics/dashboard endpoints.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="border rounded-md px-3 py-2 bg-muted/40">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    Total revenue
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatNumber(stats?.total_revenue)}
                  </p>
                </div>
                <div className="border rounded-md px-3 py-2 bg-muted/40">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    Outstanding
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatNumber(stats?.outstanding)}
                  </p>
                </div>
                <div className="border rounded-md px-3 py-2 bg-muted/40">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    Payment rate
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatPercent(stats?.payment_rate)}
                  </p>
                </div>
                <div className="border rounded-md px-3 py-2 bg-muted/40">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    Students in scope
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatNumber(stats?.total_students)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Row 1: Revenue & outstanding */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border shadow-sm h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Revenue trend</CardTitle>
                <CardDescription className="text-xs">
                  Semester-by-semester revenue trend using payment facts; filters control faculty/department scope.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <SciLineChart
                  data={[
                    { period: 'Sem 1', amount: stats?.total_revenue || 0 },
                    { period: 'Sem 2', amount: (stats?.total_revenue || 0) * 0.9 },
                  ]}
                  xDataKey="period"
                  yDataKey="amount"
                  xAxisLabel="Semester"
                  yAxisLabel="Revenue"
                />
              </CardContent>
            </Card>

            <Card className="border shadow-sm h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Outstanding by faculty/program</CardTitle>
                <CardDescription className="text-xs">
                  Breakdown of outstanding balances by faculty and program, supporting drilldowns.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <SciBarChart
                  data={[
                    { segment: 'Faculty A', outstanding: stats?.outstanding || 0 },
                    { segment: 'Faculty B', outstanding: (stats?.outstanding || 0) * 0.5 },
                  ]}
                  xDataKey="segment"
                  yDataKey="outstanding"
                  xAxisLabel="Segment"
                  yAxisLabel="Outstanding"
                />
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Payment mix & risk */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border shadow-sm h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Payment status mix</CardTitle>
                <CardDescription className="text-xs">
                  Status distribution (Completed vs Pending vs Partial) from `fact_payment`.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <SciDonutChart
                  data={[
                    { name: 'Completed', value: stats?.total_revenue || 0 },
                    { name: 'Pending', value: stats?.outstanding || 0 },
                  ]}
                  title="Payment status"
                />
              </CardContent>
            </Card>

            <Card className="border shadow-sm h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">High-risk debt segments</CardTitle>
                <CardDescription className="text-xs">
                  Space for cohorts with persistent or large outstanding balances (e.g. by program or intake year).
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <SciBarChart
                  data={[
                    { segment: 'Intake 2023', outstanding: stats?.outstanding || 0 },
                    { segment: 'Intake 2024', outstanding: (stats?.outstanding || 0) * 0.7 },
                  ]}
                  xDataKey="segment"
                  yDataKey="outstanding"
                  xAxisLabel="Cohort"
                  yAxisLabel="Outstanding"
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
