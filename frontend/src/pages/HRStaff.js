/**
 * HR Staff Page — Staff management: users list, retirement filters, chart
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { usePersistedState } from '../hooks/usePersistedState';
import { Users, Plus, Search, Filter, RefreshCw, BarChart3, Table2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { TableWrapper, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { Loader2 } from 'lucide-react';
import axios from 'axios';
import adminUIState from '../utils/adminUIState';
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
  LabelList,
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

/** Normalize persisted / accidental filter values (string, number from old clients). */
function normalizeFilterKey(raw) {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (VALID_FILTER_VALUES.has(s)) return s;
  const aliases = {
    retiring: BUCKET.RETIRING_SOON,
    soon: BUCKET.RETIRING_SOON,
    far: BUCKET.NOT_SOON,
    retired: BUCKET.AT_RETIREMENT,
    app: BUCKET.APP_NO_PROFILE,
    employee: BUCKET.EMPLOYEE_NO_PROFILE,
  };
  if (aliases[s]) return aliases[s];
  return BUCKET.ALL;
}

const CHART_COLORS = {
  not_soon: '#22c55e',
  retiring_soon: '#ef4444',
  at_retirement: '#64748b',
  app_no_profile: '#94a3b8',
  employee_no_profile: '#cbd5e1',
};

/** Fixed order: same labels for pie, bar, and filter semantics */
const CATEGORY_ORDER = [
  'not_soon',
  'retiring_soon',
  'at_retirement',
  'app_no_profile',
  'employee_no_profile',
];

const CATEGORY_LABELS = {
  not_soon: 'Not retiring soon',
  retiring_soon: 'Retiring soon (55–59)',
  at_retirement: 'At retirement / retired',
  app_no_profile: 'App users (no ETL age)',
  employee_no_profile: 'Employees (missing DOB)',
};

/** Normalize API retirement_proximity (case, legacy / alternate backend values). */
function normalizeProximity(raw) {
  if (raw == null || raw === '') return '';
  const p = String(raw).trim().toLowerCase();
  if (p === 'null' || p === 'undefined' || p === 'none') return '';
  if (p === 'within_5_years' || p === 'within 5 years' || p === 'within5years') return 'approaching';
  if (p === 'near_retirement' || p === 'near retirement' || p === 'approaching_retirement') return 'approaching';
  return p;
}

/** API may send boolean, 0/1, or string. */
function isRetirementAlertFlag(raw) {
  if (raw === true || raw === 1) return true;
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }
  return false;
}

/**
 * Classify one row for filters & charts. Employees: by API proximity/alert/DOB; app users: always app bucket.
 */
function bucketForRow(row) {
  if (row.kind === 'app_user') return 'app_no_profile';
  const p = normalizeProximity(row.retirement_proximity ?? row.retirementProximity);
  const alert = isRetirementAlertFlag(row.retirement_alert ?? row.retirementAlert);
  if (!p && alert) return 'retiring_soon';
  if (!p) return 'employee_no_profile';
  if (p === 'approaching') return 'retiring_soon';
  if (p === 'far') return 'not_soon';
  if (p === 'retired') return 'at_retirement';
  return 'employee_no_profile';
}

/** Retirement dropdown: does this row's bucket match the selected filter? */
function rowMatchesRetirementFilter(bucket, filterKey) {
  const fk = normalizeFilterKey(filterKey);
  if (fk === BUCKET.ALL) return true;
  return bucket === fk;
}

/**
 * Search: all whitespace-separated tokens must appear somewhere in the row (AND).
 */
function rowMatchesSearch(row, termRaw) {
  const q = (termRaw ?? '').trim().toLowerCase();
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const b = row.bucket ?? bucketForRow(row);
  const parts = [
    row.name,
    row.username,
    row.role,
    row.faculty,
    row.department,
    row.retirementLabel,
    row.source,
    row.id,
    CATEGORY_LABELS[b],
    b,
  ].map((x) => String(x ?? '').toLowerCase());

  const haystack = parts.join(' \n ');
  return tokens.every((t) => haystack.includes(t));
}

