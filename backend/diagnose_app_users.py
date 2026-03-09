#!/usr/bin/env python3
"""
Diagnostic script: Check app_users, dim_app_user, and login readiness.
Uses psycopg2 only (no sqlalchemy). Run from backend: python diagnose_app_users.py
"""
import sys
import json
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

def main():
    try:
        from config import PG_HOST, PG_PORT, PG_USER, PG_PASSWORD
        import psycopg2
    except ImportError as e:
        print(f"ERROR: {e}. Install: pip install psycopg2-binary")
        return

    def query(db_name, sql, params=None):
        conn = psycopg2.connect(
            host=PG_HOST, port=int(PG_PORT), user=PG_USER, password=PG_PASSWORD or "",
            dbname=db_name
        )
        conn.autocommit = True
        try:
            with conn.cursor() as cur:
                cur.execute(sql, params or ())
                return cur.fetchall()
        finally:
            conn.close()

    print("=" * 60)
    print("APP USERS & DIM_APP_USER DIAGNOSTIC")
    print("=" * 60)
    print(f"PostgreSQL: {PG_HOST}:{PG_PORT} user={PG_USER}")
    print()

    # 1. ucu_rbac.app_users
    print("[1] ucu_rbac.app_users (live login table)")
    print("-" * 40)
    try:
        rows = query("ucu_rbac", "SELECT COUNT(*) FROM app_users")
        n = rows[0][0] if rows else 0
        print(f"    Count: {n} user(s)")
        if n > 0:
            rows = query("ucu_rbac", "SELECT id, username, role, full_name FROM app_users ORDER BY username LIMIT 15")
            for r in rows:
                print(f"      - id={r[0]} | {r[1]} | role={r[2]} | {r[3] or '-'}")
    except Exception as e:
        print(f"    ERROR: {e}")
    print()

    # 2. dim_app_user
    print("[2] UCU_DataWarehouse.dim_app_user")
    print("-" * 40)
    try:
        rows = query("UCU_DataWarehouse", "SELECT COUNT(*) FROM dim_app_user")
        n = rows[0][0] if rows else 0
        print(f"    Count: {n} user(s)")
        if n > 0:
            rows = query("UCU_DataWarehouse", "SELECT app_user_id, username, role, full_name FROM dim_app_user ORDER BY username LIMIT 15")
            for r in rows:
                print(f"      - app_user_id={r[0]} | {r[1]} | role={r[2]} | {r[3] or '-'}")
    except Exception as e:
        print(f"    ERROR: {e}")
    print()

    # 3. Sync check
    print("[3] Sync check")
    print("-" * 40)
    try:
        app_rows = query("ucu_rbac", "SELECT id, username FROM app_users")
        dim_rows = query("UCU_DataWarehouse", "SELECT app_user_id, username FROM dim_app_user")
        app_ids = {r[0]: r[1] for r in app_rows}
        dim_ids = {r[0]: r[1] for r in dim_rows}
        in_both = set(app_ids) & set(dim_ids)
        only_app = set(app_ids) - set(dim_ids)
        only_dim = set(dim_ids) - set(app_ids)
        print(f"    In both: {len(in_both)}")
        if only_app:
            print(f"    Only in app_users (missing from dim): {list(only_app)[:5]}")
        if only_dim:
            print(f"    Only in dim_app_user (missing from app_users): {list(only_dim)[:5]}")
    except Exception as e:
        print(f"    ERROR: {e}")
    print()

    # 4. user_snapshot.json
    print("[4] user_snapshot.json")
    print("-" * 40)
    snap_path = backend_dir / "etl_seeds" / "user_snapshot.json"
    snap = {}
    if snap_path.exists():
        with open(snap_path, "r", encoding="utf-8") as f:
            snap = json.load(f)
        users = snap.get("app_users", [])
        print(f"    app_users in snapshot: {len(users)}")
        for u in users[:5]:
            print(f"      - {u.get('username', '?')} | role={u.get('role', '?')}")
    else:
        print(f"    File not found: {snap_path}")
    print()

    # 5. Root cause & fix
    print("[5] Root cause & fix")
    print("-" * 40)
    try:
        app_count = query("ucu_rbac", "SELECT COUNT(*) FROM app_users")[0][0]
        snap_count = len(snap.get("app_users", []))
        if app_count == 0 and snap_count > 0:
            print("    ROOT CAUSE: app_users is EMPTY but snapshot has users.")
            print("    FIX: Run ETL to seed app_users from user_snapshot.json")
            print("         (Admin Console -> ETL Jobs -> Run ETL)")
        elif app_count > 0:
            print("    app_users has data - users can log in.")
    except Exception:
        pass
    print("=" * 60)

if __name__ == "__main__":
    main()
