/**
 * Analyst Dashboard - Live KPIs + Analytics Workspace
 *
 * This page now focuses only on:
 * - Live ETL-driven KPIs
 * - Global filters
 * - FEX / High School / Custom / Reports tabs
 *
 * All dashboard management (current vs custom, preview, swap, edit content)
 * lives in the dedicated Dashboard Manager page.
 */
import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Filter,
  FileText,
  Users,
  Activity,
  AlertTriangle,
  GraduationCap,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { PageHeader } from '../components/ui/page-header';
import { KPICard } from '../components/ui/kpi-card';
import { DashboardGrid } from '../components/ui/dashboard-grid';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ExportButtons from '../components/ExportButtons';
import FEXAnalytics from './FEXAnalytics';
import HighSchoolAnalytics from './HighSchoolAnalytics';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const ANALYST_KPI_POLL_INTERVAL_MS = 60000; // 60s – keep KPIs fresh for analysts

const AnalystDashboard = () => {
  const { user } = useAuth();
  const [filters, setFilters] = useState({});
  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  const loadStats = async () => {
    try {
      if (!stats) {
        setLoadingStats(true);
      }
      const response = await axios.get('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: filters,
      });
      setStats(response.data);
    } catch (err) {
      console.error('Error loading analyst dashboard stats:', err);
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, ANALYST_KPI_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 30000);
    return () => clearTimeout(timer);
  }, []);

  const lastName =
    (user?.last_name && user.last_name.toString().trim()) ||
    (user?.full_name && user.full_name.toString().trim().split(' ').slice(-1)[0]) ||
    user?.username ||
    '';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics Workspace"
        subtitle={
          showWelcome && lastName
            ? `Welcome back ${lastName} 🤗!`
            : 'Live analytics workspace powered by the data warehouse'
        }
        actions={
          <>
            <Button
              onClick={() => {
                setRefreshing(true);
                loadStats();
              }}
              disabled={refreshing || loadingStats}
              className="gap-2"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing || loadingStats ? 'Refreshing…' : 'Refresh KPIs'}
            </Button>
            <ExportButtons filename="analyst_workspace" />
          </>
        }
      />

      {/* Live KPIs – ETL-driven, scoped by filters */}
      {loadingStats && !stats ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DashboardGrid cols={{ default: 1, sm: 2, md: 3, lg: 4 }}>
          <KPICard
            title="Total Students"
            value={stats?.total_students ?? 0}
            icon={Users}
            subtitle="Scoped by applied filters"
          />
          <KPICard
            title="Average Grade"
            value={stats?.avg_grade ?? 0}
            icon={TrendingUp}
            subtitle="Completed exams only"
          />
          <KPICard
            title="Failed Exams (FEX)"
            value={stats?.failed_exams ?? 0}
            icon={AlertTriangle}
            subtitle="Total failed exam records"
          />
          <KPICard
            title="Missed Exams (MEX)"
            value={stats?.missed_exams ?? 0}
            icon={Activity}
            subtitle="Total missed exam records"
          />
          <KPICard
            title="Avg Attendance"
            value={stats?.avg_attendance ?? 0}
            icon={Activity}
            subtitle="Average total hours attended"
          />
          <KPICard
            title="Retention Rate"
            value={`${stats?.retention_rate ?? 0}%`}
            icon={BarChart3}
            subtitle="Active students / total"
          />
          <KPICard
            title="Graduation Rate"
            value={`${stats?.graduation_rate ?? 0}%`}
            icon={GraduationCap}
            subtitle="Graduated / total"
          />
        </DashboardGrid>
      )}

      {/* Filters */}
      <GlobalFilterPanel onFilterChange={setFilters} />

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="fex" className="space-y-3">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1 p-1">
          <TabsTrigger value="fex" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            FEX Analytics
          </TabsTrigger>
          <TabsTrigger value="highschool" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            High School
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Custom
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fex" className="space-y-3">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold">Failed Exam (FEX) Analytics</CardTitle>
              <CardDescription className="text-xs">
                Analyze student performance and identify at-risk students
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <FEXAnalytics filters={filters} onFilterChange={setFilters} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="highschool" className="space-y-3">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold">High School Analytics</CardTitle>
              <CardDescription className="text-xs">
                Track student performance by high school and district
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <HighSchoolAnalytics filters={filters} onFilterChange={setFilters} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-3">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold">Custom Analytics Builder</CardTitle>
              <CardDescription className="text-xs">
                Create custom analytics dashboards. Use the Dashboard Manager page to design and
                assign full dashboards to roles.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-3">
                <div className="min-h-[160px] flex items-center justify-center text-muted-foreground text-sm border border-dashed rounded-lg">
                  <div className="text-center p-4 space-y-2">
                    <BarChart3 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="font-medium">
                      Use Dashboard Manager for full dashboard cards and role assignments
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Filters you set here are shared with the Analytics pages and are automatically
                      remembered.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-3">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold">Saved Reports</CardTitle>
              <CardDescription className="text-xs">
                Access and manage your saved analytics reports
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="min-h-[200px] max-h-[320px] flex items-center justify-center text-muted-foreground text-sm border border-dashed rounded-lg">
                <div className="text-center p-4">
                  <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                  <p>No saved reports yet</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalystDashboard;

