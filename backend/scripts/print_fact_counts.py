import pandas as pd
from sqlalchemy import create_engine

from config import DATA_WAREHOUSE_CONN_STRING


def main() -> None:
    engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
    fact_tables = [
        "fact_enrollment",
        "fact_attendance",
        "fact_payment",
        "fact_grade",
        "fact_transcript",
        "fact_academic_performance",
        "fact_sponsorship",
        "fact_progression",
        "fact_student_high_school",
        "fact_grades_summary",
    ]
    for t in fact_tables:
        try:
            df = pd.read_sql_query(f"SELECT COUNT(*) AS c FROM `{t}`", engine)
            c = int(df["c"][0]) if not df.empty and pd.notna(df["c"][0]) else 0
        except Exception:
            c = None
        print(f"{t}\t{c}")
    engine.dispose()


if __name__ == "__main__":
    main()

