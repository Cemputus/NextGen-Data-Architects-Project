/**
 * HR Payroll – paid vs pending and payroll by role (latest pay period).
 */
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Loader2, DollarSign, Users, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { SciDonutChart, SciBarChart } from '../components/charts/EChartsComponents';
import { MODERN_CHART_PALETTE } from '../lib/chartTheme';
import {
  chartSurfaceCard,
  chartCardHeaderClass,
  chartCardTitleClass,
  chartCardDescriptionClass,
} from '../lib/analytics-ui';
const auth = () => ({ headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` } });

const emptyState = {
  payroll_by_role: [],
  total_payroll: 0,
  paid: [],
  pending: [],
  latest_pay_period: null,
  paid_count: 0,
  pending_count: 0,
};

function formatMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function HRPayrollPage() {
  const [data, setData] = useState(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    axios
      .get('/api/hr/payroll-overview', auth())
      .then((r) => {
        const d = r.data || {};
        if (d.error && !d.payroll_by_role) {
          setError(d.error);
          setData(emptyState);
          return;
        }
        setData({
          ...emptyState,
          ...d,
          payroll_by_role: d.payroll_by_role || [],
          paid: d.paid || [],
          pending: d.pending || [],
        });
      })
      .catch((err) => {
        if (err.response?.status === 403) {
          setForbidden(true);
        } else {
          setError(err.response?.data?.error || err.message || 'Could not load payroll overview.');
        }
        setData(emptyState);
      })
      .finally(() => setLoading(false));
  }, []);

  const statusDonutData = useMemo(() => {
    const paid = Number(data.paid_count) || 0;
    const pending = Number(data.pending_count) || 0;
    if (paid === 0 && pending === 0) return [];
    return [
      { name: 'Paid (latest period)', value: paid, color: MODERN_CHART_PALETTE[1] },
      { name: 'Pending', value: pending, color: MODERN_CHART_PALETTE[4] },
    ].filter((d) => d.value > 0);
  }, [data.paid_count, data.pending_count]);

  const roleBarData = useMemo(() => {
    const rows = data.payroll_by_role || [];
    if (!rows.length) return [];
    return [...rows]
      .map((r) => ({
        name: String(r.role_name || r.role_category || r.role || '—'),
        value: Number(r.total_net_pay) || 0,
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [data.payroll_by_role]);

  const hasAnyData =
    (data.payroll_by_role || []).length > 0 ||
    (data.paid || []).length > 0 ||
    (data.pending || []).length > 0 ||
    (Number(data.total_payroll) || 0) > 0;

  const sourceNote =
    data.data_source === 'dim_employee_synthetic'
      ? 'Showing estimated split from warehouse employees (no rows in administration payroll for this environment).'
      : data.data_source === 'ucu_sourcedb2.payroll'
        ? 'Based on administration payroll for the latest pay period in the warehouse.'
        : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-muted-foreground" />
          Payroll
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Check who has been paid and who is pending. HR-managed.
        </p>
      </div>

      {forbidden ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          You need the HR role to view payroll analytics.
        </div>
      ) : null}

      {error && !forbidden ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex gap-2 items-start"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      ) : null}

      <Card className={chartSurfaceCard()}>
        <CardHeader className={chartCardHeaderClass}>
          <CardTitle className={chartCardTitleClass}>Overview</CardTitle>
          <CardDescription className={chartCardDescriptionClass}>
            Payroll by role and payment status
            {data.latest_pay_period ? (
              <>
                {' '}
                · Latest pay period:{' '}
                <span className="font-medium text-foreground/90">{data.latest_pay_period}</span>
              </>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !hasAnyData ? (
            <p className="text-sm text-muted-foreground py-6">
              No payroll data yet. Integrate payroll source to see paid vs pending, or load{' '}
              <code className="text-xs">dim_employee</code> for an estimated overview.
            </p>
          ) : (
            <>
              {sourceNote ? (
                <p className="text-xs text-muted-foreground rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                  {sourceNote}
                </p>
              ) : null}

              {/* KPI strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border/70 bg-card/80 px-3 py-3 shadow-sm">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Total net pay</p>
                  <p className="text-lg font-semibold tabular-nums">{formatMoney(data.total_payroll)}</p>
                  <p className="text-[10px] text-muted-foreground">Latest period (UGX)</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-card/80 px-3 py-3 shadow-sm">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    Paid
                  </p>
                  <p className="text-lg font-semibold tabular-nums">{data.paid_count ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Employees with payment</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-card/80 px-3 py-3 shadow-sm">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3 text-amber-600" />
                    Pending
                  </p>
                  <p className="text-lg font-semibold tabular-nums">{data.pending_count ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">No payment this period</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-card/80 px-3 py-3 shadow-sm">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Roles
                  </p>
                  <p className="text-lg font-semibold tabular-nums">{(data.payroll_by_role || []).length}</p>
                  <p className="text-[10px] text-muted-foreground">With payroll in period</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="min-h-[300px] rounded-lg border border-border/60 p-2" data-chart-container>
                  <p className="text-xs font-medium text-foreground/90 px-2 pt-1 pb-2">Paid vs pending (headcount)</p>
                  {statusDonutData.length > 0 ? (
                    <SciDonutChart
                      data={statusDonutData}
                      nameKey="name"
                      valueKey="value"
                      innerRadius="52%"
                      colors={MODERN_CHART_PALETTE}
                      minHeight={280}
                      maxHeight={340}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground px-2 py-8 text-center">No status breakdown.</p>
                  )}
                </div>
                <div className="min-h-[300px] rounded-lg border border-border/60 p-2" data-chart-container>
                  <p className="text-xs font-medium text-foreground/90 px-2 pt-1 pb-2">Net pay by role (latest period)</p>
                  {roleBarData.length > 0 ? (
                    <SciBarChart
                      data={roleBarData}
                      xDataKey="name"
                      yDataKey="value"
                      xAxisLabel="Role"
                      yAxisLabel="Net pay (UGX)"
                      fillColor={MODERN_CHART_PALETTE[0]}
                      showGrid
                      showLegend={false}
                      minHeight={280}
                      maxHeight={360}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground px-2 py-8 text-center">No role breakdown.</p>
                  )}
                </div>
              </div>

              {(data.paid_list_truncated || data.pending_list_truncated) && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Lists show up to {300} rows each. Totals above reflect full counts.
                </p>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border/70 overflow-hidden">
                  <div className="bg-muted/40 px-3 py-2 border-b border-border/60">
                    <h3 className="text-sm font-semibold text-foreground">Paid — latest period</h3>
                    <p className="text-[10px] text-muted-foreground">Name, role, net pay</p>
                  </div>
                  <div className="max-h-[320px] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-card border-b border-border/60 text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Employee</th>
                          <th className="px-3 py-2 font-medium">Role</th>
                          <th className="px-3 py-2 font-medium text-right">Net pay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.paid || []).map((p, i) => (
                          <tr key={p.employee_id ?? i} className="border-b border-border/40 hover:bg-muted/20">
                            <td className="px-3 py-2">{p.name || p.full_name || p.username || '—'}</td>
                            <td className="px-3 py-2 text-muted-foreground">{p.role_category || '—'}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">{formatMoney(p.net_pay)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(data.paid || []).length === 0 && (
                      <p className="text-xs text-muted-foreground px-3 py-6 text-center">No paid rows in this view.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-border/70 overflow-hidden">
                  <div className="bg-muted/40 px-3 py-2 border-b border-border/60">
                    <h3 className="text-sm font-semibold text-foreground">Pending — no payment this period</h3>
                    <p className="text-[10px] text-muted-foreground">Employees without a paid row for the latest period</p>
                  </div>
                  <div className="max-h-[320px] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-card border-b border-border/60 text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Employee</th>
                          <th className="px-3 py-2 font-medium">Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.pending || []).map((p, i) => (
                          <tr key={p.employee_id ?? i} className="border-b border-border/40 hover:bg-muted/20">
                            <td className="px-3 py-2">{p.name || p.full_name || p.username || '—'}</td>
                            <td className="px-3 py-2 text-muted-foreground">{p.role_category || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(data.pending || []).length === 0 && (
                      <p className="text-xs text-muted-foreground px-3 py-6 text-center">No pending rows in this view.</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
