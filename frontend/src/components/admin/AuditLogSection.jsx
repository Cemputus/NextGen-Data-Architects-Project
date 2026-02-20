/**
 * Reusable Audit Log section: filter (Show last N), search, table.
 * Used on the Audit Logs page and in the Admin Console "Audit Logs" tab.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Search, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

const AUDIT_LIMIT_OPTIONS = [5, 10, 20, 30, 40, 50, 100, 150, 200, 500, 'all'];

export default function AuditLogSection({ showHeader = true, showSetupButton = true, compact = false, defaultLimit = 10 }) {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [message, setMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [settingUp, setSettingUp] = useState(false);
  
  // Use separate storage keys for console vs full page
  const storageKey = compact ? 'auditLogsLimitConsole' : 'auditLogsLimit';
  
  // Initialize from localStorage or defaultLimit
  // For console (compact=true), always use defaultLimit (5) on first load, then persist changes
  const getInitialLimit = () => {
    // Console always starts with defaultLimit (5), full page uses stored or defaultLimit (10)
    if (compact) {
      return defaultLimit; // Console always starts with 5
    }
    // Full page: check localStorage first
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null && stored !== '') {
        if (stored === 'all') return 'all';
        const num = Number(stored);
        if (!isNaN(num) && AUDIT_LIMIT_OPTIONS.includes(num)) return num;
      }
    } catch (e) {
      console.error('[AuditLogSection] Error reading localStorage:', e);
    }
    return defaultLimit;
  };
  
  const [logsLimit, setLogsLimit] = useState(getInitialLimit);

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
      
      console.log(`[AuditLogSection] Loading logs with limit: ${requestLimit} (from ${limit})`);
      
      const response = await axios.get('/api/admin/audit-logs', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: { limit: requestLimit },
      });
      
      const receivedLogs = response.data.logs || [];
      const backendLimit = response.data.limit;
      console.log(`[AuditLogSection] Received ${receivedLogs.length} logs (requested ${requestLimit}, backend limit: ${backendLimit})`);
      
      if (limit !== 'all' && receivedLogs.length > limit) {
        console.error(`[AuditLogSection] ERROR: Received ${receivedLogs.length} logs but requested only ${limit}!`);
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
    const initialLimit = getInitialLimit();
    console.log(`[AuditLogSection] Component mounted. Initial limit from storage/default: ${initialLimit}, state logsLimit: ${logsLimit}`);
    // Load with the state value (which should match initialLimit)
    loadLogs(logsLimit);
  }, []); // Only run once on mount - loadLogs and logsLimit are stable

  // Persist limit changes to localStorage
  useEffect(() => {
    try {
      if (logsLimit !== undefined && logsLimit !== null) {
        localStorage.setItem(storageKey, String(logsLimit));
        console.log(`[AuditLogSection] Saved limit ${logsLimit} to ${storageKey}`);
      }
    } catch (e) {
      console.error('[AuditLogSection] Error saving to localStorage:', e);
    }
  }, [logsLimit, storageKey]);

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
    console.log(`[AuditLogSection] Filter dropdown changed from "${logsLimit}" to "${newLimit}"`);
    console.log(`[AuditLogSection] Calling loadLogs(${newLimit}) immediately...`);
    setLogsLimit(newLimit);
    // CRITICAL: Load immediately with the new limit value
    await loadLogs(newLimit);
    console.log(`[AuditLogSection] loadLogs(${newLimit}) completed`);
  };

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Audit Logs</h2>
            <p className="text-muted-foreground text-sm">System activity and security audit trail</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => loadLogs(logsLimit)} disabled={loading} size={compact ? 'sm' : 'default'}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            {showSetupButton && message && (
              <Button onClick={setupAuditDb} disabled={settingUp} size={compact ? 'sm' : 'default'}>
                {settingUp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Set up audit DB
              </Button>
            )}
          </div>
        </div>
      )}

      {message && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-3 text-sm text-amber-800">
            {message}
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
          </div>
        </CardHeader>
        <CardContent className={compact ? 'py-3' : ''}>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Search by user, action, resource, role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Button variant="secondary" size="icon" title="Search">
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-muted-foreground">{error}</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No audit log entries found. Set up the <code className="bg-muted px-1 rounded">ucu_rbac</code> database and <code className="bg-muted px-1 rounded">audit_logs</code> table for a full trail.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="mb-2 text-xs text-muted-foreground">
                Showing {filteredLogs.length} of {logs.length} loaded entries {logsLimit !== 'all' ? `(limit: ${logsLimit})` : '(all)'}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Time</th>
                    <th className="text-left py-2 font-medium">User</th>
                    <th className="text-left py-2 font-medium">Role</th>
                    <th className="text-left py-2 font-medium">Action</th>
                    <th className="text-left py-2 font-medium">Resource</th>
                    <th className="text-left py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.log_id ?? `${log.created_at}-${log.username}`} className="border-b border-muted/50">
                      <td className="py-2 text-muted-foreground whitespace-nowrap">{log.created_at}</td>
                      <td className="py-2">{log.username || '—'}</td>
                      <td className="py-2">{log.role_name || '—'}</td>
                      <td className="py-2">{log.action || '—'}</td>
                      <td className="py-2">{log.resource || '—'}</td>
                      <td className="py-2">
                        <span className={log.status === 'success' ? 'text-green-600' : log.status === 'failure' ? 'text-amber-600' : ''}>
                          {log.status || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
