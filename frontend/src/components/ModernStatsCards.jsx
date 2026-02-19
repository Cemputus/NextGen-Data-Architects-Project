/**
 * Modern Power BI-style KPI Cards
 * Using shadcn/ui components
 */
import React from 'react';
import { KPICard } from './ui/kpi-card';
import { DashboardGrid } from './ui/dashboard-grid';
import { 
  Users, BookOpen, GraduationCap, TrendingUp, 
  DollarSign, Calendar, Award, Activity, School, Target
} from 'lucide-react';

const ModernStatsCards = ({ stats, type = 'general' }) => {
  if (!stats) return null;

  // Main Dashboard KPIs - Requested by user
  if (type === 'general' || type === 'institution' || type === 'senate') {
    return (
      <DashboardGrid cols={{ default: 2, sm: 2, md: 4 }}>
        <KPICard
          title="Total High Schools"
          value={stats.total_high_schools || stats.high_schools_count || 0}
          icon={School}
          subtitle="Registered high schools"
        />
        <KPICard
          title="Total Students"
          value={stats.total_students || 0}
          change={stats.students_change ? `${stats.students_change > 0 ? '+' : ''}${stats.students_change}` : null}
          changeType={stats.students_change > 0 ? 'positive' : stats.students_change < 0 ? 'negative' : 'neutral'}
          icon={Users}
          subtitle="Enrolled students"
        />
        <KPICard
          title="Avg Retention Rate"
          value={stats.avg_retention_rate ? `${stats.avg_retention_rate.toFixed(1)}%` : stats.retention_rate ? `${stats.retention_rate.toFixed(1)}%` : '0%'}
          change={stats.retention_change ? `${stats.retention_change > 0 ? '+' : ''}${stats.retention_change.toFixed(1)}%` : null}
          changeType={stats.retention_change > 0 ? 'positive' : stats.retention_change < 0 ? 'negative' : 'neutral'}
          icon={Target}
          subtitle="Student retention"
        />
        <KPICard
          title="Avg Graduation Rate"
          value={stats.avg_graduation_rate ? `${stats.avg_graduation_rate.toFixed(1)}%` : stats.graduation_rate ? `${stats.graduation_rate.toFixed(1)}%` : '0%'}
          change={stats.graduation_change ? `${stats.graduation_change > 0 ? '+' : ''}${stats.graduation_change.toFixed(1)}%` : null}
          changeType={stats.graduation_change > 0 ? 'positive' : stats.graduation_change < 0 ? 'negative' : 'neutral'}
          icon={GraduationCap}
          subtitle="Graduation success rate"
        />
      </DashboardGrid>
    );
  }

  // Student Dashboard KPIs
  if (type === 'student') {
    return (
      <DashboardGrid cols={{ default: 2, sm: 2, md: 4 }}>
        <KPICard
          title="Current GPA"
          value={stats.gpa || 'N/A'}
          change={stats.gpa_change ? `${stats.gpa_change > 0 ? '+' : ''}${stats.gpa_change.toFixed(2)}` : null}
          changeType={stats.gpa_change > 0 ? 'positive' : stats.gpa_change < 0 ? 'negative' : 'neutral'}
          icon={Award}
          subtitle="Overall Grade Point Average"
        />
        <KPICard
          title="Courses Enrolled"
          value={stats.total_courses || 0}
          icon={BookOpen}
          subtitle="Active courses this semester"
        />
        <KPICard
          title="Attendance Rate"
          value={stats.attendance_rate ? `${stats.attendance_rate.toFixed(1)}%` : 'N/A'}
          change={stats.attendance_change ? `${stats.attendance_change > 0 ? '+' : ''}${stats.attendance_change.toFixed(1)}%` : null}
          changeType={stats.attendance_change > 0 ? 'positive' : stats.attendance_change < 0 ? 'negative' : 'neutral'}
          icon={Calendar}
          subtitle="This semester"
        />
        <KPICard
          title="Payment Status"
          value={stats.payment_status || 'Pending'}
          icon={DollarSign}
          subtitle={stats.payment_amount ? `UGX ${(stats.payment_amount / 1000000).toFixed(1)}M` : 'No payment data'}
        />
      </DashboardGrid>
    );
  }

  // Faculty/Dean Dashboard KPIs
  if (type === 'faculty' || type === 'dean') {
    return (
      <DashboardGrid cols={{ default: 2, sm: 2, md: 4, lg: 6 }}>
        <KPICard
          title="Total Students"
          value={stats.total_students || 0}
          change={stats.students_change ? `${stats.students_change > 0 ? '+' : ''}${stats.students_change}` : null}
          changeType={stats.students_change > 0 ? 'positive' : stats.students_change < 0 ? 'negative' : 'neutral'}
          icon={Users}
          subtitle="Enrolled students"
        />
        <KPICard
          title="Total Courses"
          value={stats.total_courses || 0}
          icon={BookOpen}
          subtitle="Active courses"
        />
        <KPICard
          title="Average Grade"
          value={stats.avg_grade ? `${stats.avg_grade.toFixed(1)}%` : 'N/A'}
          change={stats.grade_change ? `${stats.grade_change > 0 ? '+' : ''}${stats.grade_change.toFixed(1)}%` : null}
          changeType={stats.grade_change > 0 ? 'positive' : stats.grade_change < 0 ? 'negative' : 'neutral'}
          icon={GraduationCap}
          subtitle="Faculty average"
        />
        <KPICard
          title="Total Revenue"
          value={stats.total_payments ? `UGX ${(stats.total_payments / 1000000).toFixed(1)}M` : 'UGX 0M'}
          icon={DollarSign}
          subtitle="This academic year"
        />
        <KPICard
          title="Enrollments"
          value={stats.total_enrollments || 0}
          icon={Activity}
          subtitle="Active enrollments"
        />
        <KPICard
          title="Attendance Rate"
          value={stats.avg_attendance ? `${stats.avg_attendance.toFixed(1)}%` : 'N/A'}
          icon={Calendar}
          subtitle="Average attendance"
        />
      </DashboardGrid>
    );
  }

  // Finance Dashboard KPIs
  if (type === 'finance') {
    return (
      <DashboardGrid cols={{ default: 2, sm: 2, md: 4 }}>
        <KPICard
          title="Total Revenue"
          value={stats.total_revenue ? `UGX ${(stats.total_revenue / 1000000).toFixed(1)}M` : stats.total_payments ? `UGX ${(stats.total_payments / 1000000).toFixed(1)}M` : 'UGX 0M'}
          change={stats.revenue_change ? `${stats.revenue_change > 0 ? '+' : ''}${((stats.revenue_change / (stats.total_revenue || stats.total_payments || 1)) * 100).toFixed(1)}%` : null}
          changeType={stats.revenue_change > 0 ? 'positive' : stats.revenue_change < 0 ? 'negative' : 'neutral'}
          icon={DollarSign}
          subtitle="This period"
        />
        <KPICard
          title="Outstanding Payments"
          value={stats.outstanding ? `UGX ${(stats.outstanding / 1000000).toFixed(1)}M` : 'UGX 0M'}
          icon={TrendingUp}
          subtitle="Pending collections"
        />
        <KPICard
          title="Payment Rate"
          value={stats.payment_rate ? `${stats.payment_rate.toFixed(1)}%` : 'N/A'}
          icon={Activity}
          subtitle="Collection efficiency"
        />
        <KPICard
          title="Total Students"
          value={stats.total_students || 0}
          icon={Users}
          subtitle="Fee-paying students"
        />
      </DashboardGrid>
    );
  }

  // HR Dashboard KPIs
  if (type === 'hr') {
    return (
      <DashboardGrid cols={{ default: 2, sm: 2, md: 4 }}>
        <KPICard
          title="Total Employees"
          value={stats.total_employees || 0}
          icon={Users}
          subtitle="Active staff"
        />
        <KPICard
          title="Departments"
          value={stats.total_departments || 0}
          icon={BookOpen}
          subtitle="Active departments"
        />
        <KPICard
          title="Attendance Rate"
          value={stats.attendance_rate ? `${stats.attendance_rate.toFixed(1)}%` : 'N/A'}
          icon={Calendar}
          subtitle="Employee attendance"
        />
        <KPICard
          title="Payroll Total"
          value={stats.total_payroll ? `UGX ${(stats.total_payroll / 1000000).toFixed(1)}M` : 'UGX 0M'}
          icon={DollarSign}
          subtitle="Monthly payroll"
        />
      </DashboardGrid>
    );
  }

  // Default fallback
  return (
    <DashboardGrid cols={{ default: 2, sm: 2, md: 4 }}>
      <KPICard
        title="Total High Schools"
        value={stats.total_high_schools || stats.high_schools_count || 0}
        icon={School}
      />
      <KPICard
        title="Total Students"
        value={stats.total_students || 0}
        icon={Users}
      />
      <KPICard
        title="Avg Retention Rate"
        value={stats.avg_retention_rate ? `${stats.avg_retention_rate.toFixed(1)}%` : '0%'}
        icon={Target}
      />
      <KPICard
        title="Avg Graduation Rate"
        value={stats.avg_graduation_rate ? `${stats.avg_graduation_rate.toFixed(1)}%` : '0%'}
        icon={GraduationCap}
      />
    </DashboardGrid>
  );
};

export default ModernStatsCards;
