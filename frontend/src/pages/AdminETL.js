/**
 * Admin ETL Jobs Page - ETL and Data Warehouse tracking for system admin
 */
import React, { useState, useEffect, useRef } from 'react';
import { Play, RefreshCw, Database, CheckCircle, XCircle, Clock, FileText, Download, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { PageHeader, PageContent } from '../components/ui/page-header';
import { TableWrapper, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { LoadingState, ErrorState } from '../components/ui/state-messages';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/modal';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { exportETLRunToPDF } from '../utils/exportUtils';

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
  const [etlRunsLimit, setEtlRunsLimit] = useState(10);
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
    { value: 20, label: '20 runs' },
    { value: 50, label: '50 runs' },
    { value: 100, label: '100 runs' },
    { value: 150, label: '150 runs' },
    { value: 200, label: '200 runs' },
    { value: 250, label: '250 runs' },
    { value: 500, label: '500 runs' },
    { value: 9999, label: 'All' },
  ];
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

  const warehouse = status?.warehouse || {};
  const etlRuns = status?.etl_runs || [];
  const sourceDbs = status?.source_databases || {};

  return (
    <PageContent>
      <PageHeader
        title="ETL & Data Warehouse"
        description="Track pipeline runs and data warehouse counts"
        actions={
          <div className="flex gap-2">
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

      {etlMessage && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
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
            {adminSettings.etl_auto_enabled && (
              <span className="text-sm font-mono tabular-nums text-muted-foreground border border-border rounded-md px-3 py-1.5 bg-muted/50" title="Time until next automatic ETL run">
                Next run in {formatCountdown(countdownSec)}
              </span>
            )}
            {settingsSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />}
          </div>
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

      {/* Data warehouse summary — same style as setup/ETL output */}
      <Card>
        <CardHeader>
          <CardTitle>Data Warehouse (Gold Layer)</CardTitle>
          <CardDescription>UCU_DataWarehouse — dimension and fact table row counts</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* ETL run history */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>ETL Run History</CardTitle>
              <CardDescription>One row per run (latest first). Use the filter to choose how many to show.</CardDescription>
            </div>
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
          </div>
        </CardHeader>
        <CardContent>
          {etlRuns.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">No ETL log files found. Click Run ETL to add one run.</p>
          ) : (
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
                  {etlRuns.map((run) => (
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
          )}
        </CardContent>
      </Card>

      {/* View ETL log modal */}
      <Modal open={!!viewLogRun} onClose={closeViewLog}>
        <ModalHeader onClose={closeViewLog}>
          ETL log: {viewLogRun?.log_file || '—'}
        </ModalHeader>
        <ModalBody>
          {logLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logError ? (
            <p className="text-destructive py-4">{logError}</p>
          ) : (
            <pre className="text-xs font-mono bg-muted p-4 rounded-md max-h-[70vh] overflow-auto whitespace-pre-wrap break-words">
              {logContent || 'No content'}
            </pre>
          )}
        </ModalBody>
        <ModalFooter>
          {!logLoading && !logError && viewLogRun && (
            <Button variant="outline" onClick={() => downloadETLReportPDF(viewLogRun)} disabled={!!pdfDownloading}>
              {pdfDownloading === viewLogRun.log_file ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Download report (PDF)
            </Button>
          )}
          <Button variant="secondary" onClick={closeViewLog}>Close</Button>
        </ModalFooter>
      </Modal>
    </PageContent>
  );
};
export default AdminETL;






