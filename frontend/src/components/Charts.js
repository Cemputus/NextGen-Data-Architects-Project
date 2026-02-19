/**
 * Charts Component - Fully Dynamic with Filters
 * Displays various analytics charts with filter-based data
 */
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { SciLineChart, SciBarChart, SciAreaChart, SciStackedColumnChart, UCU_COLORS } from './SciChartComponents';

// Modern, visually appealing color themes
const DEPT_COLORS = ['#4F46E5', '#6366F1', '#818CF8', '#A5B4FC', '#C7D2FE']; // Vibrant indigo to light purple gradient
const PAYMENT_COLORS = ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0']; // Fresh green gradient
const GRADE_COLORS = ['#8B5CF6', '#A78BFA', '#C4B5FD', '#DDD6FE', '#EDE9FE']; // Rich purple gradient
const ATTENDANCE_COLORS = ['#F59E0B', '#FBBF24', '#FCD34D', '#FDE68A']; // Warm amber gradient
const STUDENT_COLORS = ['#06B6D4', '#22D3EE', '#67E8F9', '#A5F3FC']; // Cool cyan gradient

const Charts = ({ data, filters = {}, type = 'general' }) => {
  const [chartData, setChartData] = useState({
    departments: [],
    gradesOverTime: [],
    paymentStatus: [],
    attendance: [],
    gradeDistribution: [],
    topStudents: [],
    enrollmentTrends: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChartData();
  }, [filters, type]);

  const loadChartData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Load all chart data sources with filters
      const [deptRes, gradesRes, paymentsRes, gradeDistRes, topStudentsRes, attendanceRes] = await Promise.all([
        axios.get('/api/dashboard/students-by-department', {
          headers: { Authorization: `Bearer ${token}` },
          params: filters
        }).catch(() => ({ data: { departments: [], counts: [] } })),
        axios.get('/api/dashboard/grades-over-time', {
          headers: { Authorization: `Bearer ${token}` },
          params: filters
        }).catch(() => ({ data: { periods: [], grades: [] } })),
        axios.get('/api/dashboard/payment-status', {
          headers: { Authorization: `Bearer ${token}` },
          params: filters
        }).catch(() => ({ data: { statuses: [], counts: [] } })),
        axios.get('/api/dashboard/grade-distribution', {
          headers: { Authorization: `Bearer ${token}` },
          params: filters
        }).catch(() => ({ data: { grades: [], counts: [] } })),
        axios.get('/api/dashboard/top-students', {
          headers: { Authorization: `Bearer ${token}` },
          params: { ...filters, limit: 10 }
        }).catch(() => ({ data: { students: [], grades: [] } })),
        axios.get('/api/dashboard/attendance-trends', {
          headers: { Authorization: `Bearer ${token}` },
          params: filters
        }).catch(() => ({ data: { periods: [], attendance: [] } }))
      ]);

      setChartData({
        departments: deptRes.data.departments?.map((dept, idx) => ({
          name: dept,
          students: deptRes.data.counts?.[idx] || 0
        })) || [],
        gradesOverTime: gradesRes.data.periods?.map((period, idx) => ({
          period,
          grade: gradesRes.data.grades?.[idx] || 0
        })) || [],
        paymentStatus: paymentsRes.data.statuses?.map((status, idx) => ({
          name: status,
          value: paymentsRes.data.counts?.[idx] || 0
        })) || [],
        gradeDistribution: gradeDistRes.data.grades?.map((grade, idx) => ({
          name: grade,
          value: gradeDistRes.data.counts?.[idx] || 0
        })) || [],
        topStudents: topStudentsRes.data.students?.slice(0, 10).map((student, idx) => ({
          name: student.length > 15 ? student.substring(0, 15) + '...' : student,
          grade: topStudentsRes.data.grades?.[idx] || 0
        })) || [],
        attendance: attendanceRes.data.periods?.map((period, idx) => ({
          period,
          attendance: attendanceRes.data.attendance?.[idx] || 0
        })) || []
      });
    } catch (err) {
      console.error('Error loading chart data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Students by Department */}
        <Card className="bg-gradient-to-br from-white to-blue-50/50 border-blue-200/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-blue-700">Students by Department</CardTitle>
            <CardDescription>Student distribution across departments {Object.keys(filters).length > 0 && '(Filtered)'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]" data-chart-container="true">
              <SciBarChart
                data={chartData.departments}
                xDataKey="name"
                yDataKey="students"
                height={300}
                xAxisLabel="Department"
                yAxisLabel="Number of Students"
                fillColor="#3b82f6"
                showLegend={true}
                showGrid={true}
              />
            </div>
          </CardContent>
        </Card>

        {/* Average Grades Over Time */}
        <Card className="bg-gradient-to-br from-white to-purple-50/50 border-purple-200/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-purple-700">Average Grades Over Time</CardTitle>
            <CardDescription>Grade trends across periods {Object.keys(filters).length > 0 && '(Filtered)'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]" data-chart-container="true">
              <SciLineChart
                data={chartData.gradesOverTime}
                xDataKey="period"
                yDataKey="grade"
                height={300}
                xAxisLabel="Time Period"
                yAxisLabel="Average Grade (%)"
                strokeColor="#8b5cf6"
                strokeWidth={3}
                showLegend={true}
                showGrid={true}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Status Distribution */}
        <Card className="bg-gradient-to-br from-white to-green-50/50 border-green-200/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-green-700">Payment Status Distribution</CardTitle>
            <CardDescription>Payment status breakdown {Object.keys(filters).length > 0 && '(Filtered)'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]" data-chart-container="true">
              <SciStackedColumnChart
                data={chartData.paymentStatus}
                xDataKey="name"
                yDataKey="value"
                height={300}
                xAxisLabel="Payment Status"
                yAxisLabel="Number of Students"
                colors={PAYMENT_COLORS}
                showLegend={true}
                showGrid={true}
                showPercentages={true}
              />
            </div>
          </CardContent>
        </Card>

        {/* Grade Distribution */}
        <Card className="bg-gradient-to-br from-white to-orange-50/50 border-orange-200/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-orange-700">Grade Distribution</CardTitle>
            <CardDescription>Distribution of letter grades {Object.keys(filters).length > 0 && '(Filtered)'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]" data-chart-container="true">
              <SciStackedColumnChart
                data={chartData.gradeDistribution}
                xDataKey="name"
                yDataKey="value"
                height={300}
                xAxisLabel="Grade"
                yAxisLabel="Number of Students"
                colors={GRADE_COLORS}
                showLegend={true}
                showGrid={true}
                showPercentages={true}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Students */}
        <Card className="bg-gradient-to-br from-white to-red-50/50 border-red-200/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-red-700">Top 10 Students</CardTitle>
            <CardDescription>Highest performing students {Object.keys(filters).length > 0 && '(Filtered)'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]" data-chart-container="true">
              <SciBarChart
                data={chartData.topStudents}
                xDataKey="name"
                yDataKey="grade"
                height={300}
                xAxisLabel="Student Name"
                yAxisLabel="Average Grade (%)"
                fillColor="#ef4444"
                showLegend={true}
                showGrid={true}
              />
            </div>
          </CardContent>
        </Card>

        {/* Attendance Trends */}
        <Card className="bg-gradient-to-br from-white to-yellow-50/50 border-yellow-200/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-yellow-700">Attendance Trends</CardTitle>
            <CardDescription>Attendance over time {Object.keys(filters).length > 0 && '(Filtered)'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]" data-chart-container="true">
              <SciAreaChart
                data={chartData.attendance}
                xDataKey="period"
                yDataKey="attendance"
                height={300}
                xAxisLabel="Time Period"
                yAxisLabel="Average Attendance (Hours)"
                fillColor="#fbbf24"
                strokeColor="#f59e0b"
                strokeWidth={3}
                showLegend={true}
                showGrid={true}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Charts;
