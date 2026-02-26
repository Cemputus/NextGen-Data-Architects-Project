"""
Export RBAC / app-user data to a JSON snapshot for reproducible ETL.

Run this ONCE (or whenever you want to refresh the snapshot) in the
authoritative environment:

    cd backend
    python export_user_snapshot.py

It will produce backend/etl_seeds/user_snapshot.json containing:
  - app_users
  - user_profiles
  - user_state

The ETL pipeline (etl_pipeline.py) will then load this snapshot into a
clean environment so all app users, profiles, and workspace state are
recreated.
"""
from pathlib import Path
import json
import shutil

import pandas as pd
from sqlalchemy import create_engine, text

from config import DATA_WAREHOUSE_CONN_STRING
from api.auth import (
    _ensure_ucu_rbac_database,
    _ensure_app_users_table,
    _ensure_user_profiles_table,
    _ensure_user_state_table,
    RBAC_DB_NAME,
)


def get_rbac_conn_string():
    # Mirror how RBAC_CONN_STRING is built in auth.py without importing it directly
    return DATA_WAREHOUSE_CONN_STRING.replace("UCU_DataWarehouse", RBAC_DB_NAME)


def export_user_snapshot():
    _ensure_ucu_rbac_database()
    engine = create_engine(get_rbac_conn_string())
    _ensure_app_users_table(engine)
    _ensure_user_profiles_table(engine)
    _ensure_user_state_table(engine)

    snapshot = {}
    tables = ["app_users", "user_profiles", "user_state"]

    for table in tables:
        try:
            df = pd.read_sql_query(text(f"SELECT * FROM {table}"), engine)
            snapshot[table] = df.to_dict(orient="records")
            print(f"Exported {len(df)} rows from {table}")
        except Exception as e:
            print(f"Warning: failed to export table {table}: {e}")

    engine.dispose()

    backend_dir = Path(__file__).parent
    seeds_dir = backend_dir / "etl_seeds"
    seeds_dir.mkdir(parents=True, exist_ok=True)
    out_path = seeds_dir / "user_snapshot.json"
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(snapshot, f, indent=2, default=str)

    print(f"User snapshot written to {out_path}")

    # Also copy current profile photos into etl_seeds/profile_photos so they can be
    # versioned and later restored on other environments.
    photos_src = backend_dir / "data" / "profile_photos"
    photos_dst = seeds_dir / "profile_photos"
    if photos_src.exists():
        try:
            if photos_dst.exists():
                shutil.rmtree(photos_dst)
            shutil.copytree(photos_src, photos_dst)
            print(f"Copied profile photos from {photos_src} to {photos_dst}")
        except Exception as e:
            print(f"Warning: failed to copy profile photos snapshot: {e}")


if __name__ == "__main__":
    export_user_snapshot()

