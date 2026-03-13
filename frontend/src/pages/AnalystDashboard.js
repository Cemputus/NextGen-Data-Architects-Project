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

const ANALYST_KPI_POLL_INTERVAL_MS = 60000; // 60s – keep KPIs fresh for analysts

const AnalystDashboard = () => {
  const { user } = useAuth();
  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

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

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, ANALYST_KPI_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

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
                  {formatPercent(stats?.retention_rate ?? stats?.avg_retention_rate)}
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border shadow-sm h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Enrollment pipeline</CardTitle>
            <CardDescription className="text-xs">
              Funnel from applications to enrolled students by semester/year. Powered by enrollment
              and admissions facts (to be wired to dedicated endpoints).
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="min-h-[220px] flex items-center justify-center border border-dashed rounded-md text-xs text-muted-foreground">
              Enrollment funnel visual placeholder (bar / funnel chart).
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Enrollment by faculty/program</CardTitle>
            <CardDescription className="text-xs">
              Distribution of enrolled students by faculty and program. This will use
              `/api/dashboard/students-by-department` and related views.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="min-h-[220px] flex items-center justify-center border border-dashed rounded-md text-xs text-muted-foreground">
              Stacked / grouped bar chart placeholder for faculty & program mix.
            </div>
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
            <div className="min-h-[220px] flex items-center justify-center border border-dashed rounded-md text-xs text-muted-foreground">
              Grade distribution / box or stacked bar chart placeholder.
            </div>
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
            <div className="min-h-[220px] flex items-center justify-center border border-dashed rounded-md text-xs text-muted-foreground">
              Risk segmentation heatmap / cohort visual placeholder.
            </div>
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
          <div className="min-h-[220px] flex items-center justify-center border border-dashed rounded-md text-xs text-muted-foreground">
            Payment trends and mix chart placeholder (line + stacked bar).
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalystDashboard;

