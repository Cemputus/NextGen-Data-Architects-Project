"""
Airflow DAG that orchestrates the automatic ETL pipeline.

It replaces the legacy Flask background timer in backend/app.py by:
- Reading admin_settings.json for:
  - etl_auto_enabled: master toggle
  - etl_auto_interval_minutes: interval in minutes
  - last_etl_auto_run: unix timestamp of last auto ETL
- Only running the ETL when the toggle is enabled and the interval has elapsed.

The DAG itself is scheduled to run frequently (every minute) but will no-op
unless a run is actually due, so you can change the interval and toggle from
the Admin UI without redeploying or editing Airflow.
"""

import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

from airflow import DAG
from airflow.operators.python import PythonOperator


# Resolve backend directory relative to this DAG file.
AIRFLOW_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = AIRFLOW_DIR.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
ADMIN_SETTINGS_FILE = BACKEND_DIR / "data" / "admin_settings.json"


def _load_admin_settings():
    if not ADMIN_SETTINGS_FILE.exists():
        return {}
    try:
        with ADMIN_SETTINGS_FILE.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _save_admin_settings(settings):
    try:
        ADMIN_SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with ADMIN_SETTINGS_FILE.open("w", encoding="utf-8") as f:
            json.dump(settings, f, indent=2)
    except Exception:
        # In Airflow context we don't want to fail the whole DAG on a settings write issue.
        pass


def check_and_run_etl():
    """
    Airflow task entrypoint: enforce "Run ETL automatically" toggle and interval.

    - If etl_auto_enabled is False → do nothing.
    - If first time enabling auto-run → set last_etl_auto_run anchor and exit.
    - If interval not yet elapsed → do nothing.
    - Otherwise → update last_etl_auto_run and run export_user_snapshot + etl_pipeline.
    """
    settings = _load_admin_settings()

    # Master toggle: if disabled, don't run anything.
    if not settings.get("etl_auto_enabled"):
        return "Auto ETL disabled; skipping."

    interval_min = float(settings.get("etl_auto_interval_minutes") or 60)
    # Keep the same semantics as the legacy scheduler: minimum 1 minute for safety/tests.
    interval_sec = max(60, int(interval_min * 60))

    last_run = settings.get("last_etl_auto_run")
    now_sec = time.time()

    # First time auto is enabled: set anchor so first run happens after one full interval.
    if last_run is None:
        settings["last_etl_auto_run"] = now_sec
        _save_admin_settings(settings)
        return "Initialized last_etl_auto_run anchor; will run after first full interval."

    try:
        if isinstance(last_run, (int, float)):
            last_sec = float(last_run)
        else:
            # Support legacy ISO timestamps if present.
            last_sec = datetime.fromisoformat(str(last_run).replace("Z", "+00:00")).timestamp()
    except Exception:
        last_sec = 0

    if (now_sec - last_sec) < interval_sec:
        return f"Interval not yet elapsed (remaining {int(interval_sec - (now_sec - last_sec))}s); skipping."

    # Mark as run now so the Admin UI countdown uses the fresh anchor.
    settings["last_etl_auto_run"] = now_sec
    _save_admin_settings(settings)

    # Run the same commands the backend uses so logs and behavior stay consistent.
    env = os.environ.copy()
    # Make sure Python can import backend modules when running as a subprocess.
    env.setdefault("PYTHONPATH", str(BACKEND_DIR))

    # 1) Export the current user snapshot (best-effort; non-fatal on failure/timeout).
    try:
        subprocess.run(
            [sys.executable, "-m", "export_user_snapshot"],
            cwd=str(BACKEND_DIR),
            env=env,
            check=False,
            timeout=60,
        )
    except subprocess.TimeoutExpired:
        # Non-fatal: proceed to ETL anyway.
        pass

    # 2) Run the main ETL pipeline. If this fails, we want the Airflow task to fail.
    result = subprocess.run(
        [sys.executable, "-m", "etl_pipeline"],
        cwd=str(BACKEND_DIR),
        env=env,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        # Surface stderr/stdout in the Airflow logs for debugging.
        msg = (
            f"etl_pipeline failed with code {result.returncode}\n"
            f"STDOUT:\n{result.stdout}\n"
            f"STDERR:\n{result.stderr}\n"
        )
        raise RuntimeError(msg)

    return "ETL pipeline completed successfully."


default_args = {
    "owner": "etl",
    "depends_on_past": False,
    "retries": 0,
}


with DAG(
    dag_id="etl_auto_scheduler",
    description="Automatic ETL pipeline orchestrated by Airflow, driven by admin settings toggle and interval.",
    default_args=default_args,
    start_date=datetime(2024, 1, 1),
    schedule_interval="* * * * *",  # Run every minute; task logic enforces actual interval.
    catchup=False,
    max_active_runs=1,
    tags=["etl", "auto"],
) as dag:
    check_and_run_etl_task = PythonOperator(
        task_id="check_and_run_etl",
        python_callable=check_and_run_etl,
    )

