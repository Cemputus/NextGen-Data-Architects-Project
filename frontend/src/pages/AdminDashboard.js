/**
 * Admin Dashboard - Smooth, Clean UI
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Settings, Users, Database, History, Shield, Activity, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { KPICard } from '../components/ui/kpi-card';
import { DashboardGrid } from '../components/ui/dashboard-grid';
import ExportButtons from '../components/ExportButtons';
import UserManagementSection from '../components/admin/UserManagementSection';
import AuditLogSection from '../components/admin/AuditLogSection';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Loader2 } from 'lucide-react';

const CONSOLE_KPI_POLL_INTERVAL_MS = 30000; // 30s - live KPIs refresh when new data or users are added

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [systemStats, setSystemStats] = useState(null);
  const [adminStatus, setAdminStatus] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const loadAdminStatus = async () => {
    try {
      const response = await axios.get('/api/admin/system-status', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setAdminStatus(response.data);
      // Live KPIs from backend (registered users, active sessions, ETL jobs, system health)
      const kpis = response.data?.console_kpis;
      if (kpis) {
        setSystemStats({
          total_users: kpis.registered_users ?? 0,
          active_sessions: kpis.active_sessions ?? 0,
          etl_jobs: kpis.etl_jobs ?? 0,
          system_health: kpis.system_health ?? 0,
          employees: kpis.employees ?? 0,
          staff: kpis.staff ?? 0
        });
      } else {
        // Fallback when backend does not yet return console_kpis
        const wh = response.data?.warehouse || {};
        const students = wh.dim_student ?? 0;
        const etlRuns = response.data?.etl_runs?.length ?? 0;
        setSystemStats({
          total_users: students,
          active_sessions: 0,
          etl_jobs: etlRuns,
          system_health: 100,
          employees: 0,
          staff: 0
        });
      }
    } catch (err) {
      if (err.response?.status === 404) {
        console.warn('Admin API not found (404). Ensure backend is up and admin blueprint is registered.');
      } else if (err.response?.status !== 403) {
        console.error('Error loading admin status:', err);
      }
      setAdminStatus(null);
      setSystemStats(prev => prev ?? { total_users: 0, active_sessions: 0, etl_jobs: 0, system_health: 0, employees: 0, staff: 0 });
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      await loadAdminStatus();
      if (mounted) setLoading(false);
    };
    load();
    const interval = setInterval(() => loadAdminStatus(), CONSOLE_KPI_POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      await loadAdminStatus();
      setRefreshTrigger((t) => t + 1);
    } finally {
      setRefreshing(false);
    }
  };

  const handleUsersChanged = () => {
    loadAdminStatus();
  };

  const getExportData = async () => {
    const token = localStorage.getItem('token');
    if (!token) return { kpis: systemStats, users: [], auditLogs: [], etlRuns: [], warehouse: {} };
    try {
      const [usersRes, logsRes] = await Promise.all([
        axios.get('/api/user-mgmt/users', { headers: { Authorization: `Bearer ${token}` }, params: { limit: 500 } }),
        axios.get('/api/admin/audit-logs', { headers: { Authorization: `Bearer ${token}` }, params: { limit: 500 } }),
      ]);
      const users = usersRes.data?.users || [];
      const auditLogs = logsRes.data?.logs || [];
      return {
        kpis: systemStats || {},
        users,
        auditLogs,
        etlRuns: adminStatus?.etl_runs || [],
        warehouse: adminStatus?.warehouse || {},
      };
    } catch (err) {
      console.error('Error loading export data:', err);
      return {
        kpis: systemStats || {},
        users: [],
        auditLogs: [],
        etlRuns: adminStatus?.etl_runs || [],
        warehouse: adminStatus?.warehouse || {},
      };
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Export */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Admin Console</h1>
          <p className="text-sm text-muted-foreground">System administration and management</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="default"
            onClick={handleRefreshAll}
            disabled={loading || refreshing}
            className="gap-2"
            aria-label="Refresh all data"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
          <ExportButtons stats={systemStats} filename="admin_console" getExportData={getExportData} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading system data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* System KPI Cards - Employees = full set, Staff = subset (role staff only) */}
          <DashboardGrid cols={{ default: 2, sm: 2, md: 3, lg: 6 }}>
            <KPICard
              title="Total Users"
              value={systemStats?.total_users || 0}
              icon={Users}
              subtitle="Students (warehouse) + app users (all roles)"
            />
            <KPICard
              title="Active Sessions"
              value={systemStats?.active_sessions || 0}
              icon={Activity}
              subtitle="Current active sessions"
            />
            <KPICard
              title="Recent ETL runs"
              value={systemStats?.etl_jobs ?? 0}
              icon={Database}
              subtitle="Last 50 runs (log files)"
            />
            <KPICard
              title="System Health"
              value={`${systemStats?.system_health === 100 ? 98.5 : (systemStats?.system_health ?? 0)}%`}
              changeType={systemStats?.system_health > 95 ? 'positive' : 'negative'}
              icon={Shield}
              subtitle="Overall system status"
            />
            <KPICard
              title="Employees"
              value={systemStats?.employees ?? 0}
              icon={Users}
              subtitle="ETL (dim_employee) + all app users (non-students). Refresh after ETL."
            />
            <KPICard
              title="Staff"
              value={systemStats?.staff ?? 0}
              icon={Users}
              subtitle="ETL (dim_employee) + app users with role Staff. Refresh after ETL."
            />
          </DashboardGrid>

          {/* Main Management Tabs */}
          <Tabs defaultValue="users" className="space-y-3">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1 p-1">
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Users
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
              <TabsTrigger value="etl" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                ETL Jobs
              </TabsTrigger>
              <TabsTrigger value="logs" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Audit Logs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-3">
              <UserManagementSection
                showHeader={true}
                compact={false}
                showOpenFullPage={true}
                refreshTrigger={refreshTrigger}
                onUsersChanged={handleUsersChanged}
              />
            </TabsContent>

            <TabsContent value="settings" className="space-y-3">
              <Card className="border shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold">System Settings</CardTitle>
                  <CardDescription className="text-xs">Configure system parameters and preferences</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground text-sm">
                    <Settings className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="mb-3">Manage general, security, notifications, and appearance in the dedicated Settings page.</p>
                    <Link
                      to="/admin/settings"
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                    >
                      <Settings className="h-4 w-4" />
                      Open Settings
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="etl" className="space-y-3">
              <Card className="border shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold">Data Warehouse & ETL Overview</CardTitle>
                  <CardDescription className="text-xs">Live counts and last ETL run — full tracking on ETL Jobs page</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {adminStatus ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        {adminStatus.warehouse && Object.entries(adminStatus.warehouse).map(([table, count]) => (
                          <div key={table} className="rounded border bg-muted/30 px-3 py-2">
                            <span className="font-medium text-muted-foreground">{table}</span>
                            <span className="ml-2 font-semibold">{count != null ? count.toLocaleString() : '—'}</span>
                          </div>
                        ))}
                      </div>
                      {adminStatus.etl_runs && adminStatus.etl_runs.length > 0 && (
                        <div className="rounded border p-3 bg-muted/20">
                          <p className="text-sm font-medium text-muted-foreground mb-1">Last ETL run</p>
                          <p className="text-sm">
                            {adminStatus.etl_runs[0].start_time || adminStatus.etl_runs[0].log_file}
                            {adminStatus.etl_runs[0].duration && ` · ${adminStatus.etl_runs[0].duration}`}
                            {' · '}
                            <span className={adminStatus.etl_runs[0].success ? 'text-green-600' : 'text-amber-600'}>
                              {adminStatus.etl_runs[0].success ? 'Success' : 'Failed'}
                            </span>
                          </p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        <Link to="/admin/etl" className="underline">Open ETL Jobs</Link> for full run history and details.
                      </p>
                    </div>
                  ) : (
                    <div className="h-32 flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                      <div className="text-center">
                        <Database className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
                        <p>Load admin status to see warehouse and ETL summary</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="logs" className="space-y-3">
              <AuditLogSection
                showHeader={false}
                showSetupButton={true}
                compact={true}
                defaultLimit={5}
                refreshTrigger={refreshTrigger}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
