/**
 * Student Dashboard - Smooth, Clean UI
 */
import React, { useState, useEffect } from 'react';
import { Award, BookOpen, Calendar, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { PageHeader } from '../components/ui/page-header';
import ModernStatsCards from '../components/ModernStatsCards';
import RoleBasedCharts from '../components/RoleBasedCharts';
import ExportButtons from '../components/ExportButtons';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

const StudentDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStudentData();
  }, []);

  const loadStudentData = async () => {
    try {
      setLoading(true);
      // Try student analytics endpoint first
      let response;
      try {
        response = await axios.get('/api/analytics/student', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          params: { access_number: user?.access_number || user?.username }
        });
        setStats(response.data);
      } catch (err) {
        // Fallback to dashboard stats with student scope
        response = await axios.get('/api/dashboard/stats', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          params: { access_number: user?.access_number || user?.username }
        });
        setStats(response.data);
      }
    } catch (err) {
      console.error('Error loading student data:', err);
      setError(err.response?.data?.error || 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-9 w-9 animate-spin text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="My Academic Dashboard"
        subtitle="Your academic performance and progress"
        actions={<ExportButtons stats={stats} filename="student_dashboard" />}
      />

      {/* KPI Cards - 1 col mobile, 2 tablet, 4 desktop */}
      <ModernStatsCards stats={stats} type="student" />

      {/* Main Content Tabs */}
      <Tabs defaultValue="performance" className="space-y-3">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1 p-1">
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="courses" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Courses
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Academic Performance</CardTitle>
              <CardDescription>Your grades and academic progress over time</CardDescription>
            </CardHeader>
            <CardContent>
              <RoleBasedCharts filters={{}} type="student" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Overview</CardTitle>
              <CardDescription>Track your class attendance and participation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Attendance charts and data visualization
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>View your fee payments and outstanding balances</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Payment history and status visualization
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="courses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Course Progress</CardTitle>
              <CardDescription>Monitor your enrollment and progress in each course</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Course enrollment and progress visualization
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentDashboard;
