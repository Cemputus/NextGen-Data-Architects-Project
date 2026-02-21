/**
 * Admin ETL Jobs Page - ETL and Data Warehouse tracking for system admin
 */
import React, { useState, useEffect, useRef } from 'react';
import { Play, RefreshCw, Database, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { PageHeader, PageContent } from '../components/ui/page-header';
import { TableWrapper, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { LoadingState, ErrorState } from '../components/ui/state-messages';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

const REFRESH_INTERVAL_MS = 5000;
const REFRESH_AFTER_RUN_COUNT = 12; // 12 * 5s = 60s of polling after Run ETL

const AdminETL = () => {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [etlMessage, setEtlMessage] = useState(null);
  const [etlRunsLimit, setEtlRunsLimit] = useState(10);
  const refreshIntervalRef = useRef(null);

  const ETL_RUNS_LIMIT_OPTIONS = [5, 10, 20, 50];

  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, []);

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
  }, [etlRunsLimit]);

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
                {ETL_RUNS_LIMIT_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n} runs</option>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          )}
        </CardContent>
      </Card>
    </PageContent>
  );
};
export default AdminETL;






