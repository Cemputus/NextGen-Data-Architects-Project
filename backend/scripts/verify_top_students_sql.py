"""
Smoke-test the top-students SQL against the configured data warehouse (PostgreSQL).

Usage (from repo root or backend/):
  python scripts/verify_top_students_sql.py

Set SKIP_DW_TESTS=1 to exit 0 without connecting (CI without Postgres).
"""
from __future__ import annotations

import os
import sys

# Ensure backend package root is on path when run as script
_BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)


def main() -> int:
    if os.environ.get("SKIP_DW_TESTS", "").strip().lower() in ("1", "true", "yes", "on"):
        print("SKIP_DW_TESTS set — skipping warehouse check.")
        return 0

    from sqlalchemy import text
    import pandas as pd

    import app as app_module
    from db_engines import get_dw_engine

    eff = app_module._sql_effective_grade_numeric("fg")
    join_clause = """
            LEFT JOIN dim_student ds ON fg.student_id = ds.student_id
            LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
            LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
            LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
    """
    where_clauses = [
        app_module._sql_grade_has_outcome_for_analytics("fg"),
        f"({eff}) IS NOT NULL",
    ]
    where_clause = "WHERE " + " AND ".join(where_clauses)
    limit = 5
    query = f"""
        SELECT
            COALESCE(
                NULLIF(TRIM(CONCAT(COALESCE(MAX(ds.first_name::text), ''), ' ', COALESCE(MAX(ds.last_name::text), ''))), ''),
                fg.student_id::text
            ) AS student_name,
            AVG({eff}) AS avg_grade
        FROM fact_grade fg
        {join_clause}
        {where_clause}
        GROUP BY fg.student_id
        HAVING AVG({eff}) IS NOT NULL
        ORDER BY avg_grade DESC
        LIMIT {limit}
    """

    engine = get_dw_engine()
    print("Running institution-wide top-students shaped query (limit 5)...")
    with engine.connect() as conn:
        conn.execute(text(f"EXPLAIN {query}"))
    df = pd.read_sql_query(text(query), engine)
    print(f"OK: {len(df)} row(s) returned (max 5).")
    if not df.empty:
        print(df.to_string(index=False))

    eff_fb = app_module._sql_effective_grade_numeric("fg")
    fb_where = [
        app_module._sql_grade_has_outcome_for_analytics("fg"),
        f"({eff_fb}) IS NOT NULL",
    ]
    fb_sql = f"""
        SELECT fg.student_id::text AS student_name,
               AVG({eff_fb}) AS avg_grade
        FROM fact_grade fg
        WHERE {' AND '.join(fb_where)}
        GROUP BY fg.student_id
        HAVING AVG({eff_fb}) IS NOT NULL
        ORDER BY avg_grade DESC
        LIMIT {limit}
    """
    print("\nRunning fact-only fallback shaped query (limit 5)...")
    with engine.connect() as conn:
        conn.execute(text(f"EXPLAIN {fb_sql}"))
    df2 = pd.read_sql_query(text(fb_sql), engine)
    print(f"OK: {len(df2)} row(s) returned (max 5).")
    if not df2.empty:
        print(df2.to_string(index=False))

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        print(f"FAILED: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        raise SystemExit(1)
