/**
 * Reusable Audit Log section: filter (Show last N), search, table.
 * Used on the Audit Logs page and in the Admin Console "Audit Logs" tab.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Search, RefreshCw, BarChart3, Table2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { TableWrapper, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';
import { LoadingState, EmptyState, ErrorState } from '../ui/state-messages';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import adminUIState from '../../utils/adminUIState';
import { SciBarChart } from '../charts/EChartsComponents';

const AUDIT_LIMIT_OPTIONS = [5, 10, 20, 30, 40, 50, 100, 150, 200, 500, 'all'];

export default function AuditLogSection({
  showHeader = true,
  showSetupButton = true,
  compact = false,
  defaultLimit = 10,
  refreshTrigger,
}) {
  const auditState = adminUIState.getSection('audit');
  const getInitialLimit = () => {
    if (compact) return defaultLimit;
    const lim = auditState.limit;
    if (lim === 'all') return 'all';
    const n = Number(lim);
    if (!isNaN(n) && (AUDIT_LIMIT_OPTIONS.includes(n) || n === 500)) return n;
    return defaultLimit;
  };

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [message, setMessage] = useState(null);
  const [searchTerm, setSearchTermState] = useState(() => (compact ? '' : (auditState.searchTerm || '')));
  const [error, setError] = useState(null);
  const [settingUp, setSettingUp] = useState(false);
  const [logsLimit, setLogsLimit] = useState(getInitialLimit);
  const [dataViewMode, setDataViewModeState] = useState(() => (compact ? 'raw' : (auditState.dataViewMode || 'raw')));
  const [chartGroupBy, setChartGroupByState] = useState(() => (compact ? 'action' : (auditState.chartGroupBy || 'action')));

  const setDataViewMode = (v) => {
    setDataViewModeState(v);
    if (!compact) adminUIState.setSection('audit', { dataViewMode: v });
  };
  const setChartGroupBy = (v) => {
    setChartGroupByState(v);
    if (!compact) adminUIState.setSection('audit', { chartGroupBy: v });
  };

  const setSearchTerm = (v) => {
    setSearchTermState(v);
    if (!compact) adminUIState.setSection('audit', { searchTerm: v });
  };

  const loadLogs = async (limitToUse) => {
    const limit = limitToUse !== undefined ? limitToUse : logsLimit;
    try {
      setLoading(true);
      setError(null);
      
      // Convert limit to number (backend expects int)
      let requestLimit;
      if (limit === 'all') {
        requestLimit = 500; // Backend max
      } else {
        requestLimit = Number(limit);
        if (isNaN(requestLimit) || requestLimit < 1) {
          throw new Error(`Invalid limit: ${limit}`);
        }
        if (requestLimit > 500) {
          requestLimit = 500; // Cap at backend max
        }
      }

      const response = await axios.get('/api/admin/audit-logs', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: { limit: requestLimit },
      });
      
      const receivedLogs = response.data.logs || [];
      if (limit !== 'all' && receivedLogs.length > limit) {
        console.error(`[AuditLogSection] Received ${receivedLogs.length} logs but requested only ${limit}`);
      }
      
      setLogs(receivedLogs);
      setMessage(response.data.message || null);
    } catch (err) {
      console.error('[AuditLogSection] Error loading logs:', err);
      setError(err.response?.status === 403 ? 'Admin access required' : (err.response?.data?.error || err.message));
      setLogs([]);
      setMessage(null);
    } finally {
      setLoading(false);
    }
  };

  // Initial load on mount - use the initialized logsLimit state
  useEffect(() => {
    loadLogs(logsLimit);
  }, []); // Only run once on mount - loadLogs and logsLimit are stable

  // Refetch when parent requests a full-page refresh (e.g. Admin Console Refresh button)
  useEffect(() => {
    if (typeof refreshTrigger === 'number' && refreshTrigger > 0) {
      loadLogs(logsLimit);
    }
  }, [refreshTrigger]);

  // Persist limit changes (full page only)
  useEffect(() => {
    if (!compact && logsLimit !== undefined && logsLimit !== null) {
      adminUIState.setSection('audit', { limit: logsLimit });
    }
  }, [logsLimit, compact]);

  const setupAuditDb = async () => {
    try {
      setSettingUp(true);
      await axios.post('/api/admin/setup-audit-db', {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setMessage(null);
      await loadLogs(logsLimit);
    } catch (err) {
      setMessage(err.response?.data?.error || err.message || 'Setup failed');
    } finally {
      setSettingUp(false);
    }
  };

  const filteredLogs = useMemo(() => {
    if (!searchTerm.trim()) return logs;
    const term = searchTerm.toLowerCase();
    return logs.filter(
      (l) =>
        (l.username && l.username.toLowerCase().includes(term)) ||
        (l.action && l.action.toLowerCase().includes(term)) ||
        (l.resource && l.resource.toLowerCase().includes(term)) ||
        (l.role_name && l.role_name.toLowerCase().includes(term)) ||
        (l.status && l.status.toLowerCase().includes(term))
    );
  }, [logs, searchTerm]);

  const chartData = useMemo(() => {
    const keyMap = {
      action: (l) => l.action || '—',
      resource: (l) => l.resource || '—',
      user: (l) => l.username || '—',
      role: (l) => l.role_name || '—',
      status: (l) => l.status || '—',
    };
    const getKey = keyMap[chartGroupBy] || keyMap.action;
    const counts = {};
    filteredLogs.forEach((l) => {
      const k = String(getKey(l));
      counts[k] = (counts[k] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 25);
  }, [filteredLogs, chartGroupBy]);

  const handleLimitChange = async (e) => {
    const val = e.target.value;
    let newLimit;
    if (val === 'all') {
      newLimit = 'all';
    } else {
      newLimit = Number(val);
      if (isNaN(newLimit) || newLimit < 1) {
        console.error('[AuditLogSection] Invalid limit value:', val);
        return;
      }
    }
    setLogsLimit(newLimit);
    if (!compact) adminUIState.setSection('audit', { limit: newLimit });
    await loadLogs(newLimit);
  };

  const actionButtons = (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => loadLogs(logsLimit)} disabled={loading} size={compact ? 'sm' : 'default'}>
        <RefreshCw className="h-4 w-4 mr-2" aria-hidden />
        Refresh
      </Button>
      {showSetupButton && message && (
        <Button onClick={setupAuditDb} disabled={settingUp} size={compact ? 'sm' : 'default'}>
          {settingUp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden /> : null}
          Set up audit DB
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {(showHeader || showSetupButton) && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          {showHeader && (
            <div>
              <h2 className="text-xl font-semibold text-foreground">Audit Logs</h2>
              <p className="text-sm text-muted-foreground">System activity and security audit trail</p>
            </div>
          )}
          {actionButtons}
        </div>
      )}

      {message && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-3 text-sm text-amber-800">
            {message}
          </CardContent>
        </Card>
      )}

      {!compact && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">Data view</CardTitle>
            <CardDescription>Choose how to view audit log data</CardDescription>
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
                Raw (table)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className={compact ? 'py-3' : ''}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Audit Logs
              </CardTitle>
              <CardDescription>
                User actions, logins, and system events. Use the filter to choose how many entries to show.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Show last</span>
                <select
                  value={String(logsLimit)}
                  onChange={handleLimitChange}
                  disabled={loading}
                  className="rounded border border-input bg-background px-2 py-1.5 text-sm disabled:opacity-50"
                >
                  {AUDIT_LIMIT_OPTIONS.map((n) => (
                    <option key={n} value={String(n)}>
                      {n === 'all' ? 'All entries' : `${n} entries`}
                    </option>
                  ))}
                </select>
                {loading && <span className="text-xs text-muted-foreground">Loading...</span>}
              </label>
              {!compact && dataViewMode === 'visual' && (
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Group by</span>
                  <select
                    value={chartGroupBy}
                    onChange={(e) => setChartGroupBy(e.target.value)}
                    className="rounded border border-input bg-background px-2 py-1.5 text-sm"
                  >
                    <option value="action">Action</option>
                    <option value="resource">Resource</option>
                    <option value="user">User</option>
                    <option value="role">Role</option>
                    <option value="status">Status</option>
                  </select>
                </label>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className={compact ? 'py-3' : ''}>
          <div className="flex gap-2 mb-4">
            <Input
              type="search"
              placeholder="Search by user, action, resource, role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
              aria-label="Search audit logs"
            />
            <Button variant="secondary" size="icon" title="Search" aria-label="Search">
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {loading ? (
            <LoadingState message="Loading audit logs..." />
          ) : error ? (
            <ErrorState message={error} retry={() => loadLogs(logsLimit)} />
          ) : filteredLogs.length === 0 ? (
            <EmptyState
              message="No audit log entries found."
              hint="Set up the ucu_rbac database and audit_logs table for a full trail."
            />
          ) : !compact && dataViewMode === 'visual' ? (
            <>
              <div className="mb-2 text-xs text-muted-foreground">
                Showing top 25 groups from {filteredLogs.length} entries (limit: {logsLimit === 'all' ? 'all' : logsLimit}). Switch to Raw for full table.
              </div>
              <div className="h-[320px] min-h-[200px] w-full">
                <SciBarChart
                  data={chartData}
                  xDataKey="name"
                  yDataKey="value"
                  xAxisLabel={chartGroupBy === 'action' ? 'Action' : chartGroupBy === 'resource' ? 'Resource' : chartGroupBy === 'user' ? 'User' : chartGroupBy === 'role' ? 'Role' : 'Status'}
                  yAxisLabel="Count"
                  fillColor="#1e3a5f"
                  showGrid
                />
              </div>
            </>
          ) : (
            <>
              <div className="mb-2 text-xs text-muted-foreground">
                Showing {filteredLogs.length} of {logs.length} loaded entries {logsLimit !== 'all' ? `(limit: ${logsLimit})` : '(all)'}
              </div>
              <TableWrapper>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.log_id ?? `${log.created_at}-${log.username}`}>
                        <TableCell className="whitespace-nowrap">{log.created_at}</TableCell>
                        <TableCell>{log.username || '—'}</TableCell>
                        <TableCell>{log.role_name || '—'}</TableCell>
                        <TableCell>{log.action || '—'}</TableCell>
                        <TableCell>{log.resource || '—'}</TableCell>
                        <TableCell>
                          <span className={log.status === 'success' ? 'text-green-600' : log.status === 'failure' ? 'text-amber-600' : ''}>
                            {log.status || '—'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrapper>
            </>
          )}
        </CardContent>
      </Card>

      {compact && (
        <p className="text-xs text-muted-foreground">
          <Link to="/admin/audit" className="underline">Open full Audit Logs page</Link> for setup and full view.
        </p>
      )}
    </div>
  );
}
