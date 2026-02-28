/**
 * Admin ETL Run Notifications - Dedicated page listing ETL runs with view/download PDF.
 * Data from same API as ETL Jobs so runs are real (no "not found").
 */
import React, { useState, useEffect } from 'react';
import { RefreshCw, FileText, Download, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { PageHeader, PageContent } from '../components/ui/page-header';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/modal';
import { LoadingState, ErrorState } from '../components/ui/state-messages';
import axios from 'axios';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { exportETLRunToPDF } from '../utils/exportUtils';

const DEFAULT_LIMIT = 200;

const AdminETLNotifications = () => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [viewLogRun, setViewLogRun] = useState(null);
  const [logContent, setLogContent] = useState('');
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState(null);
  const [pdfDownloading, setPdfDownloading] = useState(null);

  const loadStatus = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const response = await axios.get('/api/admin/system-status', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: { etl_runs_limit: DEFAULT_LIMIT },
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

  useEffect(() => {
    loadStatus();
  }, []);

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
      setError(err.message || 'Failed to download PDF');
    } finally {
      setPdfDownloading(null);
    }
  };

  const warehouse = status?.warehouse || {};
  const etlRuns = status?.etl_runs || [];

  if (loading) {
    return (
      <PageContent>
        <PageHeader title="ETL Run Notifications" description="View and download ETL run reports" />
        <LoadingState message="Loading ETL runs..." />
      </PageContent>
    );
  }

  if (error) {
    return (
      <PageContent>
        <PageHeader title="ETL Run Notifications" description="View and download ETL run reports" />
        <ErrorState message={error} retry={() => loadStatus(false)} />
      </PageContent>
    );
  }

  return (
    <PageContent>
      <PageHeader
        title="ETL Run Notifications"
        description="Recent ETL pipeline runs. View logs and download detailed reports (PDF)."
        actions={
          <Button variant="outline" onClick={() => loadStatus(false)} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" aria-hidden />
            Refresh
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            ETL runs ({etlRuns.length})
          </CardTitle>
          <CardDescription>
            One row per run. Use View to open the full log; use Download report (PDF) for a detailed report.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {etlRuns.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">No ETL runs found. Run ETL from ETL Jobs to generate runs.</p>
          ) : (
            <ul className="space-y-3">
              {etlRuns.map((run) => (
                <li key={run.log_file} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <div className="min-w-0">
                    <span className="font-mono text-sm font-medium block truncate">{run.log_file}</span>
                    <span className="text-muted-foreground text-sm">
                      {run.start_time || '—'} · {run.duration || '—'} ·{' '}
                      {run.success ? (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-4 w-4" /> Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600">
                          <XCircle className="h-4 w-4" /> Failed
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => openViewLog(run)} disabled={logLoading}>
                      {logLoading && viewLogRun?.log_file === run.log_file ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                      <span className="ml-1">View</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => downloadETLReportPDF(run)} disabled={!!pdfDownloading}>
                      {pdfDownloading === run.log_file ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      <span className="ml-1">Download report (PDF)</span>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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
