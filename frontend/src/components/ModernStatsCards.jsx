
import React from 'react';
import { KPICard } from './ui/kpi-card';
import { DashboardGrid } from './ui/dashboard-grid';
import { 
  Users, BookOpen, GraduationCap, TrendingUp, 
  DollarSign, Calendar, Award, Activity, School, Target
} from 'lucide-react';

const ModernStatsCards = ({ stats, type = 'general' }) => {
  if (!stats) return null;

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
        <KPICard
          title="Residence"
          value={stats.residence_status || 'Unknown'}
          icon={Users}
          subtitle="Resident vs non-resident"
        />
      </DashboardGrid>
    );
  }

  if (type === 'faculty' || type === 'dean' || type === 'hod') {
    const ek = stats?.enrollment_kpi_kind;
    const enrollmentSubtitle =
      ek === 'faculty_enrollment_records'
        ? 'Enrollment rows in your faculty (JWT scope)'
        : ek === 'department_enrollment_records'
          ? 'Enrollment rows in your department (JWT scope)'
          : 'Active enrollments';
    const gk = stats?.grade_kpi_kind;
    const gradeSubtitle =
      gk === 'faculty_grade_average'
        ? 'Completed exams; faculty scope + filters on grade rows'
        : gk === 'department_grade_average'
          ? 'Completed exams; department scope + filters on grade rows'
          : 'Faculty average (completed exams)';
    const rk = stats?.retention_kpi_kind;
    const retentionSubtitle =
      rk === 'faculty_retention'
        ? 'Active vs total in faculty scope (same as headcount filters)'
        : rk === 'department_retention'
          ? 'Active vs total in department scope (same as headcount filters)'
          : 'Student retention';
    return (
      <DashboardGrid cols={{ default: 2, sm: 2, md: 4, lg: 5 }}>
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
          subtitle={gradeSubtitle}
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
          subtitle={enrollmentSubtitle}
        />
        <KPICard
          title="Retention rate"
          value={
            stats.avg_retention_rate != null
              ? `${Number(stats.avg_retention_rate).toFixed(1)}%`
              : stats.retention_rate != null
                ? `${Number(stats.retention_rate).toFixed(1)}%`
                : '0%'
          }
          icon={Target}
          subtitle={retentionSubtitle}
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

  if (type === 'staff') {
    const isClassStudents = stats?.enrollment_kpi_kind === 'assigned_class_students';
    const assignedClassGrades = stats?.grade_kpi_kind === 'assigned_class_grade_average';
    const assignedClassRetention = stats?.retention_kpi_kind === 'assigned_class_retention';
    return (
      <DashboardGrid cols={{ default: 2, sm: 2, md: 3, lg: 5 }}>
        <KPICard
          title="Total Students"
          value={stats.total_students || 0}
          icon={Users}
          subtitle="Students linked to your assigned classes"
        />
        <KPICard
          title={isClassStudents ? 'Students in your classes' : 'Total enrollments'}
          value={stats.total_enrollments || 0}
          icon={Activity}
          subtitle={
            isClassStudents
              ? 'Distinct students enrolled in courses assigned to you'
              : 'Enrollment records'
          }
        />
        <KPICard
          title="Average Grade"
          value={stats.avg_grade ? `${stats.avg_grade.toFixed(1)}%` : 'N/A'}
          icon={GraduationCap}
          subtitle={
            assignedClassGrades
              ? 'Completed exams only in courses assigned to you'
              : 'Completed exams in your scope'
          }
        />
        <KPICard
          title="Retention rate"
          value={
            stats.avg_retention_rate != null
              ? `${Number(stats.avg_retention_rate).toFixed(1)}%`
              : stats.retention_rate != null
                ? `${Number(stats.retention_rate).toFixed(1)}%`
                : 'N/A'
          }
          icon={Target}
          subtitle={
            assignedClassRetention
              ? 'Active vs total among students in your assigned classes'
              : 'Active vs total students in scope'
          }
        />
        <KPICard
          title="Avg Attendance"
          value={stats.avg_attendance ? `${stats.avg_attendance.toFixed(1)}%` : 'N/A'}
          icon={Calendar}
          subtitle="Average attendance (hours)"
        />
      </DashboardGrid>
    );
  }

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
