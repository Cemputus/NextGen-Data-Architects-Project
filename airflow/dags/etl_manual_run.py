"""
Airflow DAG for manual ETL runs triggered from the Admin UI.

This DAG deliberately ignores the auto-run toggle and interval; it simply
executes a full ETL run (export_user_snapshot + etl_pipeline) once per trigger.
"""

import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

from airflow import DAG
from airflow.operators.python import PythonOperator


AIRFLOW_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = AIRFLOW_DIR.parent
BACKEND_DIR = PROJECT_ROOT / "backend"


def run_manual_etl():
    """
    Entry point for manual ETL runs.

    This mirrors the behavior of backend/app.py::_run_etl_subprocess so logs and
    side effects stay consistent with existing tooling and the Admin UI.
    """
    env = os.environ.copy()
    env.setdefault("PYTHONPATH", str(BACKEND_DIR))

    # 1) Export current user snapshot (best-effort).
    try:
        subprocess.run(
            [sys.executable, "-m", "export_user_snapshot"],
            cwd=str(BACKEND_DIR),
            env=env,
            check=False,
            timeout=60,
        )
    except subprocess.TimeoutExpired:
        # Non-fatal for manual runs.
        pass

    # 2) Run the main ETL pipeline (fail task if ETL fails).
    result = subprocess.run(
        [sys.executable, "-m", "etl_pipeline"],
        cwd=str(BACKEND_DIR),
        env=env,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        msg = (
            f"etl_pipeline failed with code {result.returncode}\n"
            f"STDOUT:\n{result.stdout}\n"
            f"STDERR:\n{result.stderr}\n"
        )
        raise RuntimeError(msg)

    return "Manual ETL run completed successfully."


default_args = {
    "owner": "etl",
    "depends_on_past": False,
    "retries": 0,
}


with DAG(
    dag_id="etl_manual_run",
    description="On-demand ETL pipeline run triggered from the Admin UI.",
    default_args=default_args,
    start_date=datetime(2024, 1, 1),
    schedule_interval=None,  # Only run when explicitly triggered.
    catchup=False,
    max_active_runs=1,
    tags=["etl", "manual"],
) as dag:
    run_manual_etl_task = PythonOperator(
        task_id="run_manual_etl",
        python_callable=run_manual_etl,
    )

