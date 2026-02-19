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
    <div className="space-y-6">
      {/* Header with Export */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Department Dashboard</h1>
          <p className="text-muted-foreground">Department-level analytics and insights</p>
        </div>
        <ExportButtons stats={stats} filters={filters} filename="hod_dashboard" />
      </div>

      {/* Filters */}
      <GlobalFilterPanel onFilterChange={setFilters} />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-muted-foreground">Loading department data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <ModernStatsCards stats={stats} type="faculty" />

          {/* Main Analytics */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
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

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Department Overview</CardTitle>
                  <CardDescription>Key metrics and performance indicators</CardDescription>
                </CardHeader>
                <CardContent>
                  <RoleBasedCharts filters={filters} type="department" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="students" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Student Analytics</CardTitle>
                  <CardDescription>Student enrollment, performance, and distribution</CardDescription>
                </CardHeader>
                <CardContent>
                  <RoleBasedCharts filters={filters} type="department" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="programs" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Program Performance</CardTitle>
                  <CardDescription>Program enrollment, completion rates, and outcomes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-96 flex items-center justify-center text-muted-foreground">
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
