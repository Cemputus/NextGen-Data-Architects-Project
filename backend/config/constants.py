"""
Central constants: RBAC roles, KPI IDs, chart IDs, and page config keys.
Align with frontend config and master documentation.
"""
from rbac import Role

# All system roles (single source; backend rbac.py Role enum is authoritative)
RBAC_ROLES = [r.value for r in Role]

# Dashboard KPI keys (used by RoleDashboardRenderer, AnalystDashboardsPage, API)
KPI_IDS = [
    "total_students",
    "avg_grade",
    "failed_exams",
    "missed_exams",
    "avg_attendance",
    "retention_rate",
    "graduation_rate",
]

# Chart asset keys for dashboard builder and role dashboards
CHART_IDS = [
    "student_distribution",
    "grades_over_time",
    "payment_status",
    "grade_distribution",
    "top_students",
    "payment_trends",
    "attendance_trends",
]

# Page keys for analytics and role pages (analyst-editable KPIs/charts)
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
