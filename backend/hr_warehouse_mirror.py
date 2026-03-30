from __future__ import annotations

import logging
import os
import random
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, text

from config import DB2_NAME

logger = logging.getLogger(__name__)

_SQL_FILE = Path(__file__).resolve().parent / "sql" / "hr_admin_warehouse_schemas.sql"

def _apply_schema_ddl(engine) -> None:
    if not _SQL_FILE.is_file():
        raise FileNotFoundError(f"Missing HR mirror DDL: {_SQL_FILE}")
    raw = _SQL_FILE.read_text(encoding="utf-8")
    lines = []
    for line in raw.splitlines():
        stripped = line.strip()
        if stripped.startswith("--"):
            continue
        lines.append(line)
    cleaned = "\n".join(lines)
    stmts = [s.strip() for s in cleaned.split(";") if s.strip()]
    with engine.begin() as conn:
        for stmt in stmts:
            conn.execute(text(stmt))

def _weekdays_chronological(count: int, end: date | None = None) -> list[date]:
    end = end or date.today()
    out: list[date] = []
    d = end
    while len(out) < count:
        if d.weekday() < 5:
            out.append(d)
        d -= timedelta(days=1)
    out.reverse()
    return out

def _attendance_series_end_date(engine) -> date:
    candidates = [
        "SELECT MAX(date) AS d FROM dim_time WHERE date IS NOT NULL",
        (
            "SELECT MAX(to_date(CAST(date_key AS TEXT), 'YYYYMMDD')) AS d "
            "FROM fact_enrollment WHERE date_key IS NOT NULL AND CAST(date_key AS TEXT) <> ''"
        ),
        (
            "SELECT MAX(to_date(CAST(date_key AS TEXT), 'YYYYMMDD')) AS d "
            "FROM fact_attendance WHERE date_key IS NOT NULL AND CAST(date_key AS TEXT) <> ''"
        ),
        (
            "SELECT MAX(to_date(CAST(date_key AS TEXT), 'YYYYMMDD')) AS d "
            "FROM fact_payment WHERE date_key IS NOT NULL AND CAST(date_key AS TEXT) <> ''"
        ),
    ]
    for q in candidates:
        try:
            row = pd.read_sql_query(text(q), engine)
            if row.empty:
                continue
            raw = row.iloc[0]["d"]
            if raw is None or (isinstance(raw, float) and pd.isna(raw)):
                continue
            return pd.Timestamp(raw).date()
        except Exception:
            continue
    return date.today()

def _count_dim_employees_without_valid_org(engine) -> int:
    try:
        row = pd.read_sql_query(
            text(
                """
                SELECT COUNT(*) AS c
                FROM dim_employee e
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM dim_department d
                    INNER JOIN dim_faculty f ON d.faculty_id = f.faculty_id
                    WHERE d.department_id = e.department_id
                )
                """
            ),
            engine,
        )
        return int(row.iloc[0]["c"])
    except Exception:
        return 0

def _pick_status(rng: random.Random) -> str:
    r = rng.random()
    if r < 0.78:
        return "Present"
    if r < 0.85:
        return "Absent"
    if r < 0.95:
        return "Late"
    return "On Leave"

def _bulk_insert_employee_attendance(engine, rows: list[tuple]) -> None:
    if not rows:
        return
    try:
        from psycopg2.extras import execute_values
    except ImportError:
        execute_values = None

    if execute_values is None:
        ins = text(
            """
            INSERT INTO ucu_sourcedb2.employee_attendance ("EmployeeID", "Date", "Status")
            VALUES (:eid, :dt, :st)
            """
        )
        with engine.begin() as conn:
            for eid, d, st in rows:
                conn.execute(ins, {"eid": eid, "dt": d, "st": st})
        return

    raw = engine.raw_connection()
    try:
        cur = raw.cursor()
        execute_values(
            cur,
            'INSERT INTO ucu_sourcedb2.employee_attendance ("EmployeeID", "Date", "Status") VALUES %s',
            rows,
            page_size=3000,
        )
        raw.commit()
    except Exception:
        try:
            raw.rollback()
        except Exception:
            pass
        raise
    finally:
        raw.close()

