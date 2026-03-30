from pathlib import Path
import json
import os
import shutil
import threading

import pandas as pd
from sqlalchemy import create_engine, text

from config import DATA_WAREHOUSE_CONN_STRING, DATA_WAREHOUSE_NAME
from api.auth import (
    _ensure_ucu_rbac_database,
    _ensure_app_users_table,
    _ensure_user_profiles_table,
    _ensure_user_state_table,
    RBAC_DB_NAME,
)

AUDIT_LOGS_EXPORT_LIMIT = 5000
ETL_RUNS_COPY_LIMIT = 50

def get_rbac_conn_string():
    return DATA_WAREHOUSE_CONN_STRING.replace(DATA_WAREHOUSE_NAME, RBAC_DB_NAME)

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

    try:
        limit = int(AUDIT_LOGS_EXPORT_LIMIT)
        df = pd.read_sql_query(
            text(f"SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT {limit}"),
            engine,
        )
        snapshot["audit_logs"] = df.to_dict(orient="records")
        print(f"Exported {len(df)} rows from audit_logs")
    except Exception as e:
        print(f"Warning: failed to export audit_logs: {e}")
        snapshot["audit_logs"] = []

    engine.dispose()

    backend_dir = Path(__file__).parent
    seeds_dir = backend_dir / "etl_seeds"
    seeds_dir.mkdir(parents=True, exist_ok=True)
    out_path = seeds_dir / "user_snapshot.json"
    def _normalize_json(obj):
        if isinstance(obj, dict):
            return {k: _normalize_json(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [_normalize_json(v) for v in obj]
        try:
            import math
            if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
                return None
        except Exception:
            pass
        return obj

    normalized_snapshot = _normalize_json(snapshot)
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(normalized_snapshot, f, indent=2, default=str)

    print(f"User snapshot written to {out_path}")

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

    settings_src = backend_dir / "data" / "admin_settings.json"
    settings_dst = seeds_dir / "admin_settings.json"
    if settings_src.exists():
        try:
            shutil.copy2(settings_src, settings_dst)
            print(f"Copied admin_settings.json to {settings_dst}")
        except Exception as e:
            print(f"Warning: failed to copy admin_settings: {e}")

    raw_log = os.environ.get("ETL_LOG_DIR")
    if raw_log and str(raw_log).strip():
        log_dir = Path(str(raw_log).strip()).resolve()
    else:
        log_dir = (backend_dir / "logs").resolve()
    etl_runs_dst = seeds_dir / "etl_runs"
    if log_dir.exists():
        try:
            etl_runs_dst.mkdir(parents=True, exist_ok=True)
            log_files = sorted(
                log_dir.glob("etl_pipeline_*.log"),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
            for log_file in log_files[:ETL_RUNS_COPY_LIMIT]:
                shutil.copy2(log_file, etl_runs_dst / log_file.name)
            print(f"Copied {min(len(log_files), ETL_RUNS_COPY_LIMIT)} ETL log(s) to {etl_runs_dst}")
        except Exception as e:
            print(f"Warning: failed to copy ETL runs: {e}")

def run_export_user_snapshot_async():
    def _run():
        try:
            export_user_snapshot()
        except Exception as e:
            print(f"[export_user_snapshot] Background export failed: {e}")

    t = threading.Thread(target=_run, daemon=True)
    t.start()

if __name__ == "__main__":
    export_user_snapshot()
