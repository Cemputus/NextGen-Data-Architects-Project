#!/usr/bin/env python3
"""
One-shot health check for HR Attendance trend + Attendance rate KPI.
Run from the backend folder:  python check_hr_attendance_setup.py

Prints warehouse + mirror counts and attempts to seed if dims exist but attendance is empty.
"""
from __future__ import annotations

import os
import sys

from sqlalchemy import create_engine, text


def main() -> int:
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    try:
        from config import DATA_WAREHOUSE_CONN_STRING, DB2_NAME
    except ImportError as e:
        print("FAIL: cannot import config — run this script from the backend directory:", e)
        return 1

    skip = os.environ.get("SKIP_HR_ADMIN_MIRROR", "").strip().lower() in ("1", "true", "yes")
    if skip:
        print("WARN: SKIP_HR_ADMIN_MIRROR is set — mirror seeding is disabled. Unset it for attendance data.")

    engine = create_engine(DATA_WAREHOUSE_CONN_STRING)

    def count_q(sql: str) -> str:
        try:
            import pandas as pd

            n = int(pd.read_sql_query(text(sql), engine).iloc[0, 0])
            return str(n)
        except Exception as e:
            return f"ERROR ({e})"

    print("=== HR attendance / warehouse check ===")
    print(f"Database (warehouse): {DATA_WAREHOUSE_CONN_STRING.split('@')[-1] if '@' in DATA_WAREHOUSE_CONN_STRING else DATA_WAREHOUSE_CONN_STRING}")
    print(f"Mirror schema (DB2): {DB2_NAME}")
    print()
    print("dim_faculty:     ", count_q("SELECT COUNT(*) FROM dim_faculty"))
    print("dim_department:  ", count_q("SELECT COUNT(*) FROM dim_department"))
    print("dim_employee:    ", count_q("SELECT COUNT(*) FROM dim_employee"))
    print(f'{DB2_NAME}.employees:      ', count_q(f'SELECT COUNT(*) FROM "{DB2_NAME}".employees'))
    print(
        f'{DB2_NAME}.employee_attendance:',
        count_q(f'SELECT COUNT(*) FROM "{DB2_NAME}".employee_attendance'),
    )
    print()

    # Orphan employees (no valid dept+faculty chain)
    orphans = count_q(
        """
        SELECT COUNT(*) FROM dim_employee e
        WHERE NOT EXISTS (
            SELECT 1 FROM dim_department d
            INNER JOIN dim_faculty f ON d.faculty_id = f.faculty_id
            WHERE d.department_id = e.department_id
        )
        """
    )
    print("dim_employee rows WITHOUT valid dept→faculty chain:", orphans)
    print()

    try:
        from hr_warehouse_mirror import seed_hr_admin_mirror, count_employee_attendance_rows
    except ImportError as e:
        print("FAIL: hr_warehouse_mirror import:", e)
        print("Fix: run from backend folder; ensure hr_warehouse_mirror.py exists next to config.py")
        return 1

    n_att = count_employee_attendance_rows(engine)
    if n_att == 0 and not skip:
        print("Attempting seed_hr_admin_mirror() …")
        try:
            stats = seed_hr_admin_mirror(engine)
            print("Result:", stats)
            print("employee_attendance rows after seed:", count_employee_attendance_rows(engine))
        except Exception as e:
            print("Seed FAILED:", e)
            import traceback

            traceback.print_exc()
            return 1
    elif n_att == 0 and skip:
        print("Skipping seed because SKIP_HR_ADMIN_MIRROR is set.")
    else:
        print("employee_attendance already has rows; no seed run.")

    final = count_employee_attendance_rows(engine)
    print()
    if final and str(final).isdigit() and int(final) > 0:
        print("OK: Attendance data exists — HR trend + rate KPI should work after backend restart.")
        return 0
    print("NOT OK: Still no employee_attendance rows.")
    print("  - Run ETL: python etl_pipeline.py")
    print("  - If dim_employee > 0 but orphans = dim_employee, fix department_id / faculty_id in dims.")
    return 2


if __name__ == "__main__":
    sys.exit(main())
