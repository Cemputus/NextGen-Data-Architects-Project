/**
 * HOD Dashboard - Smooth, Clean UI
 */
import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ModernStatsCards from '../components/ModernStatsCards';
import RoleBasedCharts from '../components/RoleBasedCharts';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

const HODDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({});

  useEffect(() => {
    loadDepartmentData();
  }, [filters]);

  const loadDepartmentData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/analytics/department', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: filters
      });
      setStats(response.data);
    } catch (err) {
      console.error('Error loading department data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Export */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Department Dashboard</h1>
          <p className="text-sm text-muted-foreground">Department-level analytics and insights</p>
        </div>
        <ExportButtons stats={stats} filters={filters} filename="hod_dashboard" />
      </div>

      {/* Filters */}
      <GlobalFilterPanel onFilterChange={setFilters} />

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading department data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <ModernStatsCards stats={stats} type="faculty" />

          {/* Main Analytics */}
          <Tabs defaultValue="overview" className="space-y-3">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 gap-1 p-1">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="students" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Students
              </TabsTrigger>
              <TabsTrigger value="programs" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Programs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-3">
              <Card className="border shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold">Department Overview</CardTitle>
                  <CardDescription className="text-xs">Key metrics and performance indicators</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <RoleBasedCharts filters={filters} type="department" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="students" className="space-y-3">
              <Card className="border shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold">Student Analytics</CardTitle>
                  <CardDescription className="text-xs">Student enrollment, performance, and distribution</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <RoleBasedCharts filters={filters} type="department" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="programs" className="space-y-3">
              <Card className="border shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold">Program Performance</CardTitle>
                  <CardDescription className="text-xs">Program enrollment, completion rates, and outcomes</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="min-h-[200px] max-h-[320px] flex items-center justify-center text-muted-foreground text-sm">
                    Program performance charts
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

export default HODDashboard;
