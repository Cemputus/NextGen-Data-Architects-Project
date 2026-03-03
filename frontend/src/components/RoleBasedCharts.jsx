/**
 * Role-Based Charts Component
 * Displays charts tailored to each user role with UCU branding
 * - Students: Own performance, payments, attendance
 * - Staff: Their courses/classes over time
 * - HOD: Department-level analytics
 * - Dean: Faculty-level analytics
 * - Senate: Institution-wide analytics
 * - Finance: Payment trends only (no academic data)
 */
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SciLineChart, SciBarChart, SciAreaChart, SciStackedColumnChart, SciDonutChart } from './charts/EChartsComponents';
import { UCU_COLORS } from '../lib/chartTheme';

// Modern, visually appealing chart color palettes
const DEPT_COLORS = ['#4F46E5', '#6366F1', '#818CF8', '#A5B4FC', '#C7D2FE']; // Vibrant indigo to light purple gradient
const PAYMENT_COLORS = ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0']; // Fresh green gradient
const GRADE_COLORS = ['#8B5CF6', '#A78BFA', '#C4B5FD', '#DDD6FE', '#EDE9FE']; // Rich purple gradient (legacy)
// Distinct colors per letter grade for Grade Distribution donut
const GRADE_DISTRIBUTION_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#F97316', '#EF4444', '#8B5CF6', '#06B6D4', '#6366F1'];

const getGradeDistributionColors = (data) => {
  if (!data || !Array.isArray(data)) return GRADE_DISTRIBUTION_COLORS;
  const gradeToColor = {
    A: '#10B981', 'A+': '#059669', 'A-': '#34D399',
    B: '#3B82F6', 'B+': '#2563EB', 'B-': '#60A5FA',
    C: '#F59E0B', 'C+': '#D97706', 'C-': '#FBBF24',
    D: '#F97316', 'D+': '#EA580C', 'D-': '#FB923C',
    F: '#EF4444',
  };
  return data.map((d, i) => {
    const name = (d?.name ?? '').toString().trim().toUpperCase();
    return gradeToColor[name] || GRADE_DISTRIBUTION_COLORS[i % GRADE_DISTRIBUTION_COLORS.length];
  });
};
const ATTENDANCE_COLORS = ['#F59E0B', '#FBBF24', '#FCD34D', '#FDE68A']; // Warm amber gradient
const TREND_COLORS = ['#06B6D4', '#22D3EE', '#67E8F9', '#A5F3FC']; // Cool cyan gradient

// Dynamic payment colors - red for failed, green for completed, etc.
const getPaymentColors = (paymentData) => {
  if (!paymentData || !Array.isArray(paymentData)) return PAYMENT_COLORS;
  return paymentData.map(item => {
    const status = (item.name || '').toLowerCase();
    if (status.includes('failed') || status.includes('overdue') || status === 'failed') {
      return '#EF4444'; // Vibrant red for failed
    } else if (status.includes('completed') || status === 'paid') {
      return '#10B981'; // Fresh green for completed
    } else if (status.includes('pending')) {
      return '#F59E0B'; // Warm amber for pending
    } else if (status.includes('partial')) {
      return '#34D399'; // Light green for partial
    }
    return '#6366F1'; // Default vibrant indigo
  });
};

