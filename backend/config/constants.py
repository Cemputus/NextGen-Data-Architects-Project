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

# Standalone analytics page keys (role dashboards are managed in Dashboard Manager, not page_config).
PAGE_CONFIG_KEYS = [
    "fex_analytics",
    "high_school_analytics",
    "risk_analytics",
]

PAGE_CONFIG_LABELS = {
    "fex_analytics": "FEX Analytics",
    "high_school_analytics": "High School Analytics",
    "risk_analytics": "Risk Analytics",
}
