"""
Very small in-memory TTL cache for API responses.

Purpose: reduce repeated heavy KPI/chart queries when multiple users load the same
dashboard or when the frontend re-requests quickly due to filter changes.

Notes:
- Per-process cache (each Gunicorn worker has its own cache).
- Safe defaults; can be disabled via CACHE_ENABLED=0.
"""

from __future__ import annotations

import json
import os
import threading
import time
from dataclasses import dataclass
from typing import Any, Optional, Tuple


def _env_bool(name: str, default: bool = True) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return str(raw).strip().lower() not in ("0", "false", "no", "off", "")


CACHE_ENABLED = _env_bool("CACHE_ENABLED", True)


@dataclass(frozen=True)
class CacheEntry:
    expires_at: float
    payload_json: str


_lock = threading.Lock()
_cache: dict[str, CacheEntry] = {}


def _now() -> float:
    return time.time()


def make_key(prefix: str, *, claims: dict | None = None, params: dict | None = None) -> str:
    """
    Build a stable cache key from endpoint + user scope + params.
    We only include a subset of claims that affect data scoping.
    """
    claims = claims or {}
    params = params or {}
    scope = {
        "role": (claims.get("role") or "").__str__().lower(),
        "faculty_id": claims.get("faculty_id"),
        "department_id": claims.get("department_id"),
        "student_id": claims.get("student_id"),
        "staff_id": claims.get("staff_id"),
        "access_number": claims.get("access_number"),
        "username": claims.get("username") or claims.get("sub"),
    }
    blob = {"scope": scope, "params": params}
    return prefix + ":" + json.dumps(blob, sort_keys=True, default=str)


def get_json(key: str) -> Optional[str]:
    if not CACHE_ENABLED:
        return None
    with _lock:
        ent = _cache.get(key)
        if not ent:
            return None
        if ent.expires_at <= _now():
            _cache.pop(key, None)
            return None
        return ent.payload_json


def set_json(key: str, payload_json: str, ttl_seconds: int) -> None:
    if not CACHE_ENABLED:
        return
    exp = _now() + max(1, int(ttl_seconds))
    with _lock:
        _cache[key] = CacheEntry(expires_at=exp, payload_json=payload_json)


def clear_prefix(prefix: str) -> int:
    """Best-effort invalidation by prefix."""
    with _lock:
        keys = [k for k in _cache.keys() if k.startswith(prefix)]
        for k in keys:
            _cache.pop(k, None)
        return len(keys)