def count_employee_attendance_rows(engine) -> int:
    try:
        return int(
            pd.read_sql_query(
                text(f"SELECT COUNT(*) AS c FROM {DB2_NAME}.employee_attendance"),
                engine,
            ).iloc[0]["c"]
        )
    except Exception:
        return 0

def ensure_hr_admin_mirror_for_attendance(engine) -> None:
    if os.environ.get("SKIP_HR_ADMIN_MIRROR", "").strip().lower() in ("1", "true", "yes"):
        return
    try:
        n_fac = int(
            pd.read_sql_query(text("SELECT COUNT(*) AS c FROM dim_faculty"), engine).iloc[0]["c"]
        )
        n_dep = int(
            pd.read_sql_query(text("SELECT COUNT(*) AS c FROM dim_department"), engine).iloc[0]["c"]
        )
        n_emp = int(
            pd.read_sql_query(text("SELECT COUNT(*) AS c FROM dim_employee"), engine).iloc[0]["c"]
        )
    except Exception as e:
        logger.debug("ensure_hr_admin_mirror_for_attendance: dims unavailable (%s)", e)
        return
    if n_fac == 0 or n_dep == 0 or n_emp == 0:
        return
    try:
        n_att = count_employee_attendance_rows(engine)
    except Exception:
        n_att = 0
    if n_att > 0:
        return
    orphans = _count_dim_employees_without_valid_org(engine)
    if orphans >= n_emp:
        logger.debug(
            "ensure_hr_admin_mirror_for_attendance: no mirror possible (all %s dim_employee rows lack dept/faculty chain)",
            n_emp,
        )
        return
    try:
        stats = seed_hr_admin_mirror(engine)
        logger.info("HR admin mirror seeded for attendance trend: %s", stats)
    except Exception as e:
        logger.warning("ensure_hr_admin_mirror_for_attendance failed: %s", e, exc_info=True)