const RoleBasedCharts = ({ filters = {}, type = 'general' }) => {
  const { user } = useAuth();
  const role = user?.role || 'student';
  const isFinancePage = type === 'finance';
  const isAcademicPage = type === 'academic';
  
  const [chartData, setChartData] = useState({
    studentDistribution: [],
    gradesOverTime: [],
    paymentStatus: [],
    attendance: [],
    gradeDistribution: [],
    topStudents: [],
    paymentTrends: [],
    studentPaymentBreakdown: null,
  });
  const [loading, setLoading] = useState(true);
  const [paymentTrendsPeriod, setPaymentTrendsPeriod] = useState('quarterly');
  const [attendanceTrendsPeriod, setAttendanceTrendsPeriod] = useState('quarterly');
  const [gradesOverTimePeriod, setGradesOverTimePeriod] = useState('quarterly');
  const [gradesOverTimeSemesterId, setGradesOverTimeSemesterId] = useState('');
  const [semesterOptions, setSemesterOptions] = useState([]);

  useEffect(() => {
    loadChartData();
  }, [
    JSON.stringify(filters),
    type,
    user?.role,
    paymentTrendsPeriod,
    attendanceTrendsPeriod,
    gradesOverTimePeriod,
    gradesOverTimeSemesterId,
  ]);

  useEffect(() => {
    if (!isFinancePage && role !== 'finance' && role !== 'hr') {
      axios.get('/api/analytics/filter-options', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
        .then((r) => setSemesterOptions(r.data?.semesters || []))
        .catch(() => setSemesterOptions([]));
    }
  }, [isFinancePage, role]);

  const loadChartData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Role-specific data loading
      const requests = [];
      
      // Student Distribution (for Senate, Dean, HOD, Staff, Analyst) - NOT for Finance pages
      if (!isFinancePage && ['senate', 'dean', 'hod', 'staff', 'analyst'].includes(role)) {
        const studentFilters = { ...filters, group_by: studentDistGroupBy };
        requests.push(
          axios.get('/api/dashboard/students-by-department', {
            headers: { Authorization: `Bearer ${token}` },
            params: studentFilters
          }).catch(() => ({ data: { labels: [], counts: [] } }))
        );
      }
      
      // Grades Over Time (role-specific scope) - NOT for Finance pages and NOT for HR
      if (!isFinancePage && role !== 'finance' && role !== 'hr') {
        const gradeParams = role === 'senate' ? { ...filters } : { ...filters, role };
        if (gradesOverTimeSemesterId) gradeParams.semester_id = gradesOverTimeSemesterId;
        requests.push(
          axios.get('/api/dashboard/grades-over-time', {
            headers: { Authorization: `Bearer ${token}` },
            params: { ...gradeParams, period: gradesOverTimePeriod }
          }).catch(() => ({ data: { periods: [], grades: [] } }))
        );
      }
      
      // Payment Status (for Dean, HOD, Student, Finance, Senate)
      if (!isAcademicPage && (isFinancePage || ['dean', 'hod', 'student', 'finance', 'senate'].includes(role))) {
        requests.push(
          axios.get('/api/dashboard/payment-status', {
            headers: { Authorization: `Bearer ${token}` },
            params: { ...filters, role }
          }).catch(() => ({ data: { statuses: [], counts: [] } }))
        );
      }
      
      // Grade Distribution (NOT for finance) - NOT for Finance pages and NOT for HR
      if (!isFinancePage && role !== 'finance' && role !== 'hr') {
        requests.push(
          axios.get('/api/dashboard/grade-distribution', {
            headers: { Authorization: `Bearer ${token}` },
            params: filters
          }).catch(() => ({ data: { grades: [], counts: [] } }))
        );
      }
      
      // Top Students (role-specific scope) - NOT for Finance pages
      if (!isFinancePage && ['senate', 'dean', 'hod', 'staff'].includes(role)) {
        requests.push(
          axios.get('/api/dashboard/top-students', {
            headers: { Authorization: `Bearer ${token}` },
            params: { ...filters, limit: 10, role }
          }).catch(() => ({ data: { students: [], grades: [] } }))
        );
      }
      
      // Payment Trends - For Finance pages and Finance/Senate roles
      if (!isAcademicPage && (isFinancePage || role === 'finance' || role === 'senate')) {
        requests.push(
          axios.get('/api/dashboard/payment-trends', {
            headers: { Authorization: `Bearer ${token}` },
            params: { ...filters, period: paymentTrendsPeriod }
          }).catch(() => ({ data: { periods: [], amounts: [] } }))
        );
      }

      // Attendance Trends - For all roles except Finance and HR, but Senate also gets attendance
      if (!isFinancePage && role !== 'finance' && role !== 'hr') {
        const attendanceParams = role === 'senate' ? filters : { ...filters, role };
        requests.push(
          axios.get('/api/dashboard/attendance-trends', {
            headers: { Authorization: `Bearer ${token}` },
            params: { ...attendanceParams, period: attendanceTrendsPeriod }
          }).catch(() => ({ data: { periods: [], attendance: [] } }))
        );
      }
      
      // Student Payment Breakdown (for students only)
      if (role === 'student') {
        requests.push(
          axios.get('/api/dashboard/student-payment-breakdown', {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => ({ data: null }))
        );
      }
      
      const results = await Promise.all(requests);
      let resultIndex = 0;
      
      const data = {};
      
      // Process Student Distribution
      if (!isFinancePage && ['senate', 'dean', 'hod', 'staff', 'analyst'].includes(role)) {
        const deptRes = results[resultIndex++];
        const labels = deptRes.data.labels || deptRes.data.departments || [];
        const counts = deptRes.data.counts || [];
        data.studentDistribution = labels.map((label, idx) => ({
          name: label,
          students: counts[idx] || 0
        })) || [];
      }
      
      // Process Grades Over Time (NOT for Finance pages and NOT for HR) - Enhanced with comprehensive data
      if (!isFinancePage && role !== 'finance' && role !== 'hr') {
        const gradesRes = results[resultIndex++];
        data.gradesOverTime = gradesRes.data.periods?.map((period, idx) => ({
          period,
          grade: gradesRes.data.grades?.[idx] || 0,
          missed_exams: gradesRes.data.missed_exams?.[idx] || 0,
          failed_exams: gradesRes.data.failed_exams?.[idx] || 0,
          completed_exams: gradesRes.data.completed_exams?.[idx] || 0,
          pass_rate: gradesRes.data.pass_rate?.[idx] || 0,
          total_students: gradesRes.data.total_students?.[idx] || 0,
        })) || [];
      }
      
      // Process Payment Status
      if (!isAcademicPage && (isFinancePage || ['dean', 'hod', 'student', 'finance', 'senate'].includes(role))) {
        const paymentsRes = results[resultIndex++];
        data.paymentStatus = paymentsRes.data.statuses?.map((status, idx) => ({
          name: status,
          value: paymentsRes.data.counts?.[idx] || 0
        })) || [];
      }
      
      // Process Grade Distribution (NOT for Finance pages and NOT for HR)
      if (!isFinancePage && role !== 'finance' && role !== 'hr') {
        const gradeDistRes = results[resultIndex++];
        data.gradeDistribution = gradeDistRes.data.grades?.map((grade, idx) => ({
          name: grade,
          value: gradeDistRes.data.counts?.[idx] || 0
        })) || [];
      }
      
      // Process Top Students (NOT for Finance pages)
      if (!isFinancePage && ['senate', 'dean', 'hod', 'staff'].includes(role)) {
        const topStudentsRes = results[resultIndex++];
        data.topStudents = (topStudentsRes.data.students || []).slice(0, 10).map((student, idx) => ({
          name: student && student.length > 15 ? student.substring(0, 15) + '...' : (student || 'Unknown'),
          grade: topStudentsRes.data.grades?.[idx] || 0
        }));
      }
      
      // Process Payment Trends - For Finance pages and Finance/Senate roles
      if (!isAcademicPage && (isFinancePage || role === 'finance' || role === 'senate')) {
        const trendsRes = results[resultIndex++];
        data.paymentTrends = trendsRes.data.periods?.map((period, idx) => ({
          period,
          amount: trendsRes.data.amounts?.[idx] || 0,
          completed_payments: trendsRes.data.completed_payments?.[idx] || 0,
          pending_payments: trendsRes.data.pending_payments?.[idx] || 0,
        })) || [];
      }
      
      // Process Attendance Trends - For all roles except Finance and HR
      if (!isFinancePage && role !== 'finance' && role !== 'hr') {
        const attendanceRes = results[resultIndex++];
        data.attendance = attendanceRes.data.periods?.map((period, idx) => ({
          period,
          attendance: attendanceRes.data.attendance?.[idx] || 0,
          days_present: attendanceRes.data.days_present?.[idx] || 0,
          attendance_rate: attendanceRes.data.attendance_rate?.[idx] || 0,
          total_students: attendanceRes.data.total_students?.[idx] || 0,
        })) || [];
      }
      
      // Process Student Payment Breakdown
      if (role === 'student') {
        const paymentBreakdownRes = results[resultIndex++];
        data.studentPaymentBreakdown = paymentBreakdownRes.data;
      }
      
      setChartData(data);
    } catch (err) {
      console.error('Error loading chart data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  // Ensure all arrays are initialized to prevent undefined errors
  const safeChartData = {
    studentDistribution: chartData.studentDistribution || [],
    gradesOverTime: chartData.gradesOverTime || [],
    paymentStatus: chartData.paymentStatus || [],
    attendance: chartData.attendance || [],
    gradeDistribution: chartData.gradeDistribution || [],
    topStudents: chartData.topStudents || [],
    paymentTrends: chartData.paymentTrends || [],
    studentPaymentBreakdown: chartData.studentPaymentBreakdown || null,
  };

  const studentDistGroupBy = (() => {
    const f = filters || {};
    if (f.program_id) return 'course';
    if (f.department_id) return 'program';
    return 'department';
  })();

  const chartContainerClass = "min-h-[200px] max-h-[320px] w-full"
  return (
    <div className="space-y-4">
      {/* Student Distribution by Department - Senate, Dean, HOD, Staff, Analyst (NOT for Finance) */}
      {!isFinancePage && ['senate', 'dean', 'hod', 'staff', 'analyst'].includes(role) && (
        <Card className="border shadow-sm" style={{ borderLeftColor: UCU_COLORS.blue, borderLeftWidth: '4px' }}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base font-semibold" style={{ color: UCU_COLORS.blue }}>
              {studentDistGroupBy === 'course'
                ? 'Student Distribution by Course'
                : studentDistGroupBy === 'program'
                ? 'Student Distribution by Program'
                : 'Student Distribution by Department'}
            </CardTitle>
            <CardDescription className="text-xs">
              {role === 'senate' && 'Institution-wide student distribution across all departments (respecting global filters)'}
              {role === 'analyst' && 'Institution-wide distribution with drill-down using the global Filters panel'}
              {role === 'dean' && 'Student distribution in your faculty/school'}
              {role === 'hod' && 'Student distribution in your department'}
              {role === 'staff' && 'Student distribution in your classes'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className={chartContainerClass} data-chart-title="Student Distribution by Department" data-chart-container="true">
              <SciBarChart
                data={safeChartData.studentDistribution}
                xDataKey="name"
                yDataKey="students"
                xAxisLabel={
                  studentDistGroupBy === 'course'
                    ? 'Course'
                    : studentDistGroupBy === 'program'
                    ? 'Program'
                    : 'Department'
                }
                yAxisLabel="Number of Students"
                fillColor="#4F46E5"
                showLegend={true}
                showGrid={true}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Trend Analysis of Grades Over Time - Role-specific (NOT for Finance or HR) */}
        {!isFinancePage && role !== 'finance' && role !== 'hr' && (
          <Card className="border shadow-sm" style={{ borderLeftColor: UCU_COLORS.maroon, borderLeftWidth: '4px' }}>
            <CardHeader className="p-4 pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold" style={{ color: UCU_COLORS.navy }}>Trend Analysis of Grades Over Time</CardTitle>
                  <CardDescription className="text-xs">
                    {role === 'staff' && 'Your courses performance over time'}
                    {role === 'hod' && 'Your department performance over time'}
                    {role === 'dean' && 'Your faculty/school performance over time'}
                    {role === 'senate' && 'Institution-wide performance over time'}
                    {role === 'student' && 'Your academic performance over time'}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Semester:</span>
                  <select
                    value={gradesOverTimeSemesterId}
                    onChange={(e) => setGradesOverTimeSemesterId(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium min-w-[100px]"
                  >
                    <option value="">All</option>
                    {semesterOptions.map((s) => (
                      <option key={s.semester_id} value={s.semester_id}>{s.semester_name || s.semester_id}</option>
                    ))}
                  </select>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Group by:</span>
                  <select
                    value={gradesOverTimePeriod}
                    onChange={(e) => setGradesOverTimePeriod(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className={chartContainerClass} data-chart-title="Trend Analysis of Grades Over Time" data-chart-container="true">
                {safeChartData.gradesOverTime.length > 0 ? (
                  <SciLineChart
                    data={safeChartData.gradesOverTime}
                    xDataKey="period"
                    yDataKey="grade"
                    xAxisLabel={gradesOverTimePeriod === 'monthly' ? 'Month' : gradesOverTimePeriod === 'yearly' ? 'Year' : 'Quarter'}
                    yAxisLabel="Average grade (%)"
                    strokeColor="#8B5CF6"
                    strokeWidth={3}
                    showLegend={false}
                    showGrid={true}
                  />
                ) : (
                  <div className="h-full min-h-[200px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg text-sm">
                    No grade trend data for the selected period.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grade Distribution - same row as Trend Analysis (NOT for Finance or HR) */}
        {!isFinancePage && role !== 'finance' && role !== 'hr' && (
          <Card className="border shadow-sm" style={{ borderLeftColor: UCU_COLORS.maroon, borderLeftWidth: '4px' }}>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold" style={{ color: UCU_COLORS.navy }}>Grade Distribution</CardTitle>
              <CardDescription className="text-xs">
                {role === 'student'
                  ? 'Proportion of your letter grades'
                  : 'Proportion of letter grades across students'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className={chartContainerClass} data-chart-title="Grade Distribution" data-chart-container="true">
                <SciDonutChart
                  data={safeChartData.gradeDistribution}
                  nameKey="name"
                  valueKey="value"
                  colors={getGradeDistributionColors(safeChartData.gradeDistribution)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Status Distribution - Role-specific (ALWAYS for Finance pages) */}
        {!isAcademicPage && (isFinancePage || ['dean', 'hod', 'student', 'finance', 'senate'].includes(role)) && (
          <Card className="border shadow-sm" style={{ borderLeftColor: '#10b981', borderLeftWidth: '4px' }}>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold" style={{ color: '#10b981' }}>
                {role === 'student' ? 'My Payment Status' : 'Payment Status Distribution'}
              </CardTitle>
              <CardDescription className="text-xs">
                {role === 'dean' && 'Payment status in your faculty/school'}
                {role === 'hod' && 'Payment status in your department'}
                {role === 'student' && 'Your payment breakdown with amounts and percentages'}
                {role === 'finance' && 'Overall payment status distribution'}
                {role === 'senate' && 'Institution-wide payment status'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className={chartContainerClass} data-chart-title={role === 'student' ? 'My Payment Status' : 'Payment Status Distribution'} data-chart-container="true">
                {safeChartData.paymentStatus.length > 0 ? (
                  role === 'student' && safeChartData.studentPaymentBreakdown ? (
                    // Student-specific payment breakdown with amounts
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 bg-blue-50 rounded-lg border" style={{ borderColor: UCU_COLORS.blue }}>
                          <div className="text-xs font-medium text-gray-600">Total Paid</div>
                          <div className="text-lg font-bold" style={{ color: UCU_COLORS.blue }}>
                            UGX {((chartData.studentPaymentBreakdown.total_paid || 0) / 1000000).toFixed(2)}M
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {chartData.studentPaymentBreakdown.paid_percentage?.toFixed(1) || 0}% of total
                          </div>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-lg border border-orange-300">
                          <div className="text-xs font-medium text-gray-600">Outstanding</div>
                          <div className="text-lg font-bold text-orange-600">
                            UGX {((chartData.studentPaymentBreakdown.total_pending || 0) / 1000000).toFixed(2)}M
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {chartData.studentPaymentBreakdown.pending_percentage?.toFixed(1) || 0}% remaining
                          </div>
                        </div>
                      </div>
                      <SciStackedColumnChart
                        data={[
                          { name: 'Paid', value: safeChartData.studentPaymentBreakdown.total_paid || 0 },
                          { name: 'Pending', value: safeChartData.studentPaymentBreakdown.total_pending || 0 }
                        ]}
                        xDataKey="name"
                        yDataKey="value"
                        xAxisLabel="Payment Status"
                        yAxisLabel="Amount (UGX)"
                        colors={['#10B981', '#F59E0B']}
                        showLegend={true}
                        showGrid={true}
                        showPercentages={true}
                      />
                    </div>
                  ) : (
                    <SciDonutChart
                      data={safeChartData.paymentStatus}
                      nameKey="name"
                      valueKey="value"
                      colors={getPaymentColors(safeChartData.paymentStatus)}
                    />
                  )
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                    <div className="text-center">
                      <p className="text-lg font-medium">No payment data available</p>
                      <p className="text-sm mt-2">Try adjusting your filters or check if data exists.</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Trends - Finance and Senate (same row as Payment Status when both show) */}
        {!isAcademicPage && (isFinancePage || role === 'finance' || role === 'senate') && (
          <Card className="border shadow-sm" style={{ borderLeftColor: '#10b981', borderLeftWidth: '4px' }}>
            <CardHeader className="p-4 pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold" style={{ color: '#10b981' }}>Payment Trends Over Time</CardTitle>
                  <CardDescription className="text-xs">Payment collection trends and revenue flow</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Group by:</span>
                  <select
                    value={paymentTrendsPeriod}
                    onChange={(e) => setPaymentTrendsPeriod(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className={chartContainerClass} data-chart-title="Payment Trends Over Time" data-chart-container="true">
                {safeChartData.paymentTrends.length > 0 ? (
                  <SciAreaChart
                    data={safeChartData.paymentTrends}
                    xDataKey="period"
                    yDataKey="amount"
                    xAxisLabel={paymentTrendsPeriod === 'monthly' ? 'Month' : paymentTrendsPeriod === 'yearly' ? 'Year' : 'Quarter'}
                    yAxisLabel="Amount (UGX)"
                    fillColor="#10B981"
                    strokeColor="#10B981"
                    strokeWidth={3}
                    showLegend={true}
                    showGrid={true}
                  />
                ) : (
                  <div className="h-full min-h-[200px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg text-sm">
                    No payment trend data for the selected period.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Top 10 Students - Role-specific scope (NOT for Finance) */}
        {!isFinancePage && ['senate', 'dean', 'hod', 'staff'].includes(role) && (
          <Card className="border shadow-sm" style={{ borderLeftColor: UCU_COLORS.maroon, borderLeftWidth: '4px' }}>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold" style={{ color: UCU_COLORS.navy }}>Top 10 Students</CardTitle>
              <CardDescription className="text-xs">
                {role === 'senate' && 'Overall top 10 students across institution'}
                {role === 'dean' && 'Top 10 students in your faculty/school'}
                {role === 'hod' && 'Top 10 students in your department'}
                {role === 'staff' && 'Top 10 students in your program/class'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className={chartContainerClass} data-chart-title="Top 10 Students" data-chart-container="true">
                <SciBarChart
                  data={safeChartData.topStudents}
                  xDataKey="name"
                  yDataKey="grade"
                  xAxisLabel="Student Name"
                  yAxisLabel="Average Grade (%)"
                  fillColor="#8B5CF6"
                  showLegend={true}
                  showGrid={true}
                />
              </div>
            </CardContent>
          </Card>
        )}

      </div>

      {/* Attendance Trends - NOT for Finance or HR, but Senate should see this */}
      {!isFinancePage && role !== 'finance' && role !== 'hr' && (
        <Card className="border shadow-sm" style={{ borderLeftColor: UCU_COLORS.maroon, borderLeftWidth: '4px' }}>
          <CardHeader className="p-4 pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-base font-semibold" style={{ color: UCU_COLORS.navy }}>Attendance Trends</CardTitle>
                <CardDescription className="text-xs">
                  {role === 'staff' && 'Attendance in your courses over time'}
                  {role === 'hod' && 'Attendance in your department over time'}
                  {role === 'dean' && 'Attendance in your faculty/school over time'}
                  {role === 'senate' && 'Institution-wide attendance over time'}
                  {role === 'student' && 'Your attendance over time'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Group by:</span>
                <select
                  value={attendanceTrendsPeriod}
                  onChange={(e) => setAttendanceTrendsPeriod(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className={chartContainerClass} data-chart-title="Attendance Trends" data-chart-container="true">
              {safeChartData.attendance.length > 0 ? (
                <SciLineChart
                  data={safeChartData.attendance}
                  xDataKey="period"
                  yDataKey="attendance"
                  xAxisLabel={attendanceTrendsPeriod === 'monthly' ? 'Month' : attendanceTrendsPeriod === 'yearly' ? 'Year' : 'Quarter'}
                  yAxisLabel="Avg attendance (hours)"
                  strokeColor={UCU_COLORS.cyan}
                  strokeWidth={3}
                  showLegend={false}
                  showGrid={true}
                />
              ) : (
                <div className="h-full min-h-[200px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg text-sm">
                  No attendance trend data for the selected period.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RoleBasedCharts;
