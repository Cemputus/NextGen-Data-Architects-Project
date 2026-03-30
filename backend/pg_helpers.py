import psycopg2
from psycopg2 import sql as pgsql
from sqlalchemy import create_engine, text
from config import PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, DATA_WAREHOUSE_NAME

def get_pg_conn(dbname=None, autocommit=False):
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
    conn = get_pg_conn(autocommit=True)
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (dbname,))
        if cur.fetchone() is None:
            cur.execute(pgsql.SQL("CREATE DATABASE {}").format(pgsql.Identifier(dbname)))
        cur.close()
    finally:
        conn.close()

def ensure_ucu_rbac_database():
    try:
        from config.connection import RBAC_DB_NAME
    except Exception:
        RBAC_DB_NAME = "ucu_rbac"
    if RBAC_DB_NAME == DATA_WAREHOUSE_NAME:
        return
    ensure_database(RBAC_DB_NAME)

def ensure_data_warehouse():
    ensure_database(DATA_WAREHOUSE_NAME)