def seed_hr_admin_mirror(
    engine,
    *,
    attendance_weekdays: int = 65,
    random_seed: int = 42,
) -> dict:
    if os.environ.get("SKIP_HR_ADMIN_MIRROR", "").strip().lower() in ("1", "true", "yes"):
        return {"skipped": True, "reason": "SKIP_HR_ADMIN_MIRROR"}

    _apply_schema_ddl(engine)

    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE dim_employee ADD COLUMN IF NOT EXISTS date_of_birth DATE"))
    except Exception:
        pass

    try:
        n_fac = pd.read_sql_query(text("SELECT COUNT(*) AS c FROM dim_faculty"), engine).iloc[0]["c"]
        n_dept = pd.read_sql_query(text("SELECT COUNT(*) AS c FROM dim_department"), engine).iloc[0]["c"]
        n_emp = pd.read_sql_query(text("SELECT COUNT(*) AS c FROM dim_employee"), engine).iloc[0]["c"]
    except Exception as e:
        logger.warning("HR admin mirror: warehouse dims not ready (%s)", e)
        return {"skipped": True, "reason": "dims_unavailable"}

    if int(n_fac) == 0 or int(n_dept) == 0 or int(n_emp) == 0:
        logger.info(
            "HR admin mirror: skip (empty dim_faculty=%s dim_department=%s dim_employee=%s)",
            n_fac,
            n_dept,
            n_emp,
        )
        return {"skipped": True, "reason": "empty_dims", "faculties": int(n_fac), "departments": int(n_dept), "employees": int(n_emp)}

    excluded_orphans = _count_dim_employees_without_valid_org(engine)
    if excluded_orphans:
        logger.warning(
            "HR admin mirror: %s dim_employee row(s) skipped (no matching dim_department/faculty)",
            excluded_orphans,
        )

    series_end = _attendance_series_end_date(engine)
    rng = random.Random(random_seed)
    weekdays = _weekdays_chronological(attendance_weekdays, end=series_end)

    trunc_stmts = [
        "TRUNCATE TABLE ucu_sourcedb2.employee_attendance RESTART IDENTITY",
        "TRUNCATE TABLE ucu_sourcedb2.employees",
        "TRUNCATE TABLE ucu_sourcedb2.positions",
        "TRUNCATE TABLE ucu_sourcedb1.departments",
        "TRUNCATE TABLE ucu_sourcedb1.faculties",
    ]
    with engine.begin() as conn:
        for ts in trunc_stmts:
            conn.execute(text(ts))

        conn.execute(
            text(
                """
                INSERT INTO ucu_sourcedb1.faculties ("FacultyID", "FacultyName", "DeanName")
                SELECT faculty_id, faculty_name, COALESCE(dean_name, '')
                FROM dim_faculty
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO ucu_sourcedb1.departments (
                    "DepartmentID", "DepartmentName", "FacultyID", "HeadOfDepartment"
                )
                SELECT department_id, department_name, faculty_id, COALESCE(head_of_department, '')
                FROM dim_department
                """
            )
        )

        conn.execute(
            text(
                """
                INSERT INTO ucu_sourcedb2.positions ("PositionID", "PositionTitle", "DepartmentID", "SalaryScale")
                VALUES
                    (1, 'Lecturer', NULL, 0),
                    (2, 'Assistant Lecturer', NULL, 0),
                    (3, 'Administrative Staff', NULL, 0)
                """
            )
        )

        conn.execute(
            text(
                """
                INSERT INTO ucu_sourcedb2.employees (
                    "EmployeeID", "FullName", "PositionID", "DepartmentID", "ContractType", "Status", "DateOfBirth"
                )
                SELECT
                    e.employee_id,
                    e.full_name,
                    CASE
                        WHEN e.position_id IN (1, 2, 3) THEN e.position_id
                        ELSE 3
                    END,
                    e.department_id,
                    COALESCE(NULLIF(TRIM(e.contract_type), ''), 'Full-Time'),
                    COALESCE(NULLIF(TRIM(e.status), ''), 'Active'),
                    e.date_of_birth::date
                FROM dim_employee e
                INNER JOIN dim_department d ON e.department_id = d.department_id
                INNER JOIN dim_faculty f ON d.faculty_id = f.faculty_id
                """
            )
        )

    emp_ids = pd.read_sql_query(
        text('SELECT "EmployeeID" AS eid FROM ucu_sourcedb2.employees'),
        engine,
    )["eid"].astype(int).tolist()

    if not emp_ids and int(n_emp) > 0:
        logger.error(
            "HR mirror: inserted 0 mirrored employees but dim_employee has %s row(s). "
            "Every row must join dim_department and dim_faculty (valid department_id and faculty_id).",
            n_emp,
        )

    rows: list[tuple[int, date, str]] = []
    for d in weekdays:
        for eid in emp_ids:
            rows.append((int(eid), d, _pick_status(rng)))

    if rows:
        _bulk_insert_employee_attendance(engine, rows)

    return {
        "skipped": False,
        "faculties": int(n_fac),
        "departments": int(n_dept),
        "employees": len(emp_ids),
        "attendance_rows": len(rows),
        "weekdays": len(weekdays),
        "series_end_date": str(series_end),
        "dim_employees_excluded_orphans": excluded_orphans,
    }

def main() -> None:
    logging.basicConfig(level=logging.INFO)
    from config import DATA_WAREHOUSE_CONN_STRING

    eng = create_engine(DATA_WAREHOUSE_CONN_STRING)
    stats = seed_hr_admin_mirror(eng)
    print(stats)

if __name__ == "__main__":
    main()
