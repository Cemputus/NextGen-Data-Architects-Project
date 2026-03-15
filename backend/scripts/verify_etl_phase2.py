"""
Phase 2 ETL verification: data quality and schema alignment checks.
Run from backend/ with: python scripts/verify_etl_phase2.py
Requires DATA_WAREHOUSE_CONN_STRING (config.py) and a completed ETL run.
"""
import sys
import importlib.util
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

# Load backend config.py (file), not the config package
_spec = importlib.util.spec_from_file_location("_config_env", backend_dir / "config.py")
_config_env = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_config_env)
DATA_WAREHOUSE_CONN_STRING = _config_env.DATA_WAREHOUSE_CONN_STRING

from sqlalchemy import create_engine, text


def run():
    engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
    results = []

    with engine.connect() as conn:
        # 2.3.1 Row counts (Bronze/Silver are parquet; we check Gold)
        for name, table in [
            ("dim_student", "dim_student"),
            ("dim_course", "dim_course"),
            ("dim_semester", "dim_semester"),
            ("fact_grade", "fact_grade"),
            ("fact_payment", "fact_payment"),
            ("fact_attendance", "fact_attendance"),
        ]:
            try:
                r = conn.execute(text(f"SELECT COUNT(*) AS c FROM {table}")).fetchone()
                results.append((f"count_{table}", r[0] if r else 0, None))
            except Exception as e:
                results.append((f"count_{table}", None, str(e)))

        # 2.3.2 Uniqueness: reg_no and access_number in dim_student
        try:
            r = conn.execute(text("""
                SELECT
                    COUNT(*) AS total,
                    COUNT(DISTINCT reg_no) AS distinct_reg_no,
                    COUNT(DISTINCT access_number) AS distinct_access_number
                FROM dim_student
                WHERE reg_no IS NOT NULL AND reg_no != ''
            """)).fetchone()
            if r:
                total, d_reg, d_acc = r[0], r[1], r[2]
                ok = total == 0 or (d_reg == total and (d_acc == total or d_acc is None))
                results.append(("unique_reg_access", ok, None if ok else f"total={total} distinct_reg={d_reg} distinct_access={d_acc}"))
            else:
                results.append(("unique_reg_access", None, "no rows"))
        except Exception as e:
            results.append(("unique_reg_access", None, str(e)))

        # 2.3.3 FCW/MEX/FEX and exam_status distribution in fact_grade
        try:
            r = conn.execute(text("""
                SELECT exam_status, COUNT(*) AS c
                FROM fact_grade
                GROUP BY exam_status
                ORDER BY exam_status
            """)).fetchall()
            dist = {row[0]: row[1] for row in r} if r else {}
            results.append(("exam_status_distribution", dist, None))
        except Exception as e:
            results.append(("exam_status_distribution", None, str(e)))

        # 2.3.4 grade_points populated (Phase 2; column added by ETL or ALTER)
        try:
            r = conn.execute(text("""
                SELECT
                    COUNT(*) AS total,
                    COUNT(grade_points) AS with_grade_points
                FROM fact_grade
            """)).fetchone()
            if r:
                total, with_gp = r[0], r[1]
                ok = total == 0 or with_gp == total
                results.append(("grade_points_populated", with_gp == total if total else True, None if ok else f"total={total} with_grade_points={with_gp}"))
            else:
                results.append(("grade_points_populated", None, "no rows"))
        except Exception as e:
            if "grade_points" in str(e) and "does not exist" in str(e).lower():
                results.append(("grade_points_populated", False, "column missing (run ETL or ALTER TABLE fact_grade ADD COLUMN grade_points DECIMAL(3,2))"))
            else:
                results.append(("grade_points_populated", None, str(e)))

        # 2.3.5 Faculty/department coverage (dim_student -> dim_program -> dim_department -> dim_faculty)
        try:
            r = conn.execute(text("""
                SELECT
                    (SELECT COUNT(DISTINCT faculty_id) FROM dim_faculty) AS faculties,
                    (SELECT COUNT(DISTINCT d.department_id) FROM dim_department d) AS depts,
                    (SELECT COUNT(DISTINCT p.program_id) FROM dim_program p) AS programs
            """)).fetchone()
            results.append(("coverage_fac_dept_program", (r[0], r[1], r[2]) if r else None, None))
        except Exception as e:
            results.append(("coverage_fac_dept_program", None, str(e)))

        # 2.3.6 Analyst views exist (created by ETL from sql/analyst_views.sql)
        for view in ["view_analyst_grade", "view_fcw_mex_fex_summary", "view_fcw_mex_fex_by_faculty"]:
            try:
                conn.execute(text(f"SELECT 1 FROM {view} LIMIT 1"))
                results.append((view, True, None))
            except Exception as e:
                results.append((view, False, str(e)))

    # Print report
    print("Phase 2 ETL verification report")
    print("-" * 50)
    for name, value, err in results:
        if err:
            print(f"  {name}: ERROR - {err}")
        else:
            print(f"  {name}: {value}")
    print("-" * 50)
    return 0 if all(r[2] is None for r in results) else 1


if __name__ == "__main__":
    sys.exit(run())
