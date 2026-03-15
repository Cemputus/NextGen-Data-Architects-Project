"""
Central configuration for NextGen Analytics Platform (Phase 1).
Single source for RBAC role constants, KPI/chart/page IDs, and academic calendar.
"""
from config.constants import (
    RBAC_ROLES,
    KPI_IDS,
    CHART_IDS,
    PAGE_CONFIG_KEYS,
    PAGE_CONFIG_LABELS,
)
from config.academic import (
    ACADEMIC_YEARS,
    SEMESTERS,
    SEMESTER_START_RULES,
)

__all__ = [
    "RBAC_ROLES",
    "KPI_IDS",
    "CHART_IDS",
    "PAGE_CONFIG_KEYS",
    "PAGE_CONFIG_LABELS",
    "ACADEMIC_YEARS",
    "SEMESTERS",
    "SEMESTER_START_RULES",
]