const HRStaff = () => {
  const hrStaffPrefs = adminUIState.getSection('hrStaff');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [employeesList, setEmployeesList] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [searchTerm, setSearchTerm] = usePersistedState('hr_staff_searchTerm', '');
  const [retirementFilterRaw, setRetirementFilter] = usePersistedState('hr_staff_retirement_filter', BUCKET.ALL);
  const [dataViewMode, setDataViewModeState] = useState(() =>
    hrStaffPrefs.dataViewMode === 'visual' || hrStaffPrefs.dataViewMode === 'raw' ? hrStaffPrefs.dataViewMode : 'raw'
  );

  const setDataViewMode = (v) => {
    setDataViewModeState(v);
    adminUIState.setSection('hrStaff', { dataViewMode: v });
  };

  const retirementFilter = normalizeFilterKey(retirementFilterRaw);

  useEffect(() => {
    const canonical = normalizeFilterKey(retirementFilterRaw);
    if (canonical !== retirementFilterRaw) {
      setRetirementFilter(canonical);
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
    const fromEmp = (employeesList || []).map((e, i) => {
      const eid = e.employee_id;
      const row = {
        key: `emp-${eid != null ? eid : `i${i}`}`,
        kind: 'employee',
        id: eid,
        name: e.full_name,
        username: null,
        role: e.position_title || e.role_group || '—',
        faculty: e.faculty_name,
        department: e.department_name,
        source: 'Employee',
        age: e.age,
        retirementLabel: e.retirement_label ?? e.retirementLabel,
        retirement_proximity: e.retirement_proximity ?? e.retirementProximity,
        retirement_alert: e.retirement_alert ?? e.retirementAlert,
      };
      return { ...row, bucket: bucketForRow(row) };
    });
    const fromApp = (staffList || []).map((s, i) => {
      const row = {
        key: `app-${s.id != null ? s.id : `${s.username || 'u'}-${i}`}`,
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
        retirement_proximity: null,
        retirement_alert: false,
      };
      return { ...row, bucket: bucketForRow(row) };
    });
    return [...fromEmp, ...fromApp];
  }, [employeesList, staffList]);

  const filteredRows = useMemo(() => {
    return combinedRows.filter((r) => {
      const b = bucketForRow(r);
      if (!rowMatchesRetirementFilter(b, retirementFilter)) return false;
      return rowMatchesSearch({ ...r, bucket: b }, searchTerm);
    });
  }, [combinedRows, searchTerm, retirementFilter]);

  /** Charts & raw summary use the same filtered set (matches Audit / ETL pattern). */
  const categorySeries = useMemo(() => {
    const counts = Object.fromEntries(CATEGORY_ORDER.map((k) => [k, 0]));
    filteredRows.forEach((r) => {
      const k = bucketForRow(r);
      if (counts[k] !== undefined) counts[k] += 1;
    });
    return CATEGORY_ORDER.map((key) => ({
      key,
      name: CATEGORY_LABELS[key],
      value: counts[key],
      fill: CHART_COLORS[key],
    }));
  }, [filteredRows]);

  const pieChartData = useMemo(
    () => categorySeries.filter((d) => d.value > 0),
    [categorySeries]
  );

  const totalLoaded = combinedRows.length;
  const totalPeopleInView = filteredRows.length;

  const filterSummary = useMemo(() => {
    const label =
      retirementFilter === BUCKET.ALL ? 'All categories' : CATEGORY_LABELS[retirementFilter] || retirementFilter;
    return { label, showing: filteredRows.length, total: combinedRows.length };
  }, [retirementFilter, filteredRows.length, combinedRows.length]);

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

      <Card className="border shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-semibold">Data view</CardTitle>
          <CardDescription className="text-xs">
            Same pattern as Admin ETL Jobs and Audit Logs — Visual for charts; Raw for sortable tables
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={dataViewMode === 'visual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDataViewMode('visual')}
            >
              <BarChart3 className="h-4 w-4 mr-2" aria-hidden />
              Visual (charts &amp; filters)
            </Button>
            <Button
              type="button"
              variant={dataViewMode === 'raw' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDataViewMode('raw')}
            >
              <Table2 className="h-4 w-4 mr-2" aria-hidden />
              Raw (tables)
            </Button>
          </div>
        </CardContent>
      </Card>

      {dataViewMode === 'visual' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Retirement overview
              </CardTitle>
              <CardDescription className="text-xs">
                Pie reflects current search &amp; retirement filters ({totalPeopleInView} of {totalLoaded} people)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {loading ? (
                <div className="flex h-[280px] items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : totalLoaded === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No people loaded yet. Refresh or run ETL.</p>
              ) : pieChartData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No people match the current filters — adjust search or category filter.
                </p>
              ) : (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={88}
                        label={({ value }) => (value != null ? String(value) : '')}
                      >
                        {pieChartData.map((entry) => (
                          <Cell key={entry.key} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [v, 'People']} />
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
              <CardDescription className="text-xs">
                Bar view of the same groups as the pie — switch to Raw (tables) for exact counts in a grid
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {loading ? (
                <div className="flex h-[300px] items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : totalLoaded === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No people loaded yet. Refresh or run ETL.</p>
              ) : (
                <div className="h-[300px] w-full min-h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={categorySeries}
                      margin={{ top: 4, right: 36, left: 4, bottom: 4 }}
                      barCategoryGap="12%"
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted/80" horizontal={false} />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        domain={[0, 'dataMax + 1']}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={148}
                        tick={{ fontSize: 11 }}
                        interval={0}
                      />
                      <Tooltip
                        formatter={(v) => [v, 'People']}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ''}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                        {categorySeries.map((entry) => (
                          <Cell key={entry.key} fill={entry.fill} />
                        ))}
                        <LabelList
                          dataKey="value"
                          position="right"
                          formatter={(v) => (v > 0 ? String(v) : '')}
                          className="text-xs fill-foreground font-medium"
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-semibold">Users list</CardTitle>
          <CardDescription className="text-xs">
            Filters apply to both views. Charts (Visual) and tables (Raw) use the same filtered rows.
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

          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs text-muted-foreground">
            <span>
              Filter: <span className="font-medium text-foreground">{filterSummary.label}</span>
              {' · '}
              Showing <span className="font-medium text-foreground">{filterSummary.showing}</span> of{' '}
              <span className="font-medium text-foreground">{filterSummary.total}</span> rows
              {searchTerm.trim() ? ` matching “${searchTerm.trim()}”` : ''}
            </span>
            {(searchTerm.trim() || retirementFilter !== BUCKET.ALL) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setSearchTerm('');
                  setRetirementFilter(BUCKET.ALL);
                }}
              >
                Clear filters
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No users match this filter or search.
            </div>
          ) : dataViewMode === 'visual' ? (
            <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Table hidden in Visual mode</p>
              <p>
                Select <span className="font-medium text-foreground">Raw (tables)</span> in Data view above to see
                category counts and the full user directory in table form (same as ETL / Audit raw mode).
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Counts by category</h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Same groups as the bar chart — {totalPeopleInView} people in current filter
                </p>
                <TableWrapper>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categorySeries.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell>{row.name}</TableCell>
                          <TableCell className="text-right tabular-nums font-mono">
                            {row.value.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableWrapper>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">User rows</h3>
                <TableWrapper>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Age</TableHead>
                        <TableHead>Retirement</TableHead>
                        <TableHead>Faculty</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((s) => (
                        <TableRow key={s.key}>
                          <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                            {CATEGORY_LABELS[s.bucket] || s.bucket}
                          </TableCell>
                          <TableCell className="font-medium">
                            <span className="inline-flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                              {s.name}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{s.username ?? '—'}</TableCell>
                          <TableCell>{s.role}</TableCell>
                          <TableCell className="text-right tabular-nums">{s.age != null ? s.age : '—'}</TableCell>
                          <TableCell
                            className={
                              isRetirementAlertFlag(s.retirement_alert ?? s.retirementAlert)
                                ? 'text-red-600 dark:text-red-400 font-semibold'
                                : ''
                            }
                          >
                            {s.retirementLabel || '—'}
                          </TableCell>
                          <TableCell>{s.faculty || '—'}</TableCell>
                          <TableCell>{s.department || '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{s.source}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableWrapper>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HRStaff;
