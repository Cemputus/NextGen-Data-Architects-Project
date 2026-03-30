from rbac import Role

RBAC_ROLES = [r.value for r in Role]

KPI_IDS = [
    "total_students",
    "avg_grade",
    "failed_exams",
    "missed_exams",
    "avg_attendance",
    "retention_rate",
    "graduation_rate",
]

CHART_IDS = [
    "student_distribution",
    "grades_over_time",
    "payment_status",
    "grade_distribution",
    "top_students",
    "payment_trends",
    "attendance_trends",
]

PAGE_CONFIG_KEYS = [
    "fex_analytics",
    "high_school_analytics",
    "risk_analytics",
    "analyst_dashboard",
    "dean_dashboard",
    "hod_dashboard",
    "senate_dashboard",
    "staff_dashboard",
    "student_dashboard",
    "finance_dashboard",
    "hr_dashboard",
]

PAGE_CONFIG_LABELS = {
    "fex_analytics": "FEX Analytics",
    "high_school_analytics": "High School Analytics",
    "risk_analytics": "Risk Analytics",
    "analyst_dashboard": "Analyst Dashboard",
    "dean_dashboard": "Dean Dashboard",
    "hod_dashboard": "HoD Dashboard",
    "senate_dashboard": "Senate Dashboard",
    "staff_dashboard": "Staff Dashboard",
    "student_dashboard": "Student Dashboard",
    "finance_dashboard": "Finance Dashboard",
    "hr_dashboard": "HR Dashboard",
}
