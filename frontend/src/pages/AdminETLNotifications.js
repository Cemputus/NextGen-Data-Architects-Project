/**
 * Admin Notifications - ETL runs, user & system activity. Organized like Console (Users, Settings, ETL Jobs, Audit).
 * Read state: viewing or downloading an ETL run marks it read; count decreases in sidebar.
 */
import React, { useState, useEffect } from 'react';
import { RefreshCw, FileText, Download, Eye, Database, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { PageHeader, PageContent } from '../components/ui/page-header';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { LoadingState, ErrorState } from '../components/ui/state-messages';
import axios from 'axios';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { exportETLRunToPDF } from '../utils/exportUtils';
import adminUIState from '../utils/adminUIState';

const ADMIN_ETL_READ_KEY = 'admin_etl_read_logs';

const LIMIT_OPTIONS = [
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: 15, label: '15' },
  { value: 20, label: '20' },
  { value: 30, label: '30' },
  { value: 40, label: '40' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
  { value: 9999, label: 'All' },
];
const PER_PAGE_OPTIONS = [10, 20, 30, 50, 100];

const getReadLogs = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(ADMIN_ETL_READ_KEY) || '[]'));
  } catch {
    return new Set();
  }
};

const markAsRead = (logFile) => {
  const read = getReadLogs();
  read.add(logFile);
  localStorage.setItem(ADMIN_ETL_READ_KEY, JSON.stringify([...read]));
  window.dispatchEvent(new Event('admin-etl-read-update'));
};

