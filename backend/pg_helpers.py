"""
PostgreSQL database helper module.
Centralises all DB creation and connection logic that previously used pymysql.
Every file in the project imports from here instead of using pymysql directly.
"""
import psycopg2
from psycopg2 import sql as pgsql
from sqlalchemy import create_engine, text
from config import PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, DATA_WAREHOUSE_NAME


def get_pg_conn(dbname=None, autocommit=False):
    """Return a raw psycopg2 connection.  If *dbname* is None, connect to the
    default ``postgres`` maintenance DB (useful for CREATE DATABASE)."""
    conn = psycopg2.connect(
        host=PG_HOST,
        port=int(PG_PORT),
        user=PG_USER,
        password=PG_PASSWORD or "",
        dbname=dbname or "postgres",
    )
    if autocommit:
        conn.autocommit = True
    return conn


def ensure_database(dbname: str):
    """Create a PostgreSQL database if it does not already exist."""
    conn = get_pg_conn(autocommit=True)
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (dbname,))
        if cur.fetchone() is None:
            # Use SQL identifier quoting to avoid injection
            cur.execute(pgsql.SQL("CREATE DATABASE {}").format(pgsql.Identifier(dbname)))
        cur.close()
    finally:
        conn.close()


def ensure_ucu_rbac_database():
    """Ensure the ucu_rbac database exists."""
    ensure_database("ucu_rbac")


def ensure_data_warehouse():
    """Ensure the data warehouse database exists."""
    ensure_database(DATA_WAREHOUSE_NAME)
