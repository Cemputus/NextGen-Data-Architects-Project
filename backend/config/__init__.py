"""
Central configuration for NextGen Analytics Platform (Phase 1–5).
Single source for:
- RBAC role constants, KPI/chart/page IDs, academic calendar.
- Database connection settings and warehouse connection strings.
- Flask secret keys.

Docker imports `config` as a package, so all commonly used settings must be
available from here (e.g. DATA_WAREHOUSE_CONN_STRING, PG_HOST, SECRET_KEY).
"""
from pathlib import Path
import os

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
from config.connection import (
    PG_HOST,
    PG_PORT,
    PG_USER,
    PG_PASSWORD,
    DB1_NAME,
    DB2_NAME,
    DATA_WAREHOUSE_NAME,
    RBAC_DB_NAME,
    DB1_CONN_STRING,
    DB2_CONN_STRING,
    DATA_WAREHOUSE_CONN_STRING,
    get_sqlalchemy_conn_string,
    get_pg_params,
    BASE_DIR,
    CSV1_PATH,
    CSV2_PATH,
    BRONZE_PATH,
    SILVER_PATH,
    GOLD_PATH,
    USE_SYNTHETIC_DATA,
    SYNTHETIC_DATA_DIR,
    SECRET_KEY,
    JWT_SECRET_KEY,
)


"""
This package re-exports runtime configuration from `config.connection` and other
config modules. Avoid re-defining paths here — `BASE_DIR` must point to the
`backend/` directory so ETL can reliably find `backend/data/Synthetic_Data`.
"""


__all__ = [
    # RBAC / dashboard constants
    "RBAC_ROLES",
    "KPI_IDS",
    "CHART_IDS",
    "PAGE_CONFIG_KEYS",
    "PAGE_CONFIG_LABELS",
    "ACADEMIC_YEARS",
    "SEMESTERS",
    "SEMESTER_START_RULES",
    # Database / Postgres
    "PG_HOST",
    "PG_PORT",
    "PG_USER",
    "PG_PASSWORD",
    "DB1_NAME",
    "DB2_NAME",
    "DATA_WAREHOUSE_NAME",
    "RBAC_DB_NAME",
    "DB1_CONN_STRING",
    "DB2_CONN_STRING",
    "DATA_WAREHOUSE_CONN_STRING",
    "get_sqlalchemy_conn_string",
    "get_pg_params",
    "CSV1_PATH",
    "CSV2_PATH",
    "BRONZE_PATH",
    "SILVER_PATH",
    "GOLD_PATH",
    "USE_SYNTHETIC_DATA",
    "SYNTHETIC_DATA_DIR",
    # Flask secrets
    "SECRET_KEY",
    "JWT_SECRET_KEY",
    # Paths / data
    "BASE_DIR",
    "CSV1_PATH",
    "CSV2_PATH",
    "BRONZE_PATH",
    "SILVER_PATH",
    "GOLD_PATH",
    "USE_SYNTHETIC_DATA",
    "SYNTHETIC_DATA_DIR",
]
