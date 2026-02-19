/**
 * Admin Audit Logs Page - System audit logs (sysadmin only)
 */
import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Search, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

const AdminAudit = () => {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [message, setMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [settingUp, setSettingUp] = useState(false);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/admin/audit-logs', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setLogs(response.data.logs || []);
      setMessage(response.data.message || null);
    } catch (err) {
      setError(err.response?.status === 403 ? 'Admin access required' : (err.response?.data?.error || err.message));
      setLogs([]);
      setMessage(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const setupAuditDb = async () => {
    try {
      setSettingUp(true);
      const response = await axios.post('/api/admin/setup-audit-db', {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setMessage(null);
      await loadLogs();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-muted-foreground">System activity and security audit trail</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadLogs} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {message && (
            <Button onClick={setupAuditDb} disabled={settingUp}>
              {settingUp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Set up audit DB
            </Button>
          )}
        </div>
      </div>

      {message && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-3 text-sm text-amber-800">
            {message}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Audit Logs
          </CardTitle>
          <CardDescription>User actions, logins, and system events</CardDescription>
        </CardHeader>
        <CardContent>
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
                    <tr key={log.log_id || log.created_at + log.username} className="border-b border-muted/50">
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
    </div>
  );
};

export default AdminAudit;
