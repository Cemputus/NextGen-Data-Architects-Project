/**
 * NextGen Query - Advanced SQL Analytics Workspace (Analyst only)
 * Three-panel layout: SQL editor (top), table results (bottom-left), chart (bottom-right)
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Editor } from '@monaco-editor/react';
import { Database, Play, Trash2, History, Loader2, BarChart3, LineChart, PieChart, AreaChart, Download, AlertTriangle, RefreshCw, Share2, Settings2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { PageHeader, PageContent } from '../components/ui/page-header';
import { Select } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/modal';
import { SciBarChart, SciLineChart, SciAreaChart, SciDonutChart } from '../components/charts/EChartsComponents';
import { useTheme } from '../context/ThemeContext';
import { usePersistentToast } from '../context/PersistentToastContext';
import { usePersistedState } from '../hooks/usePersistedState';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';

const DEFAULT_SQL = `-- Example: basic student performance slice
SELECT
  ds.program_id,
  COUNT(DISTINCT ds.student_id) AS total_students,
  ROUND(AVG(fg.grade), 2) AS avg_grade
FROM dim_student ds
LEFT JOIN fact_grade fg ON ds.student_id = fg.student_id
WHERE fg.exam_status = 'Completed'
GROUP BY ds.program_id
ORDER BY avg_grade DESC
LIMIT 100;`;

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const FALLBACK_ROLES = ['Student', 'Staff', 'HOD', 'Dean', 'Senate', 'Finance', 'HR', 'Analyst', 'Sysadmin'];

const NextGenQueryPage = () => {
  const { effectiveTheme } = useTheme();
  const { addToast } = usePersistentToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [query, setQuery] = useState(DEFAULT_SQL);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { columns, rows, row_count, elapsed_ms }

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [columnFilters, setColumnFilters] = useState({});

  const [chartType, setChartType] = useState('bar');
  const [xColumn, setXColumn] = useState('');
  const [yColumn, setYColumn] = useState('');

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTitle, setAssignTitle] = usePersistedState('nextgen_assign_title', '');
  const [assignTargetType, setAssignTargetType] = usePersistedState('nextgen_assign_targetType', 'role');
  const [assignTargetValue, setAssignTargetValue] = usePersistedState('nextgen_assign_targetValue', '');
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assignSuccessBanner, setAssignSuccessBanner] = useState('');
  const [targetOptions, setTargetOptions] = useState({ roles: [], users: [] });
  const [targetOptionsLoading, setTargetOptionsLoading] = useState(false);
  const [assignUserSearch, setAssignUserSearch] = usePersistedState('nextgen_assign_userSearch', '');
  const hasRestoredRef = useRef(false);
  const editingVizIdRef = useRef(null);
  const [editingVizId, setEditingVizId] = useState(null);
  const [manageAssignedOpen, setManageAssignedOpen] = useState(false);
  const [myAssignedList, setMyAssignedList] = useState([]);
  const [manageAssignedLoading, setManageAssignedLoading] = useState(false);
  const [manageAssignedError, setManageAssignedError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const columns = result?.columns || [];
  const rows = result?.rows || [];

  const rolesForSelect = (targetOptions.roles && targetOptions.roles.length > 0) ? targetOptions.roles : FALLBACK_ROLES;

  const filteredAndGroupedUsers = useMemo(() => {
    const users = targetOptions.users || [];
    const term = (assignUserSearch || '').trim().toLowerCase();
    const filtered = term
      ? users.filter(
          (u) =>
            (u.username || '').toLowerCase().includes(term) ||
            (u.role || '').toLowerCase().includes(term) ||
            (u.full_name || '').toLowerCase().includes(term)
        )
      : users;
    const byRole = {};
    filtered.forEach((u) => {
      const role = (u.role || '—').trim();
      if (!byRole[role]) byRole[role] = [];
      byRole[role].push(u);
    });
    return Object.entries(byRole).sort((a, b) => a[0].localeCompare(b[0]));
  }, [targetOptions.users, assignUserSearch]);

  const numericColumns = useMemo(
    () => columns.filter((c) => c.is_numeric),
    [columns]
  );

  // When navigating from Managed shared Charts (Edit), prefill SQL and chart settings; keep viz id for update-in-place
  useEffect(() => {
    const editViz = location.state?.editViz;
    if (editViz && editViz.id) {
      editingVizIdRef.current = editViz.id;
      setEditingVizId(editViz.id);
      if (typeof editViz.queryText === 'string' && editViz.queryText.trim()) {
        setQuery(editViz.queryText.trim());
        if (editViz.chartType) setChartType(editViz.chartType);
        if (editViz.xColumn) setXColumn(editViz.xColumn);
        if (editViz.yColumn) setYColumn(editViz.yColumn);
      }
      if (editViz.title) setAssignTitle(editViz.title);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.editViz]);

  // Restore persisted NextGen Query workspace from backend (per-user, survives hard refresh / logout / devices)
  useEffect(() => {
    const token = sessionStorage.getItem('ucu_session_token');
    if (!token) {
      hasRestoredRef.current = true;
      return;
    }
    axios
      .get('/api/auth/state/nextgen_query', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const state = res.data?.state;
        if (state && !location.state?.editViz) {
          if (typeof state.query === 'string' && state.query.trim().length > 0) {
            setQuery(state.query);
          }
          if (Array.isArray(state.history)) {
            setHistory(state.history);
          }
          if (state.chartType) setChartType(state.chartType);
          if (state.xColumn) setXColumn(state.xColumn);
          if (state.yColumn) setYColumn(state.yColumn);
          if (state.result && state.result.columns) {
            setResult(state.result);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        hasRestoredRef.current = true;
      });
  }, []);

  useEffect(() => {
    // When new results arrive, reset paging and choose sensible defaults for chart axes
    setPage(1);
    setSortCol(null);
    setSortDir('asc');
    setColumnFilters({});

    if (columns.length > 0) {
      const firstNumeric = numericColumns[0]?.name || '';
      const firstNonNumeric = columns.find((c) => !c.is_numeric)?.name || columns[0].name;
      setXColumn((prev) => prev || firstNonNumeric);
      setYColumn((prev) => prev || firstNumeric);
    }
  }, [columns, numericColumns]);

  // Persist visualization (chart type + axes) and full workspace when they change so it survives hard refresh
  useEffect(() => {
    if (!hasRestoredRef.current) return;
    const token = sessionStorage.getItem('ucu_session_token');
    if (!token) return;
    const t = setTimeout(() => {
      const stateToSave = {
        query,
        history,
        chartType,
        xColumn,
        yColumn,
        result: result
          ? { ...result, rows: Array.isArray(result.rows) ? result.rows.slice(0, 200) : [] }
          : null,
      };
      axios
        .put('/api/auth/state/nextgen_query', { state: stateToSave }, { headers: { Authorization: `Bearer ${token}` } })
        .catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [chartType, xColumn, yColumn, query, history, result]);

  const openAssignModal = () => {
    setAssignError('');
    setAssignSuccessBanner('');
    setAssignModalOpen(true);
    setTargetOptionsLoading(true);
    const suggestedTitle = [yColumn, xColumn].filter(Boolean).length === 2
      ? `${yColumn} by ${xColumn}`
      : '';
    if (!assignTitle.trim()) setAssignTitle(suggestedTitle);
    axios
      .get('/api/query/assigned-visualizations/target-options', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
      })
      .then((res) => {
        const roles = Array.isArray(res.data?.roles) ? res.data.roles.map((r) => String(r).trim()).filter(Boolean) : [];
        const users = Array.isArray(res.data?.users) ? res.data.users : [];
        setTargetOptions({ roles, users });
        if (!assignTargetValue.trim() && roles.length > 0) setAssignTargetValue(roles[0]);
        else if (!assignTargetValue.trim() && users.length > 0) setAssignTargetValue(String(users[0]?.username ?? '').trim());
      })
      .catch(() => setTargetOptions({ roles: [], users: [] }))
      .finally(() => setTargetOptionsLoading(false));
  };

  const openManageAssigned = () => {
    setManageAssignedOpen(true);
    setMyAssignedList([]);
    setManageAssignedError('');
    setManageAssignedLoading(true);
    axios
      .get('/api/query/assigned-visualizations?created_by=me', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
      })
      .then((res) => setMyAssignedList(res.data?.visualizations || []))
      .catch(() => setMyAssignedList([]))
      .finally(() => setManageAssignedLoading(false));
  };

  const deleteAssigned = async (vizId) => {
    setDeletingId(vizId);
    try {
      await axios.delete(`/api/query/assigned-visualizations/${vizId}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
      });
      setMyAssignedList((prev) => prev.filter((v) => v.id !== vizId));
    } catch (err) {
      setManageAssignedError(err.response?.data?.error || err.message || 'Failed to remove.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleAssignSubmit = async () => {
    const title = assignTitle.trim();
    const targetValue = assignTargetValue.trim();
    const isUpdatingExisting = editingVizIdRef.current;

    if (!isUpdatingExisting && !title) {
      setAssignError('Enter a title for this visualization.');
      return;
    }
    if (!isUpdatingExisting && !targetValue) {
      setAssignError('Select a role or an app user.');
      return;
    }
    setAssignSaving(true);
    setAssignError('');
    try {
      const resultSnapshot = result
        ? { columns: result.columns, rows: (result.rows || []).slice(0, 200), row_count: result.row_count }
        : null;

      if (isUpdatingExisting) {
        await axios.put(
          `/api/query/assigned-visualizations/${editingVizIdRef.current}`,
          {
            title: title || undefined,
            query,
            chartType,
            xColumn,
            yColumn,
            resultSnapshot,
          },
          {
            headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
            timeout: 30000,
          }
        );
        editingVizIdRef.current = null;
        setEditingVizId(null);
        setAssignModalOpen(false);
        setAssignTitle('');
        const msg = 'Chart updated. The shared visualization now shows your latest query and results.';
        setAssignSuccessBanner(msg);
        addToast(msg, 'success');
        setTimeout(() => setAssignSuccessBanner(''), 5000);
        return;
      }

      await axios.post(
        '/api/query/assigned-visualizations',
        {
          title,
          targetType: assignTargetType,
          targetValue,
          query,
          chartType,
          xColumn,
          yColumn,
          resultSnapshot,
        },
        {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
          timeout: 30000,
        }
      );
      setAssignModalOpen(false);
      setAssignTitle('');
      setAssignTargetType('role');
      setAssignTargetValue('');
      setAssignUserSearch('');
      const targetLabel = assignTargetType === 'role' ? `Role "${targetValue}"` : `User "${targetValue}"`;
      const msg = `Visualization assigned to ${targetLabel}. Recipients will see it under "Views shared with you" on their dashboard.`;
      setAssignSuccessBanner(msg);
      addToast(msg, 'success');
      setTimeout(() => setAssignSuccessBanner(''), 5000);
    } catch (err) {
      const msg = err.response?.data?.error
        ? err.response.data.error
        : err.code === 'ECONNABORTED'
          ? 'Request timed out. Try again.'
          : err.message === 'Network Error' || !err.response
            ? 'Cannot reach server. Ensure the backend is running and try again.'
            : err.message || (editingVizIdRef.current ? 'Failed to update chart.' : 'Failed to assign visualization.');
      setAssignError(msg);
    } finally {
      setAssignSaving(false);
    }
  };

  const handleRun = async () => {
    setError('');

    // Build new history entry (most recent first, deduped)
    const trimmed = query.trim();
    let newHistory = history;
    if (trimmed) {
      const withoutDupes = history.filter((q) => q.trim() !== trimmed);
      newHistory = [trimmed, ...withoutDupes].slice(0, 20);
      setHistory(newHistory);
    }

    setLoading(true);
    try {
      const response = await axios.post(
        '/api/query/execute',
        { query },
        {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        }
      );
      const resultData = response.data || null;
      setResult(resultData);

      // Persist workspace state to backend so it survives logout/login and across devices
      const token = sessionStorage.getItem('ucu_session_token');
      if (token) {
        const stateToSave = {
          query,
          history: newHistory,
          chartType,
          xColumn,
          yColumn,
          // Persist a truncated snapshot of results to avoid huge payloads
          result: resultData
            ? {
                ...resultData,
                rows: Array.isArray(resultData.rows)
                  ? resultData.rows.slice(0, 200)
                  : [],
              }
            : null,
        };
        axios
          .put(
            '/api/auth/state/nextgen_query',
            { state: stateToSave },
            { headers: { Authorization: `Bearer ${token}` } }
          )
          .catch(() => {});
      }
    } catch (err) {
      let msg =
        err.response?.data?.error ||
        err.message ||
        'Failed to execute query. Please try again.';
      if (typeof msg === 'string' && (msg.toLowerCase().includes('timeout') || msg.includes('statement_timeout'))) {
        msg = 'Query timed out after 8 seconds. Try narrowing your query or adding a LIMIT.';
      }
      setError(msg);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setError('');
    setResult(null);
    setColumnsAndChartDefaults([]);
  };

  const setColumnsAndChartDefaults = (cols) => {
    if (!cols || cols.length === 0) {
      setXColumn('');
      setYColumn('');
      return;
    }
    const numeric = cols.filter((c) => c.is_numeric);
    const firstNumeric = numeric[0]?.name || '';
    const firstNonNumeric = cols.find((c) => !c.is_numeric)?.name || cols[0].name;
    setXColumn(firstNonNumeric);
    setYColumn(firstNumeric);
  };

  const handleHistorySelect = (value) => {
    if (!value) return;
    const idx = Number(value);
    if (!Number.isNaN(idx) && history[idx]) {
      setQuery(history[idx]);
    }
  };

  const processedRows = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    let data = [...rows];

    // Column filters
    Object.entries(columnFilters).forEach(([colName, filter]) => {
      const value = String(filter || '').trim().toLowerCase();
      if (!value) return;
      data = data.filter((row) =>
        String(row[colName] ?? '').toLowerCase().includes(value)
      );
    });

    // Sorting
    if (sortCol) {
      data.sort((a, b) => {
        const av = a[sortCol];
        const bv = b[sortCol];
        if (av == null && bv == null) return 0;
        if (av == null) return sortDir === 'asc' ? -1 : 1;
        if (bv == null) return sortDir === 'asc' ? 1 : -1;
        if (typeof av === 'number' && typeof bv === 'number') {
          return sortDir === 'asc' ? av - bv : bv - av;
        }
        return sortDir === 'asc'
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
    }

    return data;
  }, [rows, columnFilters, sortCol, sortDir]);

  const totalPages = Math.max(
    1,
    Math.ceil((processedRows.length || 0) / pageSize)
  );
  const pageRows = processedRows.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const handleHeaderClick = (colName) => {
    if (sortCol === colName) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(colName);
      setSortDir('asc');
    }
  };

  const handleExport = (format) => {
    if (!columns.length || !processedRows.length) return;

    const exportRows = processedRows;
    if (format === 'csv') {
      const header = columns.map((c) => `"${c.name}"`).join(',');
      const lines = exportRows.map((row) =>
        columns
          .map((c) => {
            const v = row[c.name];
            if (v == null) return '""';
            const s = String(v).replace(/"/g, '""');
            return `"${s}"`;
          })
          .join(',')
      );
      const csv = [header, ...lines].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'nextgen_query_results.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }

    // Excel via xlsx
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'nextgen_query_results.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const chartData = useMemo(() => {
    if (!result || !rows.length || !xColumn || !yColumn) return [];

    // Build data for charts and defensively filter out bad values
    const mapped = rows.map((row, index) => {
      const rawVal = row[yColumn];
      const numVal = Number(rawVal);
      return {
        category: row[xColumn] ?? `Row ${index + 1}`,
        value: Number.isFinite(numVal) ? numVal : 0,
      };
    });

    // If everything is zero, ECharts can behave oddly with tooltips; ensure at least one non-zero if possible
    const hasNonZero = mapped.some((d) => d.value !== 0);
    const safeData = hasNonZero ? mapped : mapped.map((d, idx) => ({ ...d, value: idx === 0 ? 1 : 0 }));

    // Hard cap to avoid massive charts causing runtime glitches
    return safeData.slice(0, 500);
  }, [result, rows, xColumn, yColumn]);

  const monacoTheme = effectiveTheme === 'dark' ? 'vs-dark' : 'vs-light';

  return (
    <PageContent>
      <PageHeader
        title="NextGen Query"
        description="Advanced SQL workspace for analysts – write queries, explore results, and visualize data."
        actions={
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Query history</span>
                <Select
                  value=""
                  onChange={(e) => handleHistorySelect(e.target.value)}
                  className="h-9 w-48 border border-input bg-background text-xs rounded-md"
                >
                  <option value="">Select…</option>
                  {history.map((q, idx) => (
                    <option value={idx} key={idx}>
                      {q.slice(0, 60).replace(/\s+/g, ' ')}
                      {q.length > 60 ? '…' : ''}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
        }
      />
      {assignSuccessBanner && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/40 px-4 py-3 text-sm text-green-800 dark:text-green-200 flex items-center justify-between gap-4 mb-4">
          <span>{assignSuccessBanner}</span>
          <button type="button" onClick={() => setAssignSuccessBanner('')} className="shrink-0 text-green-600 dark:text-green-400 hover:underline">Dismiss</button>
        </div>
      )}
      {/* Top: SQL editor */}
      <Card className="border border-input shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-primary" />
              Read-only SQL Workspace
            </CardTitle>
            <CardDescription className="text-xs">
              Trusted analyst SQL workspace against the data warehouse. Only SELECT/WITH queries are allowed — data changes (INSERT, UPDATE, DELETE, DDL) are blocked here.
              To pin visualizations into role dashboards: Analyst → Dashboards → Edit content → NextGen Query visualizations.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={loading}
              className="gap-1"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRun}
              disabled={loading || !query.trim()}
              className="gap-1"
            >
              <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleRun}
              disabled={loading || !query.trim()}
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-[260px] border border-input rounded-lg overflow-hidden">
            <Editor
              height="100%"
              defaultLanguage="sql"
              theme={monacoTheme}
              value={query}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                automaticLayout: true,
                wordWrap: 'on',
              }}
              onChange={(value) => setQuery(value ?? '')}
            />
          </div>
          <div className="mt-3">
            <p className="text-[11px] font-medium text-muted-foreground mb-1">Validation / errors</p>
            {error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-start gap-2">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : result ? (
              <p className="text-[11px] text-muted-foreground">
                {result.row_count ?? 0} row(s) returned in {result.elapsed_ms ?? 0} ms.
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">No errors. Run a query to see results.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bottom: Results + Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {/* Results table */}
        <Card className="border border-input shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold">
                Query Results
              </CardTitle>
              <CardDescription className="text-xs">
                Tabular results with sorting, column filters, and export.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onChange={(e) => {
                  setPageSize(Number(e.target.value) || 25);
                  setPage(1);
                }}
                className="h-8 w-20 text-xs border border-input rounded-md bg-background"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}/pg
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!columns.length || !processedRows.length}
                onClick={() => handleExport('csv')}
                className="gap-1 text-xs"
              >
                <Download className="h-3 w-3" />
                CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!columns.length || !processedRows.length}
                onClick={() => handleExport('excel')}
                className="gap-1 text-xs"
              >
                <Download className="h-3 w-3" />
                Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto border-t border-border">
              {columns.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  Run a query to see results here.
                </div>
              ) : (
                <table className="min-w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      {columns.map((col) => (
                        <th
                          key={col.name}
                          className={cn(
                            'px-3 py-2 text-left font-semibold border-b border-border cursor-pointer select-none',
                            sortCol === col.name && 'text-primary'
                          )}
                          onClick={() => handleHeaderClick(col.name)}
                        >
                          <div className="flex items-center gap-1">
                            <span>{col.name}</span>
                            {sortCol === col.name && (
                              <span>{sortDir === 'asc' ? '▲' : '▼'}</span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                    <tr className="bg-background/80">
                      {columns.map((col) => (
                        <th key={`${col.name}-filter`} className="px-3 py-1 border-b border-border">
                          <input
                            type="text"
                            value={columnFilters[col.name] || ''}
                            onChange={(e) =>
                              setColumnFilters((prev) => ({
                                ...prev,
                                [col.name]: e.target.value,
                              }))
                            }
                            placeholder="Filter…"
                            className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/40'}
                      >
                        {columns.map((col) => (
                          <td
                            key={col.name}
                            className="px-3 py-1.5 border-b border-border whitespace-nowrap max-w-[220px] overflow-hidden text-ellipsis"
                          >
                            {row[col.name] == null ? '' : String(row[col.name])}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {pageRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={columns.length}
                          className="px-3 py-4 text-center text-muted-foreground"
                        >
                          No rows match the current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
            {columns.length > 0 && (
              <div className="flex items-center justify-between px-3 py-2 text-[11px] text-muted-foreground border-t border-border">
                <span>
                  Rows {processedRows.length === 0 ? 0 : (page - 1) * pageSize + 1}–
                  {Math.min(page * pageSize, processedRows.length)} of{' '}
                  {processedRows.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-7 px-2 text-[11px]"
                  >
                    Prev
                  </Button>
                  <span>
                    Page {page} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={page === totalPages}
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    className="h-7 px-2 text-[11px]"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Visualization */}
        <Card className="border border-input shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold">
                Visualization
              </CardTitle>
              <CardDescription className="text-xs">
                Choose a chart type and axes. Numeric columns are available for
                value selection.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
                className="h-8 w-28 text-xs border border-input rounded-md bg-background"
              >
                <option value="bar">Bar</option>
                <option value="line">Line</option>
                <option value="area">Area</option>
                <option value="pie">Pie</option>
              </Select>
              <Select
                value={xColumn || ''}
                onChange={(e) => setXColumn(e.target.value)}
                className="h-8 w-32 text-xs border border-input rounded-md bg-background"
              >
                <option value="">X axis…</option>
                {columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Select
                value={yColumn || ''}
                onChange={(e) => setYColumn(e.target.value)}
                className="h-8 w-32 text-xs border border-input rounded-md bg-background"
              >
                <option value="">Y/numeric…</option>
                {numericColumns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                disabled={!result || !rows.length || !xColumn || !yColumn}
                onClick={openAssignModal}
                title="Assign this visualization to a role or user"
              >
                <Share2 className="h-3.5 w-3.5" />
                Assign to role or user
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 text-xs text-muted-foreground"
                onClick={openManageAssigned}
                title="View and manage visualizations you have assigned"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Manage assigned
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {!result || !rows.length || !xColumn || !yColumn ? (
              <div className="h-[260px] flex flex-col items-center justify-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                <p className="font-medium mb-1">No visualization yet</p>
                <p>Select X and Y columns after running a query.</p>
              </div>
            ) : (
              <div className="h-[280px]">
                {chartType === 'bar' && (
                  <SciBarChart
                    data={chartData}
                    xDataKey="category"
                    yDataKey="value"
                    xAxisLabel={xColumn}
                    yAxisLabel={yColumn}
                  />
                )}
                {chartType === 'line' && (
                  <SciLineChart
                    data={chartData}
                    xDataKey="category"
                    yDataKey="value"
                    xAxisLabel={xColumn}
                    yAxisLabel={yColumn}
                  />
                )}
                {chartType === 'area' && (
                  <SciAreaChart
                    data={chartData}
                    xDataKey="category"
                    yDataKey="value"
                    xAxisLabel={xColumn}
                    yAxisLabel={yColumn}
                  />
                )}
                {chartType === 'pie' && (
                  <SciDonutChart
                    data={chartData}
                    nameKey="category"
                    valueKey="value"
                    title={`${yColumn} by ${xColumn}`}
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal open={assignModalOpen} onClose={() => !assignSaving && setAssignModalOpen(false)} className="flex flex-col overflow-hidden max-w-2xl min-w-0">
        <ModalHeader onClose={() => !assignSaving && setAssignModalOpen(false)} className="shrink-0">
          {editingVizId ? 'Update shared chart' : 'Share visualization'}
        </ModalHeader>
        <ModalBody className="flex-1 min-h-0 overflow-auto p-3 sm:p-4">
          {editingVizId && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mb-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
              Updating existing chart. Run your SQL, then save here to replace the shared visualization with the new query and results.
            </p>
          )}
          <p className="text-sm text-muted-foreground mb-3">
            Choose who should see this visualization under <strong>&quot;Views shared with you&quot;</strong> on their dashboard. You can share it with an entire <strong>role</strong> or a specific <strong>app user</strong>.
          </p>
          {result && xColumn && yColumn && (
            <div className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground mb-4 border border-border">
              <span className="font-medium text-foreground">This visualization:</span>{' '}
              {chartType === 'pie' ? 'Pie' : chartType === 'line' ? 'Line' : chartType === 'area' ? 'Area' : 'Bar'} chart — <span className="font-mono">{yColumn}</span> by <span className="font-mono">{xColumn}</span>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="assign-viz-title" className="block text-sm font-medium text-foreground mb-1.5">Title</label>
              <Input
                id="assign-viz-title"
                value={assignTitle}
                onChange={(e) => setAssignTitle(e.target.value)}
                placeholder="e.g. Program performance summary"
                className="w-full"
                aria-describedby="assign-viz-title-hint"
              />
              <p id="assign-viz-title-hint" className="text-xs text-muted-foreground mt-1">Shown to recipients on their dashboard.</p>
            </div>
            <div>
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-foreground mb-2">Share with</legend>
                {targetOptionsLoading ? (
                  <p className="text-sm text-muted-foreground py-2">Loading roles and users…</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="assignTargetType"
                          value="role"
                          checked={assignTargetType === 'role'}
                          onChange={() => {
                            setAssignTargetType('role');
                            setAssignTargetValue(rolesForSelect[0] || '');
                          }}
                          className="rounded-full border-input"
                        />
                        <span className="text-sm">Entire role (all users with this role)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="assignTargetType"
                          value="user"
                          checked={assignTargetType === 'user'}
                          onChange={() => {
                            const users = targetOptions.users || [];
                            const first = users[0] && String(users[0].username ?? '').trim();
                            setAssignTargetType('user');
                            setAssignTargetValue(first || '');
                          }}
                          className="rounded-full border-input"
                        />
                        <span className="text-sm">Specific app user</span>
                      </label>
                    </div>
                    <div className="pt-1">
                      {assignTargetType === 'role' ? (
                        <label htmlFor="assign-target-role" className="block">
                          <span className="sr-only">Role</span>
                          <select
                            id="assign-target-role"
                            value={assignTargetValue}
                            onChange={(e) => setAssignTargetValue(e.target.value)}
                            className="flex h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="Select role"
                          >
                            <option value="">Select role…</option>
                            {rolesForSelect.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <div className="space-y-2">
                          <label htmlFor="assign-user-search" className="block text-xs text-muted-foreground">
                            Search by username, role, or full name
                          </label>
                          <Input
                            id="assign-user-search"
                            type="search"
                            placeholder="Search users…"
                            value={assignUserSearch}
                            onChange={(e) => setAssignUserSearch(e.target.value)}
                            className="w-full max-w-md"
                            autoComplete="off"
                          />
                          <div className="border border-input rounded-md max-h-[min(14rem,35vh)] overflow-auto bg-background overscroll-contain">
                            {(targetOptions.users || []).length === 0 ? (
                              <p className="text-sm text-muted-foreground p-3">No app users found. Add users in Admin → Users.</p>
                            ) : filteredAndGroupedUsers.length === 0 ? (
                              <p className="text-sm text-muted-foreground p-3">No users match your search.</p>
                            ) : (
                              filteredAndGroupedUsers.map(([roleName, roleUsers]) => (
                                <div key={roleName} className="border-b border-border last:border-b-0">
                                  <div className="sticky top-0 bg-muted/80 px-3 py-1.5 text-[11px] font-semibold text-foreground uppercase tracking-wide border-b border-border">
                                    {roleName}
                                  </div>
                                  <div className="divide-y divide-border">
                                    {roleUsers.map((u) => {
                                      const username = String(u.username ?? '').trim();
                                      if (!username) return null;
                                      const label = u.full_name ? `${u.full_name} (${username})` : username;
                                      const isSelected = assignTargetValue === username;
                                      return (
                                        <button
                                          key={username}
                                          type="button"
                                          onClick={() => setAssignTargetValue(username)}
                                          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/60 focus:bg-muted/60 focus:outline-none flex items-center justify-between gap-2 ${
                                            isSelected ? 'bg-primary/10 text-primary font-medium' : ''
                                          }`}
                                        >
                                          <span className="truncate">{label}</span>
                                          {u.role && (
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                              {u.role}
                                            </span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                          {assignTargetValue && assignTargetType === 'user' && (
                            <p className="text-xs text-muted-foreground">
                              Selected user:&nbsp;
                              <span className="font-medium text-foreground">{assignTargetValue}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </fieldset>
            </div>
            {assignError && (
              <p className="text-sm text-destructive flex items-center gap-1.5" role="alert">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {assignError}
              </p>
            )}
          </div>
        </ModalBody>
        <ModalFooter className="shrink-0 flex-wrap gap-2">
          <Button variant="secondary" onClick={() => !assignSaving && setAssignModalOpen(false)} disabled={assignSaving}>
            Cancel
          </Button>
          <Button onClick={handleAssignSubmit} disabled={assignSaving || !assignTitle.trim() || !assignTargetValue.trim()}>
            {assignSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Share2 className="h-4 w-4 mr-2" />}
            {editingVizId ? 'Update chart' : 'Assign visualization'}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal open={manageAssignedOpen} onClose={() => setManageAssignedOpen(false)}>
        <ModalHeader onClose={() => setManageAssignedOpen(false)}>
          Manage assigned visualizations
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-muted-foreground mb-4">
            Visualizations you have assigned to a role or user. Recipients see them under &quot;Views shared with you&quot; on their dashboard.
          </p>
          {manageAssignedLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : myAssignedList.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">You have not assigned any visualizations yet.</p>
          ) : (
            <>
              {manageAssignedError && (
                <p className="text-sm text-destructive flex items-center gap-1.5 mb-3" role="alert">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {manageAssignedError}
                </p>
              )}
              <ul className="space-y-3 max-h-[60vh] overflow-auto">
              {myAssignedList.map((viz) => (
                <li key={viz.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{viz.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {viz.targetType === 'role' ? 'Role' : 'User'}: {viz.targetValue} · {viz.chartType || 'bar'} · {viz.xColumn && viz.yColumn ? `${viz.yColumn} by ${viz.xColumn}` : '—'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-destructive hover:bg-destructive/10"
                    disabled={deletingId === viz.id}
                    onClick={() => deleteAssigned(viz.id)}
                  >
                    {deletingId === viz.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    <span className="ml-1">Remove</span>
                  </Button>
                </li>
              ))}
              </ul>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setManageAssignedOpen(false)}>Close</Button>
        </ModalFooter>
      </Modal>
    </PageContent>
  );
};

export default NextGenQueryPage;

