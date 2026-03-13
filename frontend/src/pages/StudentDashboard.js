/**
 * Student Dashboard - Smooth, Clean UI
 */
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { PageHeader } from '../components/ui/page-header';
import ExportButtons from '../components/ExportButtons';
import { useAuth } from '../context/AuthContext';
import { WELCOME_BACK_DURATION_MS } from '../constants/welcome';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

const StudentDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [attendanceTrends, setAttendanceTrends] = useState([]);
  const [retakes, setRetakes] = useState([]);
  const [retakeSummary, setRetakeSummary] = useState({ total_retakes: 0, fcw_count: 0, mex_count: 0, fex_count: 0 });

  useEffect(() => {
    loadStudentData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), WELCOME_BACK_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  const loadStudentData = async () => {
    try {
      setLoading(true);
      // Try student analytics endpoint first
      let response;
      try {
        response = await axios.get('/api/analytics/student', {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
          params: { access_number: user?.access_number || user?.username }
        });
        setStats(response.data);
      } catch (err) {
        // Fallback to dashboard stats with student scope
        response = await axios.get('/api/dashboard/stats', {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
          params: { access_number: user?.access_number || user?.username }
        });
        setStats(response.data);
      }

      // Load attendance trends for this student only
      try {
        const trendsRes = await axios.get('/api/dashboard/attendance-trends', {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
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

      // Load retake information for this student (FCW / MEX / FEX)
      try {
        const retakeRes = await axios.get('/api/analytics/student/retakes', {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        });
        setRetakes(retakeRes.data?.retakes || []);
        setRetakeSummary(retakeRes.data?.summary || { total_retakes: 0, fcw_count: 0, mex_count: 0, fex_count: 0 });
      } catch (_err) {
        setRetakes([]);
        setRetakeSummary({ total_retakes: 0, fcw_count: 0, mex_count: 0, fex_count: 0 });
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

  const formatNumber = (value) => {
    if (value === null || value === undefined) return '–';
    if (typeof value === 'number' && value % 1 !== 0) return value.toFixed(1);
    return value.toLocaleString ? value.toLocaleString(undefined) : String(value);
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined) return '–';
    const num = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(num)) return '–';
    return `${num.toFixed(1)}%`;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="My Academic Dashboard"
        subtitle={
          showWelcome && lastName
            ? `Welcome back ${lastName} 🤗!`
            : 'Your academic performance and progress (new analytics coming soon)'
        }
        actions={<ExportButtons stats={stats} filename="student_dashboard" />}
      />

      {/* Retake & risk section (read-only) */}
      {retakeSummary.total_retakes > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Retakes &amp; Exam Risk</CardTitle>
            <CardDescription>
              Courses where your status is FCW (Failed Coursework), MEX (Missed Exam), or FEX (Failed Exam).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
              <div>
                <div className="font-semibold text-foreground text-sm">{retakeSummary.total_retakes}</div>
                <div>Total retake courses</div>
              </div>
              <div>
                <div className="font-semibold text-foreground text-sm">{retakeSummary.fcw_count}</div>
                <div>FCW (Failed coursework)</div>
              </div>
              <div>
                <div className="font-semibold text-foreground text-sm">{retakeSummary.mex_count}</div>
                <div>MEX (Missed exam)</div>
              </div>
              <div>
                <div className="font-semibold text-foreground text-sm">{retakeSummary.fex_count}</div>
                <div>FEX (Failed exam)</div>
              </div>
            </div>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="min-w-full text-xs">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Course</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Reason</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Year / Semester</th>
                  </tr>
                </thead>
                <tbody>
                  {retakes.map((r) => (
                    <tr key={`${r.course_code}-${r.semester_id}-${r.academic_year}`} className="border-t border-border">
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">{r.course_code}</div>
                        <div className="text-[11px] text-muted-foreground">{r.course_name}</div>
                      </td>
                      <td className="px-3 py-2 text-[11px]">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 border border-border bg-muted/40">
                          {r.exam_status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[11px] text-muted-foreground">
                        {r.reason || '—'}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-muted-foreground">
                        {r.academic_year || '—'}{r.semester_id != null ? ` / Sem ${r.semester_id}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top student KPI strip */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">My academic overview</CardTitle>
          <CardDescription className="text-xs">
            KPIs are computed strictly from your own records via student analytics and dashboard stats.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="border rounded-md px-3 py-2 bg-muted/40">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                Courses registered
              </p>
              <p className="mt-1 text-lg font-semibold">
                {formatNumber(stats?.total_courses || stats?.courses_registered)}
              </p>
            </div>
            <div className="border rounded-md px-3 py-2 bg-muted/40">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                Average grade
              </p>
              <p className="mt-1 text-lg font-semibold">
                {formatNumber(stats?.avg_grade)}
              </p>
            </div>
            <div className="border rounded-md px-3 py-2 bg-muted/40">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                Attendance
              </p>
              <p className="mt-1 text-lg font-semibold">
                {formatPercent(stats?.avg_attendance)}
              </p>
            </div>
            <div className="border rounded-md px-3 py-2 bg-muted/40">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                Fees paid vs pending
              </p>
              <p className="mt-1 text-lg font-semibold">
                {formatPercent(paidPercentage)} paid
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {formatNumber(totalPaid)} paid / {formatNumber(totalPending)} pending
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Academic performance & attendance (placeholders) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border shadow-sm h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Attendance over time</CardTitle>
            <CardDescription className="text-xs">
              Trend of your attendance across weeks/semesters, powered by the attendance trends
              endpoint filtered to your access number.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="min-h-[220px] flex items-center justify-center border border-dashed rounded-md text-xs text-muted-foreground">
              Line / area chart placeholder for attendance trend.
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Grades by course</CardTitle>
            <CardDescription className="text-xs">
              Distribution of your grades per course and semester based on your `fact_grade` records.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="min-h-[220px] flex items-center justify-center border border-dashed rounded-md text-xs text-muted-foreground">
              Bar / donut chart placeholder for grade distribution by course.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentDashboard;
