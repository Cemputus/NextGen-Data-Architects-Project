/**
 * Admin ETL Jobs Page - ETL and Data Warehouse tracking for system admin
 */
import React, { useState, useEffect, useRef } from 'react';
import { Play, RefreshCw, Database, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
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
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-muted-foreground">Loading system status...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">ETL Jobs</h1>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {error}
          </CardContent>
        </Card>
      </div>
    );
  }

  const warehouse = status?.warehouse || {};
  const etlRuns = status?.etl_runs || [];
  const sourceDbs = status?.source_databases || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ETL & Data Warehouse</h1>
          <p className="text-muted-foreground">Track pipeline runs and data warehouse counts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={runETL} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Run ETL
          </Button>
        </div>
      </div>

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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Table</th>
                  <th className="text-right py-2 font-medium">Count</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(warehouse).map(([table, count]) => (
                  <tr key={table} className="border-b border-muted/50">
                    <td className="py-2 font-mono">{table}</td>
                    <td className="text-right py-2">{count != null ? count.toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Show last</span>
              <select
                value={etlRunsLimit}
                onChange={(e) => setEtlRunsLimit(Number(e.target.value))}
                className="rounded border border-input bg-background px-2 py-1.5 text-sm"
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Log file</th>
                    <th className="text-left py-2 font-medium">Start time</th>
                    <th className="text-left py-2 font-medium">Duration</th>
                    <th className="text-left py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {etlRuns.map((run) => (
                    <tr key={run.log_file} className="border-b border-muted/50">
                      <td className="py-2 font-mono text-muted-foreground">{run.log_file}</td>
                      <td className="py-2">{run.start_time || '—'}</td>
                      <td className="py-2">{run.duration || '—'}</td>
                      <td className="py-2">
                        {run.success ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" /> Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <XCircle className="h-4 w-4" /> Failed
                          </span>
                        )}
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

export default AdminETL;






