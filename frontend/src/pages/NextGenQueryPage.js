/**
 * NextGen Query - Advanced SQL Analytics Workspace (Analyst only)
 * Three-panel layout: SQL editor (top), table results (bottom-left), chart (bottom-right)
 */
import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { Editor } from '@monaco-editor/react';
import { Database, Play, Trash2, History, Loader2, BarChart3, LineChart, PieChart, AreaChart, Download, AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { PageHeader, PageContent } from '../components/ui/page-header';
import { Select } from '../components/ui/select';
import { SciBarChart, SciLineChart, SciAreaChart, SciDonutChart } from '../components/charts/EChartsComponents';
import { useTheme } from '../context/ThemeContext';
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

const NextGenQueryPage = () => {
  const { effectiveTheme } = useTheme();

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

  const columns = result?.columns || [];
  const rows = result?.rows || [];

  const numericColumns = useMemo(
    () => columns.filter((c) => c.is_numeric),
    [columns]
  );

  // Restore persisted NextGen Query workspace from backend (per-user, survives logout/login)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    axios
      .get('/api/auth/state/nextgen_query', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const state = res.data?.state;
        if (!state) return;
        if (typeof state.query === 'string' && state.query.trim().length > 0) {
          setQuery(state.query);
        }
        if (Array.isArray(state.history)) {
          setHistory(state.history);
        }
        if (state.chartType) setChartType(state.chartType);
        if (state.xColumn) setXColumn(state.xColumn);
        if (state.yColumn) setYColumn(state.yColumn);
        if (state.result) setResult(state.result);
      })
      .catch(() => {});
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
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );
      const resultData = response.data || null;
      setResult(resultData);

      // Persist workspace state to backend so it survives logout/login and across devices
      const token = localStorage.getItem('token');
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
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Failed to execute query. Please try again.';
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
              <Select
                value=""
                onChange={(e) => handleHistorySelect(e.target.value)}
                className="h-9 w-48 border border-input bg-background text-xs rounded-md"
              >
                <option value="">Query history…</option>
                {history.map((q, idx) => (
                  <option value={idx} key={idx}>
                    {q.slice(0, 60).replace(/\s+/g, ' ')}
                    {q.length > 60 ? '…' : ''}
                  </option>
                ))}
              </Select>
            )}
          </div>
        }
      />

      {/* Top: SQL editor */}
      <Card className="border border-input shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-primary" />
              SQL Workspace
            </CardTitle>
            <CardDescription className="text-xs">
              Trusted analyst SQL workspace against the data warehouse. All SQL
              statements are allowed; use with care.
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
          {error && (
            <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-start gap-2">
              <AlertTriangle className="h-3 w-3 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {result && !error && (
            <p className="mt-2 text-xs text-muted-foreground">
              {result.row_count ?? 0} row(s) returned in {result.elapsed_ms ?? 0} ms.
            </p>
          )}
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
    </PageContent>
  );
};

export default NextGenQueryPage;

