"""
Academic calendar and time logic (Phase 1 central config).
UCU: 3 intakes (J=January, M=May, S=September); semester names and start dates.
"""

# Academic years (format used in setup_databases and analytics)
ACADEMIC_YEARS = ["2021/2022", "2022/2023", "2023/2024", "2024/2025"]

# UCU semester names: Jan (Easter), May (Trinity), September (Advent)
SEMESTERS = [
    "Jan (Easter Semester)",
    "May (Trinity Semester)",
    "September (Advent)",
]

# Map semester name pattern to (month, day) for semester start date
# Used by ETL and analytics for payment/grade windows
SEMESTER_START_RULES = [
    ("Jan", (1, 15)),
    ("Easter", (1, 15)),
    ("May", (5, 15)),
    ("Trinity", (5, 15)),
    ("September", (8, 29)),
    ("Advent", (8, 29)),
]