const AdminETLNotifications = () => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [error, setError] = useState(null);
  const [viewLogRun, setViewLogRun] = useState(null);
  const [logContent, setLogContent] = useState('');
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState(null);
  const [pdfDownloading, setPdfDownloading] = useState(null);
  const [downloadError, setDownloadError] = useState(null);
  const notifState = adminUIState.getSection('notifications');
  const [etlLimit, setEtlLimitState] = useState(() => notifState.limit ?? 5);
  const [etlPage, setEtlPageState] = useState(() => notifState.page ?? 1);
  const [etlPerPage, setEtlPerPageState] = useState(() => notifState.perPage ?? 20);

  const setEtlLimit = (v) => {
    setEtlLimitState(v);
    adminUIState.setSection('notifications', { limit: v, page: 1 });
  };
  const setEtlPerPage = (v) => {
    setEtlPerPageState(v);
    adminUIState.setSection('notifications', { perPage: v, page: 1 });
  };
  const setEtlPage = (v) => {
    setEtlPageState((prev) => {
      const next = typeof v === 'function' ? v(prev) : v;
      adminUIState.setSection('notifications', { page: next });
      return next;
    });
  };

  const [readLogs, setReadLogs] = useState(getReadLogs());

  const refreshReadLogs = () => setReadLogs(new Set(JSON.parse(localStorage.getItem(ADMIN_ETL_READ_KEY) || '[]')));

  useEffect(() => {
    const onReadUpdate = () => refreshReadLogs();
    window.addEventListener('admin-etl-read-update', onReadUpdate);
    return () => window.removeEventListener('admin-etl-read-update', onReadUpdate);
  }, []);

  const loadStatus = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const [statusRes, auditRes] = await Promise.all([
        axios.get('/api/admin/system-status', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          params: { etl_runs_limit: etlLimit },
        }),
        axios.get('/api/admin/audit-logs', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          params: { limit: 100 },
        }),
      ]);
      setStatus(statusRes.data);
      setAuditLogs(auditRes.data?.logs || []);
    } catch (err) {
      if (err.response?.status === 403) setError('Admin access required');
      else setError(err.response?.data?.error || err.message);
      setStatus(null);
      setAuditLogs([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [etlLimit]);

  const fetchLogContent = async (filename) => {
    if (!filename) return null;
    const res = await axios.get(`/api/admin/etl-log/${encodeURIComponent(filename)}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    return res.data?.content ?? '';
  };

  const openViewLog = async (run) => {
    setViewLogRun(run);
    setLogContent('');
    setLogError(null);
    setLogLoading(true);
    markAsRead(run.log_file);
    refreshReadLogs();
    try {
      const content = await fetchLogContent(run.log_file);
      setLogContent(content);
    } catch (err) {
      const msg = err.response?.status === 404
        ? 'Log file not found. It may have been removed from the server.'
        : (err.response?.data?.error || err.message || 'Failed to load log');
      setLogError(msg);
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
    setDownloadError(null);
    markAsRead(run.log_file);
    refreshReadLogs();
    try {
      const content = await fetchLogContent(run.log_file);
      exportETLRunToPDF(run, content, status?.warehouse || {});
    } catch (err) {
      const msg = err.response?.status === 404
        ? 'Log file not found. It may have been removed from the server.'
        : (err.response?.data?.error || err.message || 'Failed to download PDF');
      setDownloadError(msg);
    } finally {
      setPdfDownloading(null);
    }
  };

  const warehouse = status?.warehouse || {};
  const etlRuns = status?.etl_runs || [];
  const etlPaginated = etlRuns.slice((etlPage - 1) * etlPerPage, etlPage * etlPerPage);
  const etlTotalPages = Math.max(1, Math.ceil(etlRuns.length / etlPerPage));
  const unreadCount = etlRuns.filter((r) => !readLogs.has(r.log_file)).length;

  if (loading && !status) {
    return (
      <PageContent>
        <PageHeader title="Notifications" description="ETL runs and system activity" />
        <LoadingState message="Loading notifications..." />
      </PageContent>
    );
  }

  if (error && !status) {
    return (
      <PageContent>
        <PageHeader title="Notifications" description="ETL runs and system activity" />
        <ErrorState message={error} retry={() => loadStatus(false)} />
      </PageContent>
    );
  }

  return (
    <PageContent>
      <PageHeader
        title="Notifications"
        description="ETL runs, user creation and updates, system and warehouse activity."
        actions={
          <Button variant="outline" onClick={() => loadStatus(false)} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" aria-hidden />
            Refresh
          </Button>
        }
      />

      <Tabs defaultValue="etl" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="etl" className="gap-2">
            <Database className="h-4 w-4" />
            ETL Runs
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary text-primary-foreground text-xs px-1.5 font-medium">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Users className="h-4 w-4" />
            User & System Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="etl" className="space-y-4">
          {downloadError && (
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50 px-4 py-2 text-sm text-amber-800 dark:text-amber-200 flex items-center justify-between gap-2">
              <span>{downloadError}</span>
              <button type="button" onClick={() => setDownloadError(null)} className="shrink-0 underline">Dismiss</button>
            </div>
          )}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    ETL pipeline runs
                  </CardTitle>
                  <CardDescription>
                    View logs and download reports. Unread: {unreadCount}. Count decreases when you view or download.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Show last</span>
                    <select
                      value={etlLimit}
                      onChange={(e) => setEtlLimit(Number(e.target.value))}
                      className="rounded border border-input bg-background px-2 py-1.5 text-sm h-9"
                    >
                      {LIMIT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Per page</span>
                    <select
                      value={etlPerPage}
                      onChange={(e) => setEtlPerPage(Number(e.target.value))}
                      className="rounded border border-input bg-background px-2 py-1.5 text-sm h-9"
                    >
                      {PER_PAGE_OPTIONS.map((n) => (
                        <option key={n} value={n}>{n}/page</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {etlRuns.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4">No ETL runs found. Run ETL from ETL Jobs to generate runs.</p>
              ) : (
                <>
                  <ul className="space-y-2">
                    {etlPaginated.map((run) => {
                      const isRead = readLogs.has(run.log_file);
                      return (
                        <li
                          key={run.log_file}
                          className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border px-3 py-3 sm:px-4 ${isRead ? 'border-border bg-muted/20' : 'border-primary/30 bg-primary/5'}`}
                        >
                          <div className="min-w-0 flex items-center gap-2 flex-1">
                            {!isRead && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5 sm:mt-0" aria-hidden />}
                            <div className="min-w-0 flex-1">
                              <span className="font-mono text-sm font-medium block truncate" title={run.log_file}>{run.log_file}</span>
                              <span className="text-muted-foreground text-xs sm:text-sm">
                                {run.start_time || '—'} · {run.duration || '—'} ·{' '}
                                {run.success ? (
                                  <span className="inline-flex items-center gap-1 text-green-600">
                                    <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> Success
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-amber-600">
                                    <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> Failed
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            <Button variant="outline" size="sm" onClick={() => openViewLog(run)} disabled={logLoading} className="min-h-9 touch-manipulation">
                              {logLoading && viewLogRun?.log_file === run.log_file ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Eye className="h-4 w-4 shrink-0" />}
                              <span className="ml-1">View</span>
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => downloadETLReportPDF(run)} disabled={!!pdfDownloading} className="min-h-9 touch-manipulation">
                              {pdfDownloading === run.log_file ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Download className="h-4 w-4 shrink-0" />}
                              <span className="ml-1">Download PDF</span>
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
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
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User & system activity
              </CardTitle>
              <CardDescription>
                Login, user creation, updates, ETL started, and other audit events.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4">No audit logs. Set up audit DB in Settings or Audit Logs page.</p>
              ) : (
                <ul className="space-y-2 max-h-[60vh] overflow-auto">
                  {auditLogs.map((log, i) => (
                    <li key={log.log_id ?? i} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
                      <span className="font-mono text-xs text-muted-foreground">
                        {log.created_at || '—'}
                      </span>
                      <span className="font-medium">{log.action || '—'}</span>
                      <span className="text-muted-foreground">{log.resource || ''}</span>
                      {log.resource_id && <span className="text-muted-foreground font-mono text-xs">{log.resource_id}</span>}
                      {log.username && <span className="text-muted-foreground">by {log.username}</span>}
                      {log.role_name && <span className="text-muted-foreground">({log.role_name})</span>}
                      {log.status && <span className={log.status === 'success' ? 'text-green-600' : 'text-amber-600'}>{log.status}</span>}
                      {log.error_message && <span className="text-destructive text-xs truncate">{log.error_message}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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

export default AdminETLNotifications;
