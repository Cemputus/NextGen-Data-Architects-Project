/**
 * Student Attendance Page - Independent page for viewing attendance
 */
import React, { useState, useEffect } from 'react';
import { Calendar, Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import ExportButtons from '../components/ExportButtons';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { SciLineChart } from '../components/charts/EChartsComponents';

const StudentAttendance = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [attendanceTrends, setAttendanceTrends] = useState([]);

  useEffect(() => {
    loadAttendance();
  }, []);

  const loadAttendance = async () => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem('ucu_session_token');
      const [statsRes, trendsRes] = await Promise.all([
        axios.get('/api/analytics/student', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios
          .get('/api/dashboard/attendance-trends', {
            params: { period: 'monthly' },
            headers: { Authorization: `Bearer ${token}` },
          })
          .catch(() => ({ data: null })),
      ]);

      setStats(statsRes.data);

      if (trendsRes.data && Array.isArray(trendsRes.data.periods)) {
        const trends = trendsRes.data.periods.map((period, idx) => ({
          period,
          attendance: trendsRes.data.attendance?.[idx] ?? 0,
        }));
        setAttendanceTrends(trends);
      } else {
        setAttendanceTrends([]);
      }
    } catch (err) {
      console.error('Error loading attendance:', err);
      try {
        const token = sessionStorage.getItem('ucu_session_token');
        const dash = await axios.get('/api/dashboard/stats', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (
          dash.data &&
          (dash.data.student_scoped_dashboard === true || dash.data.attendance_rate != null)
        ) {
          setStats(dash.data);
        } else {
          setStats(null);
        }
      } catch (_e) {
        setStats(null);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-9 w-9 animate-spin text-primary" />
      </div>
    );
  }

  /** % of attendance fact rows marked present (days_present 0/1); from student analytics or scoped dashboard. */
  const rateRaw = stats?.attendance_rate ?? stats?.attendance_rate_pct;
  const attendanceRatePct =
    rateRaw !== undefined && rateRaw !== null && String(rateRaw).trim() !== ''
      ? Number(rateRaw)
      : NaN;
  const attendanceRateDisplay = Number.isFinite(attendanceRatePct)
    ? `${Math.min(100, Math.max(0, attendanceRatePct)).toFixed(1)}%`
    : 'N/A';
  const sessionsRecorded = stats?.attendance_sessions_recorded;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">My Attendance</h1>
          <p className="text-sm text-muted-foreground">Track your class attendance and participation</p>
        </div>
        <ExportButtons stats={stats} filename="student_attendance" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
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
              <TrendingUp className="h-5 w-5" />
              Attendance Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{attendanceRateDisplay}</div>
            <p className="text-sm text-muted-foreground mt-2">
              Overall rate
              {sessionsRecorded != null && sessionsRecorded > 0
                ? ` · ${sessionsRecorded} session(s) in warehouse`
                : sessionsRecorded === 0
                  ? ' · no sessions in facts yet'
                  : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Trends</CardTitle>
          <CardDescription>Your attendance over time</CardDescription>
        </CardHeader>
        <CardContent>
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
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              No attendance trend data available yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentAttendance;






