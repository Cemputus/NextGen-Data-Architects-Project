"""
Database table inventory (counts + lists) for documentation.

Run (from backend/):
  python scripts/db_table_inventory.py

It connects to PostgreSQL using backend/config.py and inspects each logical database.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, text

from config import (
    DB1_NAME,
    DB2_NAME,
    DATA_WAREHOUSE_NAME,
    get_sqlalchemy_conn_string,
)


NON_SYSTEM_SCHEMAS = ("pg_catalog", "information_schema")


def _importance(db: str, schema: str, table: str) -> str:
    t = table.lower()
    if db == "ucu_rbac":
        if t == "app_users":
            return "Application users + roles (authentication source of truth)."
        if t == "user_profiles":
            return "User profile metadata used by UI (names, photos, etc.)."
        if t == "user_state":
            return "Per-user persisted UI/workspace state (filters, settings, etc.)."
        if t == "audit_logs":
            return "Security + admin audit trail."
        if t.startswith("dashboard") or t in ("dashboards", "role_current_dashboard", "page_config"):
            return "Custom dashboards and role/user access control for dashboards."
        if "viz" in t or "query" in t:
            return "Analyst SQL workspace assets (saved/assigned visualizations, feedback)."
        return "RBAC / admin support table."

    if db == DATA_WAREHOUSE_NAME:
        if t.startswith("dim_"):
            return "Dimension table (descriptive attributes used to slice facts)."
        if t.startswith("fact_"):
            return "Fact table (measures/transactions used for KPIs and charts)."
        if t.endswith("_view") or "view" in t:
            return "Derived view for simplified analytics queries."
        if schema in (DB1_NAME, DB2_NAME):
            return "Source-mirror schema stored in warehouse DB (operational HR/admin tables)."
        return "Warehouse supporting table."

    if db in (DB1_NAME, DB2_NAME):
        return "Operational/source table used as ETL input (simulated source system)."

    if db == "airflow_meta":
        return "Airflow metadata table (DAG runs, task instances, schedules, etc.)."

    return "Application table."


@dataclass
class Inventory:
    database: str
    table_count: int
    tables: List[Dict[str, str]]


def inspect_database(dbname: str) -> Inventory:
    eng = create_engine(get_sqlalchemy_conn_string(dbname), pool_pre_ping=True, future=True)
    try:
        with eng.connect() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT table_schema, table_name
                    FROM information_schema.tables
                    WHERE table_type = 'BASE TABLE'
                      AND table_schema NOT IN ('pg_catalog', 'information_schema')
                    ORDER BY table_schema, table_name
                    """
                )
            ).fetchall()
        tables = []
        for schema, table in rows:
            tables.append(
                {
                    "schema": schema,
                    "table": table,
                    "importance": _importance(dbname, schema, table),
                }
            )
        return Inventory(database=dbname, table_count=len(tables), tables=tables)
    finally:
        try:
            eng.dispose()
        except Exception:
            pass


def main() -> None:
    dbs = [DB1_NAME, DB2_NAME, DATA_WAREHOUSE_NAME, "ucu_rbac", "airflow_meta"]
    out = {"databases": [], "generated_at": str(Path.cwd())}
    for db in dbs:
        try:
            inv = inspect_database(db)
            out["databases"].append(
                {
                    "database": inv.database,
                    "table_count": inv.table_count,
                    "tables": inv.tables,
                }
            )
        except Exception as e:
            out["databases"].append(
                {
                    "database": db,
                    "error": str(e),
                    "table_count": None,
                    "tables": [],
                }
            )
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()

