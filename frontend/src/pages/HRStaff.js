/**
 * HR Staff Page — Staff management: users list, retirement filters, chart
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { usePersistedState } from '../hooks/usePersistedState';
import { Users, Plus, Search, Filter, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Loader2 } from 'lucide-react';
import axios from 'axios';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

const auth = () => ({ headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` } });

/** Bucket for filtering & chart (employees from ETL + app users without profile) */
const BUCKET = {
  ALL: 'all',
  RETIRING_SOON: 'retiring_soon',
  NOT_SOON: 'not_soon',
  AT_RETIREMENT: 'at_retirement',
  APP_NO_PROFILE: 'app_no_profile',
  EMPLOYEE_NO_PROFILE: 'employee_no_profile',
};

const VALID_FILTER_VALUES = new Set(Object.values(BUCKET));

const CHART_COLORS = {
  not_soon: '#22c55e',
  retiring_soon: '#ef4444',
  at_retirement: '#64748b',
  app_no_profile: '#94a3b8',
  employee_no_profile: '#cbd5e1',
};

/** Normalize API retirement_proximity (case, legacy backend values). */
function normalizeProximity(raw) {
  if (raw == null || raw === '') return '';
  const p = String(raw).trim().toLowerCase();
  if (p === 'within_5_years') return 'approaching';
  return p;
}

function bucketForRow(row) {
  if (row.kind === 'app_user') return 'app_no_profile';
  const p = normalizeProximity(row.retirement_proximity);
  if (!p && row.retirement_alert) return 'retiring_soon';
  if (!p) return 'employee_no_profile';
  if (p === 'approaching') return 'retiring_soon';
  if (p === 'far') return 'not_soon';
  if (p === 'retired') return 'at_retirement';
  return 'employee_no_profile';
}

