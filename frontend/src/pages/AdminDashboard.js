/**
 * Admin Dashboard - Smooth, Clean UI
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Settings, Users, Database, History, Shield, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { KPICard } from '../components/ui/kpi-card';
import { DashboardGrid } from '../components/ui/dashboard-grid';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [systemStats, setSystemStats] = useState(null);
  const [adminStatus, setAdminStatus] = useState(null);

  useEffect(() => {
    loadSystemStats();
    loadAdminStatus();
  }, []);

  const loadSystemStats = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setSystemStats({
        total_users: response.data.total_students || 0,
        active_sessions: 12,
        etl_jobs: 3,
        system_health: 98.5
      });
    } catch (err) {
      console.error('Error loading system stats:', err);
      setSystemStats({
        total_users: 0,
        active_sessions: 0,
        etl_jobs: 0,
        system_health: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAdminStatus = async () => {
    try {
      const response = await axios.get('/api/admin/system-status', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setAdminStatus(response.data);
    } catch (err) {
      if (err.response?.status === 404) {
        console.warn('Admin API not found (404). Ensure backend is up and admin blueprint is registered.');
      } else if (err.response?.status !== 403) {
        console.error('Error loading admin status:', err);
      }
      setAdminStatus(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Export */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Console</h1>
          <p className="text-muted-foreground">System administration and management</p>
        </div>
        <ExportButtons stats={systemStats} filename="admin_console" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-muted-foreground">Loading system data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* System KPI Cards */}
          <DashboardGrid cols={{ default: 2, sm: 2, md: 4 }}>
            <KPICard
              title="Total Users"
              value={systemStats?.total_users || 0}
              icon={Users}
              subtitle="Registered users"
            />
            <KPICard
              title="Active Sessions"
              value={systemStats?.active_sessions || 0}
              icon={Activity}
              subtitle="Current active sessions"
            />
            <KPICard
              title="ETL Jobs"
              value={systemStats?.etl_jobs || 0}
              icon={Database}
              subtitle="Running ETL processes"
            />
            <KPICard
              title="System Health"
              value={`${systemStats?.system_health || 0}%`}
              changeType={systemStats?.system_health > 95 ? 'positive' : 'negative'}
              icon={Shield}
              subtitle="Overall system status"
            />
          </DashboardGrid>

          {/* Main Management Tabs */}
          <Tabs defaultValue="users" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
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

            <TabsContent value="users" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>Manage system users, roles, and permissions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-96 flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                    <div className="text-center">
                      <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p>User management interface</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>System Settings</CardTitle>
                  <CardDescription>Configure system parameters and preferences</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-96 flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                    <div className="text-center">
                      <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p>System settings and configuration</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="etl" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Data Warehouse & ETL Overview</CardTitle>
                  <CardDescription>Live counts and last ETL run — full tracking on ETL Jobs page</CardDescription>
                </CardHeader>
                <CardContent>
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

            <TabsContent value="logs" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Audit Logs</CardTitle>
                  <CardDescription>View system activity and audit trails</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-96 flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                    <div className="text-center">
                      <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p>Audit log viewer</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
