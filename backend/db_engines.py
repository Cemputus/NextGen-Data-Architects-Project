"""
Centralized SQLAlchemy engine factory.

Why: creating a new engine per request is expensive and can amplify latency/timeouts
under concurrent dashboard usage. We keep a small pool per connection string.
"""

from __future__ import annotations

import os
import threading
from functools import lru_cache

from sqlalchemy import create_engine

from config.connection import DATA_WAREHOUSE_CONN_STRING, DATA_WAREHOUSE_NAME


_lock = threading.Lock()


def _pool_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, str(default)).strip())
    except Exception:
        return default


def _make_engine(conn_str: str):
    pool_size = _pool_int("DB_POOL_SIZE", 10)
    max_overflow = _pool_int("DB_MAX_OVERFLOW", 20)
    pool_timeout = _pool_int("DB_POOL_TIMEOUT", 30)
    pool_recycle = _pool_int("DB_POOL_RECYCLE", 1800)
    web_stmt_timeout_ms = _pool_int("WEB_STATEMENT_TIMEOUT_MS", 8000)

    # pool_pre_ping helps avoid stale connections after idle periods/container restarts.
    return create_engine(
        conn_str,
        pool_pre_ping=True,
        pool_size=pool_size,
        max_overflow=max_overflow,
        pool_timeout=pool_timeout,
        pool_recycle=pool_recycle,
        # Bound slow queries so one user cannot block KPI loads for everyone.
        # (Postgres statement_timeout is in milliseconds.)
        connect_args={"options": f"-c statement_timeout={web_stmt_timeout_ms}"},
        future=True,
    )


@lru_cache(maxsize=8)
def get_engine(conn_str: str):
    # lru_cache is thread-safe for reads; keep explicit lock to avoid double-creation races.
    with _lock:
        return _make_engine(conn_str)


def get_dw_engine():
    return get_engine(DATA_WAREHOUSE_CONN_STRING)


def get_rbac_engine():
    rbac_conn = DATA_WAREHOUSE_CONN_STRING.replace(DATA_WAREHOUSE_NAME, "ucu_rbac")
    return get_engine(rbac_conn)

