"""
Central configuration for NextGen Analytics Platform.

This package exposes:
- RBAC and dashboard constants (for UI/logic)
- Database connection strings and PostgreSQL settings (for app/ETL)
- Flask secret keys

Docker imports `config` as a package, so all commonly used settings must be
available from here (e.g. DATA_WAREHOUSE_CONN_STRING, PG_HOST, SECRET_KEY).
"""
from pathlib import Path
from urllib.parse import urlparse, quote_plus
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


# ==================== PostgreSQL & Warehouse Settings ====================

# When deploying (e.g. Render or Docker), DATABASE_URL can be set and overrides PG_*.
_db_url = os.environ.get("DATABASE_URL")
if _db_url:
    if _db_url.startswith("postgres://"):
        _db_url = "postgresql://" + _db_url.split("://", 1)[1]
    _p = urlparse(_db_url)
    _host = _p.hostname or "localhost"
    _port = _p.port or 5432
    _user = _p.username or "postgres"
    _password = (_p.password or "") if _p.password is not None else ""
    PG_HOST = os.environ.get("PG_HOST", _host)
    PG_PORT = os.environ.get("PG_PORT", str(_port))
    PG_USER = os.environ.get("PG_USER", _user)
    PG_PASSWORD = os.environ.get("PG_PASSWORD", _password)
else:
    PG_HOST = os.environ.get("PG_HOST", "localhost")
    PG_PORT = os.environ.get("PG_PORT", "5432")
    PG_USER = os.environ.get("PG_USER", "postgres")
    PG_PASSWORD = os.environ.get("PG_PASSWORD", "postgres")

# Database names (PostgreSQL)
DB1_NAME = "ucu_sourcedb1"
DB2_NAME = "ucu_sourcedb2"
DATA_WAREHOUSE_NAME = "ucu_datawarehouse"


def get_sqlalchemy_conn_string(database_name: str) -> str:
    """Generate SQLAlchemy connection string for PostgreSQL."""
    password_encoded = quote_plus(PG_PASSWORD) if PG_PASSWORD else ""
    if password_encoded:
        return f"postgresql+psycopg2://{PG_USER}:{password_encoded}@{PG_HOST}:{PG_PORT}/{database_name}"
    return f"postgresql+psycopg2://{PG_USER}@{PG_HOST}:{PG_PORT}/{database_name}"


DB1_CONN_STRING = get_sqlalchemy_conn_string(DB1_NAME)
DB2_CONN_STRING = get_sqlalchemy_conn_string(DB2_NAME)
DATA_WAREHOUSE_CONN_STRING = get_sqlalchemy_conn_string(DATA_WAREHOUSE_NAME)


def get_pg_params(database_name: str):
    """Generate psycopg2 connection parameters."""
    return {
        "host": PG_HOST,
        "port": int(PG_PORT),
        "user": PG_USER,
        "password": PG_PASSWORD,
        "dbname": database_name,
    }


# ==================== Flask Secrets ====================

SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-change-in-production")
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "jwt-secret-key-change-in-production")


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
    "DB1_CONN_STRING",
    "DB2_CONN_STRING",
    "DATA_WAREHOUSE_CONN_STRING",
    "get_pg_params",
    "get_sqlalchemy_conn_string",
    # Flask secrets
    "SECRET_KEY",
    "JWT_SECRET_KEY",
]
