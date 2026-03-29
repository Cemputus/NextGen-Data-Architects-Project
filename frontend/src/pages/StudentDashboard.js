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
import { Loader2, BookOpen, GraduationCap, CalendarCheck, Wallet } from 'lucide-react';
import { KPICard } from '../components/ui/kpi-card';
import {
  kpiStripCardClass,
  chartSurfaceCard,
  chartCardHeaderClass,
  chartCardTitleClass,
  chartCardDescriptionClass,
} from '../lib/analytics-ui';
import { StudentAttendanceTrendChart } from '../components/charts/StudentAttendanceTrendChart';
import { StudentGradesByCourseChart } from '../components/charts/StudentGradesByCourseChart';

const StudentDashboard = () => {
  const { user } = useAuth();
  const isStudentRole = (user?.role || '').toString().toLowerCase() === 'student';
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
        // Backend scopes students by JWT only; no need to pass access_number (ignored for student role).
        response = await axios.get('/api/analytics/student', {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        });
        setStats(response.data);
      } catch (err) {
        // Fallback: institution-style stats (KPIs may not match student semantics); prefer fixing /api/analytics/student.
        response = await axios.get('/api/dashboard/stats', {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        });
        setStats(response.data);
      }

      // Load attendance trends for this student only
      try {
        const trendsRes = await axios.get('/api/dashboard/attendance-trends', {
          params: { period: 'monthly' },
          headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        });
        if (trendsRes.data && Array.isArray(trendsRes.data.periods)) {
          const mapped = trendsRes.data.periods.map((period, idx) => {
            const avgDaysPresent = Number(trendsRes.data.days_present?.[idx] ?? 0);
            // fact_attendance.days_present is 0/1 per row; AVG → share of sessions present (0–1)
            const pctPresent = Math.min(100, Math.max(0, avgDaysPresent * 100));
            return {
            period,
              avgHours: Number(trendsRes.data.attendance?.[idx] ?? 0),
              pctPresent,
            };
          });
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

  // Derived payment metrics for the logged-in student (from student analytics when available)
  const totalPaid = Number(stats?.total_paid) || 0;
  const totalPending = Number(stats?.total_pending) || 0;
  const totalRequired = totalPaid + totalPending;
  const paidPercentage = totalRequired > 0 ? (totalPaid / totalRequired) * 100 : 0;

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

  /** True only for `/api/analytics/student` — NOT dashboard stats (both can have total_students === 1). */
  const isStudentAnalyticsPayload = stats?.student_analytics === true;
  const isStudentScopedDashboard = isStudentRole && stats?.student_scoped_dashboard === true;

  /** 0–100: % of attendance fact rows marked present (days_present 0/1), when backend sends attendance_rate. */
  const attendanceRatePct = (() => {
    const ar = stats?.attendance_rate;
    if (ar !== undefined && ar !== null && String(ar).trim() !== '') {
      const n = Number(ar);
      if (Number.isFinite(n)) return Math.min(100, Math.max(0, n));
    }
    return null;
  })();

  /** Distinct course codes: prefer explicit KPI fields; never use institution dim_course total_courses first. */
  const coursesRegistered = (() => {
    if (!stats) return null;
    let n = Number(
      stats.courses_registered ??
        stats.enrollment_distinct_courses ??
        stats.total_courses
    );
    if (!Number.isFinite(n)) n = NaN;
    if (
      (isStudentAnalyticsPayload || isStudentScopedDashboard) &&
      (!Number.isFinite(n) || n === 0)
    ) {
      const perf = stats.course_performance;
      if (Array.isArray(perf) && perf.length > 0) {
        const codes = new Set(perf.map((r) => r?.course_code).filter(Boolean));
        if (codes.size > 0) n = codes.size;
      }
    }
    if (!Number.isFinite(n) || n < 0) {
      if (isStudentAnalyticsPayload || isStudentScopedDashboard) return 0;
      return null;
    }
    return Math.floor(n);
  })();

  const gradeSignals =
    (stats?.total_grades ?? 0) > 0 ||
    (stats?.completed_exams ?? 0) > 0 ||
    (Array.isArray(stats?.grade_distribution) && stats.grade_distribution.length > 0) ||
    (Array.isArray(stats?.course_performance) && stats.course_performance.length > 0);

  const avgGradeNum = Number(stats?.avg_grade);
  const showAverageGrade =
    (isStudentAnalyticsPayload || isStudentScopedDashboard || isStudentRole) &&
    Number.isFinite(avgGradeNum) &&
    (gradeSignals || avgGradeNum > 0);

  const avgGpa = stats?.avg_gpa;

  /** Attendance KPI: prefer % sessions present; if only avg hours exist (legacy), show hours. */
  const attendanceKpi = (() => {
    if (attendanceRatePct !== null) {
      return {
        value: formatPercent(attendanceRatePct),
        subtitle:
          stats?.attendance_sessions_recorded != null && stats.attendance_sessions_recorded > 0
            ? `${stats.attendance_sessions_recorded} session(s) on record; % = sessions marked present.`
            : stats?.attendance_sessions_recorded === 0
              ? 'No attendance sessions linked to your student record in facts yet.'
              : '% of attendance fact rows marked present.',
      };
    }
    const hrs = Number(stats?.avg_attendance);
    if (isStudentRole && Number.isFinite(hrs) && hrs > 0) {
      return {
        value: `${hrs.toFixed(1)} hrs`,
        subtitle: 'Average hours per attendance record (scoped to you). Use analytics student API for session %.',
      };
    }
    return {
      value: '–',
      subtitle: 'No attendance sessions linked to your student ID yet.',
    };
  })();

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
      <Card className={kpiStripCardClass}>
        <CardHeader className={chartCardHeaderClass}>
          <CardTitle className="text-base font-semibold tracking-tight">My academic overview</CardTitle>
          <CardDescription className={chartCardDescriptionClass}>
            KPIs use your enrollment, grades, attendance sessions, and tuition payments from the data warehouse.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <KPICard
              title="Courses registered"
              value={coursesRegistered !== null ? formatNumber(coursesRegistered) : '–'}
              icon={BookOpen}
              subtitle={
                isStudentAnalyticsPayload && stats?.enrollment_row_count != null
                  ? `${coursesRegistered ?? 0} distinct course code(s) · ${stats.enrollment_row_count} enrollment row(s) in facts.`
                  : isStudentScopedDashboard
                    ? 'Distinct course codes from your enrollments and grades (dashboard scope).'
                    : 'Distinct course codes from enrollments and grades (matched by student ID, reg. no., or access number).'
              }
            />
            <KPICard
              title="Average grade"
              value={showAverageGrade ? formatNumber(stats?.avg_grade) : '–'}
              icon={GraduationCap}
              subtitle={
                avgGpa != null && Number(avgGpa) > 0
                  ? `Numeric average on completed attempts · GPA ${Number(avgGpa).toFixed(2)}`
                  : 'Mean numeric score (coursework + exam) where the attempt is completed.'
              }
            />
            <KPICard
              title="Attendance"
              value={attendanceKpi.value}
              icon={CalendarCheck}
              subtitle={attendanceKpi.subtitle}
            />
            <KPICard
              title="Fees paid vs pending"
              value={`${formatPercent(paidPercentage)} paid`}
              icon={Wallet}
              subtitle={`${formatNumber(totalPaid)} paid / ${formatNumber(totalPending)} pending (successful vs outstanding)`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Academic performance & attendance (placeholders) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className={chartSurfaceCard('h-full')}>
          <CardHeader className={chartCardHeaderClass}>
            <CardTitle className={chartCardTitleClass}>Attendance over time</CardTitle>
            <CardDescription className={chartCardDescriptionClass}>
              Monthly buckets from the warehouse (dim_time), scoped to your JWT (student ID / access number).
              Green area: % of attendance records marked present; cyan: average hours per record in each month.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <StudentAttendanceTrendChart data={attendanceTrends} />
          </CardContent>
        </Card>

        <Card className={chartSurfaceCard('h-full')}>
          <CardHeader className={chartCardHeaderClass}>
            <CardTitle className={chartCardTitleClass}>Grades by course</CardTitle>
            <CardDescription className={chartCardDescriptionClass}>
              Average numeric score (completed attempts only) for each course × semester from{' '}
              <code className="text-[11px] bg-muted/80 px-1 rounded">fact_grade</code>. Bars are colored by
              score band (60 / 70 / 80).
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <StudentGradesByCourseChart rows={stats?.course_performance} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentDashboard;
