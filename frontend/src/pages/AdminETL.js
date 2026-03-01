/**
 * Admin ETL Jobs Page - ETL and Data Warehouse tracking for system admin
 */
import React, { useState, useEffect, useRef } from 'react';
import { Play, RefreshCw, Database, CheckCircle, XCircle, Clock, FileText, Download, Eye, BarChart3, Table2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { PageHeader, PageContent } from '../components/ui/page-header';
import { TableWrapper, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { LoadingState, ErrorState } from '../components/ui/state-messages';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/modal';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { exportETLRunToPDF } from '../utils/exportUtils';
import adminUIState from '../utils/adminUIState';
import { SciBarChart } from '../components/charts/EChartsComponents';
import CountdownTimer from '../components/admin/CountdownTimer';

const REFRESH_INTERVAL_MS = 5000;
const REFRESH_AFTER_RUN_COUNT = 12; // 12 * 5s = 60s of polling after Run ETL

const ETL_AUTO_INTERVAL_OPTIONS = [
  { value: 1, label: '1 min (test)' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 300, label: '5 hours' },
  { value: 600, label: '10 hours' },
  { value: 1440, label: '24 hours' },
];

const AdminETL = () => {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [etlMessage, setEtlMessage] = useState(null);
  const etlState = adminUIState.getSection('etl');
  const [etlRunsLimit, setEtlRunsLimitState] = useState(() => etlState.runsLimit ?? 5);
  const [etlPerPage, setEtlPerPageState] = useState(() => etlState.perPage ?? 20);
  const [etlPage, setEtlPageState] = useState(() => etlState.page ?? 1);
  const [dataViewMode, setDataViewModeState] = useState(() => etlState.dataViewMode ?? 'raw');
  const [warehouseFilter, setWarehouseFilterState] = useState(() => etlState.warehouseFilter ?? '');
  const [etlStatusFilter, setEtlStatusFilterState] = useState(() => etlState.etlStatusFilter ?? 'all');

  const setDataViewMode = (v) => {
    setDataViewModeState(v);
    adminUIState.setSection('etl', { dataViewMode: v });
  };
  const setWarehouseFilter = (v) => {
    setWarehouseFilterState(v);
    adminUIState.setSection('etl', { warehouseFilter: v });
  };
  const setEtlStatusFilter = (v) => {
    setEtlStatusFilterState(v);
    adminUIState.setSection('etl', { etlStatusFilter: v });
  };

  const setEtlRunsLimit = (v) => {
    setEtlRunsLimitState(v);
    adminUIState.setSection('etl', { runsLimit: v, page: 1 });
  };
  const setEtlPerPage = (v) => {
    setEtlPerPageState(v);
    adminUIState.setSection('etl', { perPage: v, page: 1 });
  };
  const setEtlPage = (v) => {
    setEtlPageState((prev) => {
      const next = typeof v === 'function' ? v(prev) : v;
      adminUIState.setSection('etl', { page: next });
      return next;
    });
  };

  const [adminSettings, setAdminSettings] = useState({});
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [countdownSec, setCountdownSec] = useState(null);
  const refreshIntervalRef = useRef(null);
  const [viewLogRun, setViewLogRun] = useState(null);
  const [logContent, setLogContent] = useState('');
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState(null);
  const [pdfDownloading, setPdfDownloading] = useState(null);

  const ETL_RUNS_LIMIT_OPTIONS = [
    { value: 5, label: '5 runs' },
    { value: 10, label: '10 runs' },
    { value: 15, label: '15 runs' },
    { value: 20, label: '20 runs' },
    { value: 30, label: '30 runs' },
    { value: 40, label: '40 runs' },
    { value: 50, label: '50 runs' },
    { value: 100, label: '100 runs' },
    { value: 9999, label: 'All' },
  ];
  const ETL_PER_PAGE_OPTIONS = [10, 20, 30, 50, 100];
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, []);

  // Countdown to next automatic ETL run
  useEffect(() => {
    if (!adminSettings.etl_auto_enabled) {
      setCountdownSec(null);
      return;
    }
    const intervalMinutes = Number(adminSettings.etl_auto_interval_minutes) || 60;
    const intervalSec = Math.max(60, Math.round(intervalMinutes * 60)); // min 1 min for test
    const lastRun = adminSettings.last_etl_auto_run; // Unix seconds
    const nowSec = Date.now() / 1000;
    const nextRunSec = lastRun != null ? lastRun + intervalSec : nowSec + intervalSec;

    const tick = () => {
      const now = Date.now() / 1000;
      const remaining = Math.max(0, Math.floor(nextRunSec - now));
      setCountdownSec(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [adminSettings.etl_auto_enabled, adminSettings.etl_auto_interval_minutes, adminSettings.last_etl_auto_run]);

  const loadSettings = async () => {
    try {
      const res = await axios.get('/api/admin/settings', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setAdminSettings(res.data?.settings ?? {});
    } catch {
      setAdminSettings({});
    }
  };

  const saveSettings = async (updates) => {
    const next = { ...adminSettings, ...updates };
    setSettingsSaving(true);
    try {
      await axios.put('/api/admin/settings', { settings: next }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setAdminSettings(next);
    } catch (err) {
      setEtlMessage(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  const formatCountdown = (sec) => {
    if (sec == null) return '—';
    if (sec <= 0) return 'Running soon…';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const loadStatus = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const params = { etl_runs_limit: etlRunsLimit };
      if (!silent) params._ = Date.now(); // cache bust so Refresh always gets fresh data
      const response = await axios.get('/api/admin/system-status', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params,
      });
      setStatus(response.data);
    } catch (err) {
      if (err.response?.status === 403) setError('Admin access required');
      else setError(err.response?.data?.error || err.message);
      setStatus(null);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadStatus(false);
  };

  useEffect(() => {
    loadStatus();
    loadSettings();
  }, [etlRunsLimit]);

  const warehouse = status?.warehouse || {};
  const etlRuns = status?.etl_runs || [];
  const sourceDbs = status?.source_databases || {};
  const etlRunsPaginated = etlRuns.slice((etlPage - 1) * etlPerPage, etlPage * etlPerPage);
  const etlTotalPages = Math.max(1, Math.ceil(etlRuns.length / etlPerPage));

  // When auto ETL is on: poll settings every 15s so countdown resets as soon as a run finishes
  useEffect(() => {
    if (!adminSettings.etl_auto_enabled) return;
    const id = setInterval(loadSettings, 15000);
    return () => clearInterval(id);
  }, [adminSettings.etl_auto_enabled]);

  // When auto ETL is on: poll status every 10s so run history and warehouse table auto-refresh
  useEffect(() => {
    if (!adminSettings.etl_auto_enabled) return;
    const id = setInterval(() => loadStatus(true), 10000);
    return () => clearInterval(id);
  }, [adminSettings.etl_auto_enabled]);

  const runETL = async () => {
    try {
      setRunning(true);
      setEtlMessage(null);
      const response = await axios.post('/api/admin/run-etl', {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setEtlMessage(response.data?.message || 'ETL started. Refreshing list every few seconds...');
      let count = 0;
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = setInterval(async () => {
        count += 1;
        await loadStatus(true);
        if (count >= REFRESH_AFTER_RUN_COUNT) {
          if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
          setEtlMessage(null);
        }
      }, REFRESH_INTERVAL_MS);
    } catch (err) {
      setEtlMessage(err.response?.data?.error || err.message || 'Failed to start ETL');
    } finally {
      setRunning(false);
    }
  };

  const fetchLogContent = async (filename) => {
    if (!filename) return null;
    try {
      const res = await axios.get(`/api/admin/etl-log/${encodeURIComponent(filename)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return res.data?.content ?? '';
    } catch (err) {
      throw new Error(err.response?.data?.error || err.message || 'Failed to load log');
    }
  };

  const openViewLog = async (run) => {
    setViewLogRun(run);
    setLogContent('');
    setLogError(null);
    setLogLoading(true);
    try {
      const content = await fetchLogContent(run.log_file);
      setLogContent(content);
    } catch (err) {
      setLogError(err.message || 'Failed to load log');
    } finally {
      setLogLoading(false);
    }
  };

  const closeViewLog = () => {
    setViewLogRun(null);
    setLogContent('');
    setLogError(null);
  };

  const downloadETLReportPDF = async (run) => {
    setPdfDownloading(run?.log_file ?? true);
    try {
      const content = await fetchLogContent(run.log_file);
      exportETLRunToPDF(run, content, status?.warehouse || {});
    } catch (err) {
      setEtlMessage(err.message || 'Failed to download PDF');
    } finally {
      setPdfDownloading(null);
    }
  };

  if (loading) {
    return (
      <PageContent>
        <PageHeader title="ETL & Data Warehouse" description="Track pipeline runs and data warehouse counts" />
        <LoadingState message="Loading system status..." />
      </PageContent>
    );
  }

  if (error) {
    return (
      <PageContent>
        <PageHeader title="ETL & Data Warehouse" description="Track pipeline runs and data warehouse counts" />
        <ErrorState message={error} retry={() => loadStatus(false)} />
      </PageContent>
    );
  }

  return (
    <PageContent>
      <PageHeader
        title="ETL & Data Warehouse"
        description="Track pipeline runs and data warehouse counts"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {status?.server_time && (
              <span className="text-xs text-muted-foreground font-mono tabular-nums border border-border rounded px-2 py-1 bg-muted/50" title="All times on this page use server time">
                Server time: {status.server_time}
              </span>
            )}
            <Button variant="outline" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" aria-hidden />
              Refresh
            </Button>
            <Button onClick={runETL} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden /> : <Play className="h-4 w-4 mr-2" aria-hidden />}
              Run ETL
            </Button>
          </div>
        }
      />

      {etlMessage && adminSettings.enableNotifications !== false && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
          {etlMessage}
        </div>
      )}

      {/* Automatic ETL */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Automatic ETL
          </CardTitle>
          <CardDescription>
            Run ETL on a schedule in addition to manual &quot;Run ETL&quot; above.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!adminSettings.etl_auto_enabled}
                onChange={(e) => saveSettings({ etl_auto_enabled: e.target.checked })}
                disabled={settingsSaving}
                className="h-4 w-4 rounded border-input"
                aria-label="Run ETL automatically"
              />
              <span className="text-sm font-medium">Run ETL automatically</span>
            </label>
            <div className="flex items-center gap-2">
              <Label htmlFor="etl-auto-interval" className="text-sm text-muted-foreground whitespace-nowrap">
                Interval:
              </Label>
              <Select
                id="etl-auto-interval"
                value={adminSettings.etl_auto_interval_minutes ?? 60}
                onChange={(e) => saveSettings({ etl_auto_interval_minutes: Number(e.target.value) })}
                disabled={settingsSaving}
                className="w-[160px]"
              >
                {ETL_AUTO_INTERVAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </div>
            {settingsSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />}
          </div>
          {adminSettings.etl_auto_enabled && (
            <div className="mt-4 pt-4 border-t border-border">
              <CountdownTimer seconds={countdownSec} title="Next ETL run" size="md" />
              <p className="text-center text-xs text-muted-foreground mt-2" title="Timer updates every second; resets after each run">
                Updates in real time · no refresh needed
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Source databases */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Source Databases
          </CardTitle>
          <CardDescription>Feeds for ETL pipeline (setup_databases.py)</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {Object.entries(sourceDbs).map(([db, label]) => (
              <li key={db} className="flex items-center gap-2">
                <span className="font-mono bg-muted px-2 py-0.5 rounded">{db}</span>
                <span className="text-muted-foreground">— {label}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Data view mode: Visual (charts + filters) or Raw (tables) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Data view</CardTitle>
          <CardDescription>Choose how to view warehouse and ETL run data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={dataViewMode === 'visual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDataViewMode('visual')}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Visual (charts & filters)
            </Button>
            <Button
              variant={dataViewMode === 'raw' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDataViewMode('raw')}
            >
              <Table2 className="h-4 w-4 mr-2" />
              Raw (tables)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data warehouse summary — Visual or Raw */}
      <Card>
        <CardHeader>
          <CardTitle>Data Warehouse (Gold Layer)</CardTitle>
          <CardDescription>UCU_DataWarehouse — dimension and fact table row counts</CardDescription>
        </CardHeader>
        <CardContent>
          {dataViewMode === 'visual' ? (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Label htmlFor="wh-filter" className="text-sm text-muted-foreground">Filter tables</Label>
                <Input
                  id="wh-filter"
                  placeholder="e.g. dim_ or fact_"
                  value={warehouseFilter}
                  onChange={(e) => setWarehouseFilter(e.target.value)}
                  className="max-w-xs"
                />
              </div>
              {(() => {
                const entries = Object.entries(warehouse).filter(([t]) => !warehouseFilter || t.toLowerCase().includes(warehouseFilter.toLowerCase()));
                const chartData = entries.map(([table, count]) => ({ name: table, value: count != null ? count : 0 }));
                if (chartData.length === 0) {
                  return <p className="text-muted-foreground text-sm py-4">No tables match the filter.</p>;
                }
                return (
                  <div className="h-[320px] min-h-[200px] w-full">
                    <SciBarChart
                      data={chartData}
                      xDataKey="name"
                      yDataKey="value"
                      xAxisLabel="Table"
                      yAxisLabel="Row count"
                      fillColor="#1e3a5f"
                      showGrid
                    />
                  </div>
                );
              })()}
            </>
          ) : (
            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Table</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(warehouse).map(([table, count]) => (
                    <TableRow key={table}>
                      <TableCell className="font-mono">{table}</TableCell>
                      <TableCell className="text-right">{count != null ? count.toLocaleString() : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          )}
        </CardContent>
      </Card>

      {/* ETL run history — Visual or Raw */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>ETL Run History</CardTitle>
              <CardDescription>One row per run (latest first). Use filters to choose how many to show.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm" htmlFor="etl-runs-limit">
                <span className="text-muted-foreground">Show last</span>
                <select
                  id="etl-runs-limit"
                  value={etlRunsLimit}
                  onChange={(e) => setEtlRunsLimit(Number(e.target.value))}
                  className="rounded border border-input bg-background px-2 py-1.5 text-sm h-9"
                  aria-label="Number of ETL runs to show"
                >
                  {ETL_RUNS_LIMIT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              {dataViewMode === 'visual' && (
                <label className="flex items-center gap-2 text-sm" htmlFor="etl-status-filter">
                  <span className="text-muted-foreground">Status</span>
                  <select
                    id="etl-status-filter"
                    value={etlStatusFilter}
                    onChange={(e) => setEtlStatusFilter(e.target.value)}
                    className="rounded border border-input bg-background px-2 py-1.5 text-sm h-9"
                  >
                    <option value="all">All</option>
                    <option value="success">Success</option>
                    <option value="failed">Failed</option>
                  </select>
                </label>
              )}
              {dataViewMode === 'raw' && (
                <label className="flex items-center gap-2 text-sm" htmlFor="etl-per-page">
                  <span className="text-muted-foreground">Per page</span>
                  <select
                    id="etl-per-page"
                    value={etlPerPage}
                    onChange={(e) => setEtlPerPage(Number(e.target.value))}
                    className="rounded border border-input bg-background px-2 py-1.5 text-sm h-9"
                    aria-label="Rows per page"
                  >
                    {ETL_PER_PAGE_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n}/page</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {etlRuns.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">No ETL log files found. Click Run ETL to add one run.</p>
          ) : dataViewMode === 'visual' ? (
            (() => {
              const filtered = etlStatusFilter === 'all'
                ? etlRuns
                : etlRuns.filter((r) => (etlStatusFilter === 'success' && r.success) || (etlStatusFilter === 'failed' && !r.success));
              const parseDurationSec = (d) => {
                if (!d || typeof d !== 'string') return 0;
                const parts = d.trim().split(':').map((p) => parseFloat(p, 10) || 0);
                if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
                if (parts.length === 1) return parts[0];
                return 0;
              };
              const chartData = filtered.slice(0, 30).map((run, i) => {
                const sec = parseDurationSec(run.duration);
                const label = run.log_file ? run.log_file.replace(/^etl_pipeline_|\.log$/gi, '').slice(-12) : `Run ${i + 1}`;
                return {
                  name: label,
                  success: run.success ? sec : 0,
                  failed: !run.success ? Math.max(sec, 0.1) : 0,
                };
              });
              if (chartData.length === 0) {
                return <p className="text-muted-foreground text-sm py-4">No runs match the status filter.</p>;
              }
              return (
                <>
                  <div className="h-[320px] min-h-[200px] w-full mb-4">
                    <SciBarChart
                      data={chartData}
                      xDataKey="name"
                      yDataKey="value"
                      yDataKeys={[
                        { key: 'success', label: 'Success (duration sec)', color: '#16a34a' },
                        { key: 'failed', label: 'Failed (duration sec)', color: '#ca8a04' },
                      ]}
                      xAxisLabel="Run"
                      yAxisLabel="Duration (sec)"
                      showGrid
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">Showing up to 30 runs. Use &quot;Raw (tables)&quot; for full list and actions (View, Download PDF).</p>
                </>
              );
            })()
          ) : (
            <>
              <TableWrapper>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Log file</TableHead>
                      <TableHead>Start time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {etlRunsPaginated.map((run) => (
                      <TableRow key={run.log_file}>
                        <TableCell className="font-mono">{run.log_file}</TableCell>
                        <TableCell>{run.start_time || '—'}</TableCell>
                        <TableCell>{run.duration || '—'}</TableCell>
                        <TableCell>
                          {run.success ? (
                            <span className="inline-flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" aria-hidden /> Success
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-600">
                              <XCircle className="h-4 w-4" aria-hidden /> Failed
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openViewLog(run)} disabled={logLoading}>
                              {logLoading && viewLogRun?.log_file === run.log_file ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                              View
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => downloadETLReportPDF(run)} disabled={!!pdfDownloading}>
                              {pdfDownloading === run.log_file ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                              Download PDF
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrapper>
              {etlRuns.length > etlPerPage && (
                <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t">
                  <span className="text-sm text-muted-foreground">
                    Showing {(etlPage - 1) * etlPerPage + 1}–{Math.min(etlPage * etlPerPage, etlRuns.length)} of {etlRuns.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEtlPage((p) => Math.max(1, p - 1))} disabled={etlPage <= 1}>
                      Previous
                    </Button>
                    <span className="text-sm tabular-nums">Page {etlPage} of {etlTotalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setEtlPage((p) => Math.min(etlTotalPages, p + 1))} disabled={etlPage >= etlTotalPages}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* View ETL log modal — fits viewport; header/footer fixed; only log area scrolls; responsive */}
      <Modal open={!!viewLogRun} onClose={closeViewLog} className="flex flex-col overflow-hidden max-w-4xl min-w-0">
        <ModalHeader onClose={closeViewLog} className="shrink-0">
          ETL log: {viewLogRun?.log_file || '—'}
        </ModalHeader>
        <ModalBody className="flex-1 min-h-0 overflow-auto p-3 sm:p-4">
          {logLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logError ? (
            <p className="text-destructive py-4">{logError}</p>
          ) : (
            <pre className="text-xs sm:text-sm font-mono bg-muted p-3 sm:p-4 rounded-md min-h-0 overflow-auto whitespace-pre-wrap break-words overflow-x-auto max-w-full">
              {logContent || 'No content'}
            </pre>
          )}
        </ModalBody>
        <ModalFooter className="shrink-0 flex-wrap gap-2 sm:gap-2">
          {!logLoading && !logError && viewLogRun && (
            <Button variant="outline" onClick={() => downloadETLReportPDF(viewLogRun)} disabled={!!pdfDownloading} className="min-h-9 touch-manipulation">
              {pdfDownloading === viewLogRun.log_file ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Download report (PDF)
            </Button>
          )}
          <Button variant="secondary" onClick={closeViewLog} className="min-h-9 touch-manipulation">Close</Button>
        </ModalFooter>
      </Modal>
    </PageContent>
  );
};
export default AdminETL;






