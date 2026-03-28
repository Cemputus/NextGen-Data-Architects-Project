/**
 * KPI IDs, chart IDs, and page config (Phase 1 central config).
 * Single source for dashboard builder and RoleDashboardRenderer; align with backend config/constants.py.
 */
export const KPI_OPTIONS = [
  'total_students',
  'avg_grade',
  'failed_exams',
  'missed_exams',
  'avg_attendance',
  'retention_rate',
  'graduation_rate',
];

export const CHART_OPTIONS = [
  'student_distribution',
  'grades_over_time',
  'payment_status',
  'grade_distribution',
  'top_students',
  'payment_trends',
  'attendance_trends',
];

/** Page visuals: FEX, High School, Risk. Role homes: Current + Custom in Dashboard Manager. */
export const PAGE_VISUAL_KEYS = [
  'fex_analytics',
  'high_school_analytics',
  'risk_analytics',
];

export const PAGE_VISUAL_LABELS = {
  fex_analytics: 'FEX Analytics',
  high_school_analytics: 'High School Analytics',
  risk_analytics: 'Risk Analytics',
};

/** @deprecated Use PAGE_VISUAL_KEYS — role dashboard keys removed. */
export const PAGE_CONFIG_KEYS = PAGE_VISUAL_KEYS;
/** @deprecated Use PAGE_VISUAL_LABELS */
export const PAGE_CONFIG_LABELS = PAGE_VISUAL_LABELS;

/** KPI definitions for RoleDashboardRenderer (key, label, subtitle, valuePath, isPercent). */
export const KPI_DEFINITIONS = [
  { key: 'total_students', label: 'Total Students', subtitle: 'Scoped by applied filters', valuePath: 'total_students' },
  { key: 'avg_grade', label: 'Average Grade', subtitle: 'Completed exams only', valuePath: 'avg_grade' },
  { key: 'failed_exams', label: 'Failed Exams (FEX)', subtitle: 'Total failed exam records', valuePath: 'failed_exams' },
  { key: 'missed_exams', label: 'Missed Exams (MEX)', subtitle: 'Total missed exam records', valuePath: 'missed_exams' },
  { key: 'avg_attendance', label: 'Avg Attendance', subtitle: 'Average total hours attended', valuePath: 'avg_attendance' },
  { key: 'retention_rate', label: 'Retention Rate', subtitle: 'Active students / total', valuePath: 'retention_rate', isPercent: true },
  { key: 'graduation_rate', label: 'Graduation Rate', subtitle: 'Graduated / total', valuePath: 'graduation_rate', isPercent: true },
];
