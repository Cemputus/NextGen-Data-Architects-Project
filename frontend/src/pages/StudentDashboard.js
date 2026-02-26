/**
 * Student Dashboard - Smooth, Clean UI
 */
import React, { useState, useEffect } from 'react';
import { Award, BookOpen, Calendar, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { PageHeader } from '../components/ui/page-header';
import ModernStatsCards from '../components/ModernStatsCards';
import ExportButtons from '../components/ExportButtons';
import { SciBarChart, SciLineChart, SciDonutChart } from '../components/charts/EChartsComponents';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

const StudentDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [attendanceTrends, setAttendanceTrends] = useState([]);

  useEffect(() => {
    loadStudentData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 30000);
    return () => clearTimeout(timer);
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

      // Load attendance trends for this student only
      try {
        const trendsRes = await axios.get('/api/dashboard/attendance-trends', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (trendsRes.data && Array.isArray(trendsRes.data.periods)) {
          const mapped = trendsRes.data.periods.map((period, idx) => ({
            period,
            attendance: trendsRes.data.attendance?.[idx] ?? 0,
          }));
          setAttendanceTrends(mapped);
        } else {
          setAttendanceTrends([]);
        }
      } catch (_err) {
        setAttendanceTrends([]);
      }
    } catch (err) {
      console.error('Error loading student data:', err);
      setError(err.response?.data?.error || 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const lastName =
    (user?.last_name && user.last_name.toString().trim()) ||
    (user?.full_name && user.full_name.toString().trim().split(' ').slice(-1)[0]) ||
    user?.username ||
    '';

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

  // Derived payment metrics for the logged-in student
  const totalPaid = stats?.total_paid || 0;
  const totalPending = stats?.total_pending || 0;
  const totalRequired = totalPaid + totalPending;
  const paidPercentage = totalRequired > 0 ? (totalPaid / totalRequired) * 100 : 0;
  const pendingPercentage = totalRequired > 0 ? (totalPending / totalRequired) * 100 : 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="My Academic Dashboard"
        subtitle={
          showWelcome && lastName
            ? `Welcome back ${lastName} 🤗!`
            : 'Your academic performance and progress'
        }
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
              {stats?.grades_over_time?.length ? (
                <div
                  className="min-h-[200px] max-h-[320px] w-full mb-4"
                  data-chart-title="Grade Trend Overview"
                  data-chart-container="true"
                >
                  <SciLineChart
                    data={stats.grades_over_time}
                    xDataKey="period"
                    yDataKey="avg_grade"
                    xAxisLabel="Time"
                    yAxisLabel="Average grade (%)"
                    strokeColor="#8B5CF6"
                    strokeWidth={3}
                    showLegend={false}
                    showGrid={true}
                  />
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                  No grade trend data available yet.
                </div>
              )}

              {Array.isArray(stats?.grade_distribution) && stats.grade_distribution.length > 0 && (
                <div
                  className="min-h-[200px] max-h-[320px] w-full mt-4"
                  data-chart-title="Grade Distribution"
                  data-chart-container="true"
                >
                  <SciDonutChart
                    data={stats.grade_distribution.map((g) => ({
                      name: g.letter_grade,
                      value: g.count,
                    }))}
                    nameKey="name"
                    valueKey="value"
                  />
                </div>
              )}
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Average Attendance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary">
                      {stats?.avg_attendance_hours?.toFixed(1) || '0'} hours
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">Per course</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Days Present
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">
                      {stats?.total_days_present || 0}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">Total days</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Attendance Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-purple-600">
                      {stats?.avg_attendance ? `${stats.avg_attendance.toFixed(1)}%` : 'N/A'}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">Overall rate</p>
                  </CardContent>
                </Card>
              </div>

              {attendanceTrends.length ? (
                <div
                  className="min-h-[200px] max-h-[320px] w-full"
                  data-chart-title="Attendance Trends"
                  data-chart-container="true"
                >
                  <SciLineChart
                    data={attendanceTrends}
                    xDataKey="period"
                    yDataKey="attendance"
                    xAxisLabel="Time"
                    yAxisLabel="Average attendance (hours)"
                    strokeColor="#06B6D4"
                    strokeWidth={3}
                    showLegend={false}
                    showGrid={true}
                  />
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                  No attendance trend data available yet.
                </div>
              )}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <Card className="border-green-200 bg-green-50/50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-green-700">
                      <DollarSign className="h-5 w-5" />
                      Total Paid
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">
                      UGX {(totalPaid / 1000000).toFixed(2)}M
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {paidPercentage.toFixed(1)}% of total fees
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-orange-200 bg-orange-50/50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-orange-700">
                      <DollarSign className="h-5 w-5" />
                      Outstanding Balance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-600">
                      UGX {(totalPending / 1000000).toFixed(2)}M
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {pendingPercentage.toFixed(1)}% remaining
                    </p>
                  </CardContent>
                </Card>
              </div>

              {Array.isArray(stats?.payments_by_semester) && stats.payments_by_semester.length > 0 && (
                <div
                  className="min-h-[200px] max-h-[320px] w-full mb-4"
                  data-chart-title="Tuition by Semester"
                  data-chart-container="true"
                >
                  <SciBarChart
                    data={stats.payments_by_semester}
                    xDataKey="semester_name"
                    yDataKey="total_paid"
                    xAxisLabel="Semester"
                    yAxisLabel="Total paid (UGX)"
                    fillColor="#10B981"
                    showLegend={false}
                    showGrid={true}
                  />
                </div>
              )}

              {Array.isArray(stats?.payment_timeline) && stats.payment_timeline.length > 0 && (
                <div
                  className="min-h-[200px] max-h-[320px] w-full"
                  data-chart-title="Payment Timeline"
                  data-chart-container="true"
                >
                  <SciLineChart
                    data={stats.payment_timeline.map((p) => ({
                      ...p,
                      timestamp_label: p.payment_timestamp,
                    }))}
                    xDataKey="timestamp_label"
                    yDataKey="amount"
                    xAxisLabel="Payment time"
                    yAxisLabel="Amount (UGX)"
                    strokeColor="#3B82F6"
                    strokeWidth={3}
                    showLegend={false}
                    showGrid={true}
                  />
                </div>
              )}
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
              {stats?.course_performance?.length ? (
                <div className="space-y-4">
                  <div className="min-h-[200px] max-h-[320px] w-full" data-chart-title="Course Performance" data-chart-container="true">
                    <SciBarChart
                      data={stats.course_performance}
                      xDataKey="course_name"
                      yDataKey="avg_grade"
                      xAxisLabel="Course"
                      yAxisLabel="Average grade (%)"
                      fillColor="#4F46E5"
                      showLegend={false}
                      showGrid={true}
                    />
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No course performance data available yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentDashboard;