const HRStaff = () => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [employeesList, setEmployeesList] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [searchTerm, setSearchTerm] = usePersistedState('hr_staff_searchTerm', '');
  const [retirementFilterRaw, setRetirementFilter] = usePersistedState('hr_staff_retirement_filter', BUCKET.ALL);

  const retirementFilter = VALID_FILTER_VALUES.has(retirementFilterRaw) ? retirementFilterRaw : BUCKET.ALL;

  useEffect(() => {
    if (!VALID_FILTER_VALUES.has(retirementFilterRaw)) {
      setRetirementFilter(BUCKET.ALL);
    }
  }, [retirementFilterRaw, setRetirementFilter]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [hrRes, staffRes] = await Promise.all([
        axios.get('/api/analytics/hr', auth()).catch((e) => ({ data: {}, error: e })),
        axios.get('/api/hr/staff-list', auth()).catch((e) => ({ data: { staff: [] }, error: e })),
      ]);
      if (hrRes.error && !hrRes.data?.employees_list) {
        setLoadError('Could not load HR analytics (employees).');
      }
      setEmployeesList(hrRes.data?.employees_list || []);
      setStaffList(staffRes.data?.staff || []);
    } catch (err) {
      console.error('Error loading staff data:', err);
      setLoadError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const combinedRows = useMemo(() => {
    const fromEmp = (employeesList || []).map((e) => ({
      key: `emp-${e.employee_id}`,
      kind: 'employee',
      id: e.employee_id,
      name: e.full_name,
      username: null,
      role: e.position_title || e.role_group || '—',
      faculty: e.faculty_name,
      department: e.department_name,
      source: 'Employee',
      age: e.age,
      retirementLabel: e.retirement_label,
      retirementProximity: e.retirement_proximity,
      retirementAlert: !!e.retirement_alert,
    }));
    const fromApp = (staffList || []).map((s) => ({
      key: `app-${s.id ?? s.username}`,
      kind: 'app_user',
      id: s.id,
      name: s.full_name || s.username,
      username: s.username,
      role: s.role || '—',
      faculty: s.faculty_name,
      department: s.department_name,
      source: s.source === 'demo' ? 'Demo' : 'App user',
      age: null,
      retirementLabel: '—',
      retirementProximity: null,
      retirementAlert: false,
    }));
    return [...fromEmp, ...fromApp];
  }, [employeesList, staffList]);

  const chartData = useMemo(() => {
    let notSoon = 0;
    let retiringSoon = 0;
    let atRet = 0;
    let appNo = 0;
    let empNo = 0;
    combinedRows.forEach((r) => {
      const b = bucketForRow(r);
      if (b === 'not_soon') notSoon += 1;
      else if (b === 'retiring_soon') retiringSoon += 1;
      else if (b === 'at_retirement') atRet += 1;
      else if (b === 'app_no_profile') appNo += 1;
      else if (b === 'employee_no_profile') empNo += 1;
    });
    return [
      { name: 'Not retiring soon', value: notSoon, fill: CHART_COLORS.not_soon },
      { name: 'Retiring soon (55–59)', value: retiringSoon, fill: CHART_COLORS.retiring_soon },
      { name: 'At retirement / retired', value: atRet, fill: CHART_COLORS.at_retirement },
      { name: 'App users (no ETL age)', value: appNo, fill: CHART_COLORS.app_no_profile },
      { name: 'Employees (no DOB)', value: empNo, fill: CHART_COLORS.employee_no_profile },
    ].filter((d) => d.value > 0);
  }, [combinedRows]);

  const barChartData = useMemo(() => {
    const full = [
      { name: 'Not retiring soon', value: 0, fill: CHART_COLORS.not_soon },
      { name: 'Retiring soon', value: 0, fill: CHART_COLORS.retiring_soon },
      { name: 'At retirement', value: 0, fill: CHART_COLORS.at_retirement },
      { name: 'App users', value: 0, fill: CHART_COLORS.app_no_profile },
      { name: 'Emp. no DOB', value: 0, fill: CHART_COLORS.employee_no_profile },
    ];
    combinedRows.forEach((r) => {
      const b = bucketForRow(r);
      if (b === 'not_soon') full[0].value += 1;
      else if (b === 'retiring_soon') full[1].value += 1;
      else if (b === 'at_retirement') full[2].value += 1;
      else if (b === 'app_no_profile') full[3].value += 1;
      else if (b === 'employee_no_profile') full[4].value += 1;
    });
    return full;
  }, [combinedRows]);

  const filteredRows = useMemo(() => {
    const term = (searchTerm || '').toLowerCase().trim();
    return combinedRows.filter((r) => {
      const b = bucketForRow(r);
      if (retirementFilter !== BUCKET.ALL) {
        if (retirementFilter === BUCKET.RETIRING_SOON && b !== 'retiring_soon') return false;
        if (retirementFilter === BUCKET.NOT_SOON && b !== 'not_soon') return false;
        if (retirementFilter === BUCKET.AT_RETIREMENT && b !== 'at_retirement') return false;
        if (retirementFilter === BUCKET.APP_NO_PROFILE && b !== 'app_no_profile') return false;
        if (retirementFilter === BUCKET.EMPLOYEE_NO_PROFILE && b !== 'employee_no_profile') return false;
      }
      if (!term) return true;
      return (
        (r.name || '').toLowerCase().includes(term) ||
        String(r.username ?? '')
          .toLowerCase()
          .includes(term) ||
        (r.role || '').toLowerCase().includes(term) ||
        (r.faculty || '').toLowerCase().includes(term) ||
        (r.department || '').toLowerCase().includes(term) ||
        (r.retirementLabel || '').toLowerCase().includes(term)
      );
    });
  }, [combinedRows, searchTerm, retirementFilter]);

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

      {loadError && (
        <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
          {loadError} Employee retirement columns need ETL data.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Retirement overview
            </CardTitle>
            <CardDescription className="text-xs">
              ETL employees by retirement band; app users appear without age data
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {loading ? (
              <div className="flex h-[280px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No data to chart yet.</p>
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={88}
                      label={({ name, value }) => `${value}`}
                    >
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [v, 'Count']} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base font-semibold">Counts by category</CardTitle>
            <CardDescription className="text-xs">Bar view of the same groups</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {loading ? (
              <div className="flex h-[280px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={56} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [v, 'People']} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {barChartData.map((e, i) => (
                        <Cell key={i} fill={e.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-semibold">Users list</CardTitle>
          <CardDescription className="text-xs">
            Warehouse employees (with retirement) and system app users
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, username, role, faculty…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2 min-w-[220px]">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={retirementFilter}
                onChange={(e) => setRetirementFilter(e.target.value)}
                aria-label="Filter by retirement"
              >
                <option value={BUCKET.ALL}>All users</option>
                <option value={BUCKET.NOT_SOON}>Not retiring soon</option>
                <option value={BUCKET.RETIRING_SOON}>Retiring soon (55–59)</option>
                <option value={BUCKET.AT_RETIREMENT}>At retirement / retired</option>
                <option value={BUCKET.APP_NO_PROFILE}>App users only (no ETL profile)</option>
                <option value={BUCKET.EMPLOYEE_NO_PROFILE}>Employees only (missing DOB / age)</option>
              </select>
            </div>
            <Button type="button" onClick={loadData} variant="outline" className="shrink-0">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No users match this filter or search.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Name</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Username</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Role</th>
                    <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Age</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground min-w-[11rem]">
                      Retirement
                    </th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Faculty</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Department</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((s) => (
                    <tr key={s.key} className="border-b border-border/80 last:border-0 hover:bg-muted/30">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium">{s.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">{s.username ?? '—'}</td>
                      <td className="py-2.5 px-3">{s.role}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{s.age != null ? s.age : '—'}</td>
                      <td
                        className={`py-2.5 px-3 text-left leading-snug ${
                          s.retirementAlert ? 'text-red-600 dark:text-red-400 font-semibold' : ''
                        }`}
                      >
                        {s.retirementLabel || '—'}
                      </td>
                      <td className="py-2.5 px-3">{s.faculty || '—'}</td>
                      <td className="py-2.5 px-3">{s.department || '—'}</td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground">{s.source}</td>
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
