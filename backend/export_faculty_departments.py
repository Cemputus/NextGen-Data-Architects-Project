"""
Export list of faculties, departments, and programs from the data warehouse.

Output:
  backend/data/new_synthetic_data/faculties_departments.csv
Columns:
  faculty_id, faculty_name, department_id, department_name, program_id, program_name
"""

from sqlalchemy import create_engine, text
import pandas as pd

from config import DATA_WAREHOUSE_CONN_STRING


def main():
  engine = create_engine(DATA_WAREHOUSE_CONN_STRING)

  query = """
  SELECT
    df.faculty_id,
    df.faculty_name,
    ddept.department_id,
    ddept.department_name,
    dp.program_id,
    dp.program_name
  FROM dim_faculty df
  JOIN dim_department ddept
    ON ddept.faculty_id = df.faculty_id
  LEFT JOIN dim_program dp
    ON dp.department_id = ddept.department_id
  ORDER BY df.faculty_name, ddept.department_name, dp.program_name;
  """

  with engine.connect() as conn:
    df = pd.read_sql_query(text(query), conn)

  out_path = "backend/data/new_synthetic_data/faculties_departments.csv"
  df.to_csv(out_path, index=False)
  print(f"Exported {len(df)} rows to {out_path}")


if __name__ == "__main__":
  main()


