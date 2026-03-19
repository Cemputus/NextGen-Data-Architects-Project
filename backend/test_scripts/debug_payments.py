import sys
sys.path.append("backend")

import config
import pandas as pd
from sqlalchemy import create_engine


def main():
    engine = create_engine(config.DATA_WAREHOUSE_CONN_STRING)
    sem = pd.read_sql_query(
        "SELECT MAX(semester_id) AS sem FROM fact_payment WHERE semester_id IS NOT NULL",
        engine,
    )["sem"][0]

    if sem is None:
        print("latest_sem: None")
        return

    sem = int(sem)
    print("latest_sem:", sem)

    status_df = pd.read_sql_query(
        f"""
        SELECT
            status,
            COUNT(*) AS cnt,
            COALESCE(SUM(amount), 0) AS sum_amt
        FROM fact_payment
        WHERE semester_id = {sem}
        GROUP BY status
        ORDER BY status
        """,
        engine,
    )
    print("\nstatus breakdown:\n", status_df.to_string(index=False))

    completed_df = pd.read_sql_query(
        f"""
        SELECT
            COALESCE(SUM(CASE WHEN status='Completed' THEN amount END), 0) AS completed_sum,
            COUNT(CASE WHEN status='Completed' THEN 1 END) AS completed_cnt
        FROM fact_payment
        WHERE semester_id = {sem}
        """,
        engine,
    )
    pending_df = pd.read_sql_query(
        f"""
        SELECT
            COALESCE(SUM(CASE WHEN status='Pending' THEN amount END), 0) AS pending_sum,
            COUNT(CASE WHEN status='Pending' THEN 1 END) AS pending_cnt
        FROM fact_payment
        WHERE semester_id = {sem}
        """,
        engine,
    )
    print("\ncompleted:\n", completed_df.to_string(index=False))
    print("\npending:\n", pending_df.to_string(index=False))

    engine.dispose()


if __name__ == "__main__":
    main()

