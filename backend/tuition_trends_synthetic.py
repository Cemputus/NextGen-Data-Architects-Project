"""
Synthetic Tuition payment trends payload when the warehouse returns no rows.
Only used for institution-wide analyst/finance/senate/sysadmin views (no dimensional filters).
"""
from rbac import Role


def _filter_active(filters):
    if not filters:
        return False
    for key in (
        'faculty_id',
        'department_id',
        'program_id',
        'semester_id',
        'high_school',
        'intake_year',
        'course_code',
    ):
        raw = filters.get(key)
        if raw is None:
            continue
        s = str(raw).strip().lower()
        if s and s != 'all':
            return True
    return False


def should_use_synthetic_tuition_trends(filters, role, enabled):
    """
    When True, caller may return illustrative series so the dashboard chart is never empty
    for unscoped roles. Disabled via TUITION_TRENDS_SYNTHETIC_FALLBACK=0.
    """
    if not enabled:
        return False
    if role not in (Role.ANALYST, Role.FINANCE, Role.SENATE, Role.SYSADMIN):
        return False
    if _filter_active(filters or {}):
        return False
    return True


def build_synthetic_tuition_trends(period):
    """Build plausible avg-completed series labels matching SQL output shapes."""
    p = (period or 'yearly').strip().lower()
    if p == 'monthly':
        periods = [
            'January 2024',
            'February 2024',
            'March 2024',
            'April 2024',
            'May 2024',
            'June 2024',
            'July 2024',
            'August 2024',
            'September 2024',
            'October 2024',
            'November 2024',
            'December 2024',
        ]
    elif p == 'yearly':
        periods = ['2021', '2022', '2023', '2024', '2025']
    else:
        periods = [
            'Q1 2023',
            'Q2 2023',
            'Q3 2023',
            'Q4 2023',
            'Q1 2024',
            'Q2 2024',
            'Q3 2024',
            'Q4 2024',
        ]

    n = len(periods)
    base = 1_420_000.0
    faculty_amounts = []
    department_amounts = []
    program_amounts = []
    for i in range(n):
        f_amt = base + i * 68_000.0 + (i % 5) * 31_000.0
        faculty_amounts.append(round(f_amt, 2))
        department_amounts.append(round(f_amt * 0.96, 2))
        program_amounts.append(round(f_amt * 0.91, 2))

    return {
        'periods': periods,
        'faculty_amounts': faculty_amounts,
        'department_amounts': department_amounts,
        'program_amounts': program_amounts,
        'synthetic': True,
    }
