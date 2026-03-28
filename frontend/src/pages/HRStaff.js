/**
 * HR Staff Page — Staff management with roster, retirement filters, and charts.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { usePersistedState } from '../hooks/usePersistedState';
import { Users, Plus, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Loader2 } from 'lucide-react';
import axios from 'axios';
import { SciDonutChart, SciBarChart } from '../components/charts/EChartsComponents';
import { UCU_COLORS } from '../lib/chartTheme';
import { cn } from '../lib/utils';

const authHeaders = () => ({
  headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
});

/** Maps API retirement_proximity + source into filter buckets */
function bucketForEmployee(e) {
  const p = (e.retirement_proximity || '').toLowerCase();
  if (p === 'approaching') return 'retiring_soon';
  if (p === 'retired') return 'at_retirement';
  if (p === 'far') return 'not_soon';
  return 'not_soon';
}

const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'retiring_soon', label: 'Retiring soon' },
  { id: 'not_soon', label: 'Not retiring soon' },
  { id: 'at_retirement', label: 'At retirement' },
  { id: 'no_profile', label: 'App / no roster' },
];

const HRStaff = () => {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [hrError, setHrError] = useState(null);
  const [searchTerm, setSearchTerm] = usePersistedState('hr_staff_searchTerm', '');
  const [retirementFilter, setRetirementFilter] = usePersistedState('hr_staff_retirement_filter', 'all');

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setHrError(null);
      const [staffRes, hrRes] = await Promise.all([
        axios.get('/api/hr/staff-list', authHeaders()),
        axios.get('/api/analytics/hr', authHeaders()),
      ]);
      setStaff(staffRes.data?.staff || []);
      if (hrRes.data?.error) {
        setHrError(hrRes.data.detail || hrRes.data.error);
        setEmployees([]);
      } else {
        setEmployees(hrRes.data?.employees_list || []);
      }
    } catch (err) {
      console.error('Error loading staff:', err);
      setHrError(err.response?.data?.error || err.message);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const unifiedRows = useMemo(() => {
    const rows = [];
    (employees || []).forEach((e) => {
      const bucket = bucketForEmployee(e);
      rows.push({
        rowKey: `emp-${e.employee_id}`,
        kind: 'employee',
        name: e.full_name || '—',
        username: String(e.employee_id ?? ''),
        displayId: e.employee_id,
        role: e.position_title || e.role_group || '—',
        dateOfBirth: e.date_of_birth,
        age: e.age,
        retirementLabel: e.retirement_label,
        retirementAlert: !!e.retirement_alert,
        faculty: e.faculty_name,
        department: e.department_name,
        sourceLabel: 'Employee',
        bucket,
      });
    });
    (staff || []).forEach((s) => {
      rows.push({
        rowKey: `staff-${s.id}`,
        kind: 'app',
        name: s.full_name || s.username,
        username: s.username,
        displayId: s.id,
        role: s.role || '—',
        dateOfBirth: null,
        age: null,
        retirementLabel: null,
        retirementAlert: false,
        faculty: s.faculty_name,
        department: s.department_name,
        sourceLabel: s.source === 'demo' ? 'Demo' : 'App user',
        bucket: 'no_profile',
      });
    });
    return rows;
  }, [employees, staff]);

  const retirementCounts = useMemo(() => {
    let retiring = 0;
    let notSoon = 0;
    let atRet = 0;
    let noProf = 0;
    unifiedRows.forEach((r) => {
      if (r.bucket === 'retiring_soon') retiring += 1;
      else if (r.bucket === 'not_soon') notSoon += 1;
      else if (r.bucket === 'at_retirement') atRet += 1;
      else if (r.bucket === 'no_profile') noProf += 1;
    });
    return { retiring, notSoon, atRet, noProf };
  }, [unifiedRows]);

  const chartDonutData = useMemo(() => {
    const { retiring, notSoon, atRet, noProf } = retirementCounts;
    const out = [
      { name: 'Retiring soon', value: retiring, color: UCU_COLORS.red },
      { name: 'Not retiring soon', value: notSoon, color: UCU_COLORS.green },
      { name: 'At retirement', value: atRet, color: '#64748b' },
      { name: 'App / no roster', value: noProf, color: UCU_COLORS.orange },
    ];
    return out.filter((d) => d.value > 0);
  }, [retirementCounts]);

  const chartBarData = useMemo(() => {
    const { retiring, notSoon, atRet, noProf } = retirementCounts;
    if (retiring + notSoon + atRet + noProf === 0) return [];
    return [
      {
        name: 'Staff roster',
        retiring,
        notSoon,
        atRet,
        noProf,
      },
    ];
  }, [retirementCounts]);

  const barSeriesKeys = useMemo(
    () => [
      { key: 'retiring', label: 'Retiring soon', color: UCU_COLORS.red },
      { key: 'notSoon', label: 'Not retiring soon', color: UCU_COLORS.green },
      { key: 'atRet', label: 'At retirement', color: '#64748b' },
      { key: 'noProf', label: 'App / no roster', color: UCU_COLORS.orange },
    ],
    []
  );

  const filteredRows = useMemo(() => {
    let rows = unifiedRows;
    if (retirementFilter === 'retiring_soon') rows = rows.filter((r) => r.bucket === 'retiring_soon');
    else if (retirementFilter === 'not_soon') rows = rows.filter((r) => r.bucket === 'not_soon');
    else if (retirementFilter === 'at_retirement') rows = rows.filter((r) => r.bucket === 'at_retirement');
    else if (retirementFilter === 'no_profile') rows = rows.filter((r) => r.bucket === 'no_profile');

    const term = (searchTerm || '').trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const hay = [
        r.name,
        r.username,
        String(r.displayId ?? ''),
        r.role,
        r.faculty,
        r.department,
        r.retirementLabel,
        r.sourceLabel,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(term);
    });
  }, [unifiedRows, retirementFilter, searchTerm]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Staff Management</h1>
          <p className="text-sm text-muted-foreground">Manage staff members and their information</p>
        </div>
        <Button disabled className="opacity-60 cursor-not-allowed">
          <Plus className="h-4 w-4 mr-2" />
          Add Staff (coming soon)
        </Button>
      </div>

      {hrError && (
        <p className="text-sm text-amber-700 dark:text-amber-400 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2">
          HR analytics unavailable ({hrError}). Showing app users only until the API succeeds.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base font-semibold">Retirement mix</CardTitle>
            <CardDescription className="text-xs">
              ETL employees (with DOB) and app users without roster data
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {loading ? (
              <div className="flex h-[280px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : chartDonutData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No people loaded yet.</p>
            ) : (
              <SciDonutChart
                data={chartDonutData}
                title=""
                minHeight={280}
                maxHeight={320}
                innerRadius="52%"
              />
            )}
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base font-semibold">Headcount by category</CardTitle>
            <CardDescription className="text-xs">Same breakdown as a grouped bar</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {loading ? (
              <div className="flex h-[280px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : chartBarData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No data.</p>
            ) : (
              <SciBarChart
                data={chartBarData}
                xDataKey="name"
                yDataKeys={barSeriesKeys}
                xAxisLabel=""
                yAxisLabel="People"
                showLegend
                showGrid
                minHeight={280}
                maxHeight={340}
                gridPadding={{ bottom: 88, top: 24 }}
                xAxisLabelRotate={0}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-semibold">Users list</CardTitle>
          <CardDescription className="text-xs">
            Warehouse employees (with retirement) and system app users. Filter by retirement outlook.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRetirementFilter(tab.id)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    retirementFilter === tab.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted/60'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Search name, username, role, faculty, department…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <Button type="button" onClick={loadAll} variant="outline" className="shrink-0">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No people match this filter or search. Try &quot;All&quot; or clear the search box.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[960px] text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/60">
                    <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Name
                    </th>
                    <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Username / ID
                    </th>
                    <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Role
                    </th>
                    <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                      Date of birth
                    </th>
                    <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground w-14">
                      Age
                    </th>
                    <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[12rem]">
                      Retirement
                    </th>
                    <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Faculty
                    </th>
                    <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Department
                    </th>
                    <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r, idx) => (
                    <tr
                      key={r.rowKey}
                      className={cn(
                        'border-b border-border last:border-0',
                        idx % 2 === 0 ? 'bg-background' : 'bg-muted/25'
                      )}
                    >
                      <td className="px-3 py-2.5 align-top">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="font-medium text-foreground">{r.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top text-muted-foreground tabular-nums">{r.username}</td>
                      <td className="px-3 py-2.5 align-top">{r.role}</td>
                      <td className="px-3 py-2.5 align-top whitespace-nowrap tabular-nums">
                        {r.dateOfBirth ? String(r.dateOfBirth).slice(0, 10) : '—'}
                      </td>
                      <td className="px-3 py-2.5 align-top text-right tabular-nums">
                        {r.age != null ? r.age : '—'}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2.5 align-top leading-snug',
                          r.retirementAlert && 'text-red-600 dark:text-red-400 font-semibold'
                        )}
                      >
                        {r.retirementLabel || '—'}
                      </td>
                      <td className="px-3 py-2.5 align-top">{r.faculty || '—'}</td>
                      <td className="px-3 py-2.5 align-top">{r.department || '—'}</td>
                      <td className="px-3 py-2.5 align-top text-xs text-muted-foreground whitespace-nowrap">
                        {r.sourceLabel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HRStaff;
