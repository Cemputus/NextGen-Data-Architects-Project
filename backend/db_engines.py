from __future__ import annotations

import os
import threading
from functools import lru_cache

from sqlalchemy import create_engine

from config.connection import DATA_WAREHOUSE_CONN_STRING


_lock = threading.Lock()


def _pool_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, str(default)).strip())
    except Exception:
        return default


def _make_engine(conn_str: str):
    return create_engine(
        conn_str,
        pool_pre_ping=True,
        pool_size=_pool_int("DB_POOL_SIZE", 10),
        max_overflow=_pool_int("DB_MAX_OVERFLOW", 20),
        pool_timeout=_pool_int("DB_POOL_TIMEOUT", 30),
        pool_recycle=_pool_int("DB_POOL_RECYCLE", 1800),
        connect_args={"options": f"-c statement_timeout={_pool_int('WEB_STATEMENT_TIMEOUT_MS', 8000)}"},
        future=True,
    )


@lru_cache(maxsize=8)
def get_engine(conn_str: str):
    with _lock:
        return _make_engine(conn_str)


def get_dw_engine():
    return get_engine(DATA_WAREHOUSE_CONN_STRING)


def get_rbac_engine():
    from config.connection import get_sqlalchemy_conn_string, RBAC_DB_NAME
    return get_engine(get_sqlalchemy_conn_string(RBAC_DB_NAME))
