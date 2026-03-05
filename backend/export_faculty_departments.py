"""
Export list of faculties and their departments from the data warehouse.

Output:
  backend/data/new_anonymized_data/faculties_departments.csv
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
    ddept.department_name
  FROM dim_faculty df
  JOIN dim_department ddept
    ON ddept.faculty_id = df.faculty_id
  ORDER BY df.faculty_name, ddept.department_name;
  """

  with engine.connect() as conn:
    df = pd.read_sql_query(text(query), conn)

  out_path = "backend/data/new_anonymized_data/faculties_departments.csv"
  df.to_csv(out_path, index=False)
  print(f"Exported {len(df)} rows to {out_path}")


if __name__ == "__main__":
  main()

