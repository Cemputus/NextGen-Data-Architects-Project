"""
Test the exact queries that the endpoints use
"""
import pandas as pd
from sqlalchemy import create_engine, text
from config import DATA_WAREHOUSE_CONN_STRING

engine = create_engine(DATA_WAREHOUSE_CONN_STRING)

print("=" * 80)
print("Testing Exact Endpoint Queries")
print("=" * 80)

# Test grades-over-time query (SENATE role, no filters)
print("\n1. Testing grades-over-time query (SENATE, no filters)...")
try:
    query = """
    SELECT 
        CONCAT('Q', CAST(dt.quarter AS CHAR), ' ', CAST(dt.year AS CHAR)) as period,
        dt.year,
        dt.quarter,
        AVG(CASE WHEN fg.exam_status = 'Completed' THEN fg.grade ELSE NULL END) as avg_grade,
        COUNT(CASE WHEN fg.exam_status = 'Completed' THEN 1 END) as completed_exams,
        COUNT(CASE WHEN fg.exam_status = 'MEX' THEN 1 END) as missed_exams,
        COUNT(CASE WHEN fg.exam_status = 'FEX' THEN 1 END) as failed_exams,
        COUNT(DISTINCT fg.student_id) as total_students,
        COUNT(DISTINCT fg.course_code) as total_courses
    FROM fact_grade fg
    INNER JOIN dim_time dt ON fg.date_key = dt.date_key
    INNER JOIN dim_student ds ON fg.student_id = ds.student_id
    GROUP BY dt.year, dt.quarter
    HAVING COUNT(CASE WHEN fg.exam_status = 'Completed' THEN 1 END) > 0
    ORDER BY dt.year ASC, dt.quarter ASC
    """
    df = pd.read_sql_query(text(query), engine)
    print(f"✓ Query executed successfully")
    print(f"Rows returned: {len(df)}")
    if not df.empty:
        print("\nFirst 5 rows:")
        print(df.head().to_string(index=False))
        print(f"\nResponse format:")
        print(f"  periods: {df['period'].tolist()[:5]}")
        print(f"  grades: {df['avg_grade'].round(2).tolist()[:5]}")
    else:
        print("  ⚠ No data returned!")
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()

# Test attendance-trends query (SENATE role, no filters)
print("\n\n2. Testing attendance-trends query (SENATE, no filters)...")
try:
    query = """
    SELECT 
        CONCAT('Q', CAST(dt.quarter AS CHAR), ' ', CAST(dt.year AS CHAR)) as period,
        dt.year,
        dt.quarter,
        AVG(fa.total_hours) as avg_attendance,
        AVG(fa.days_present) as avg_days_present,
        SUM(fa.total_hours) as total_hours,
        SUM(fa.days_present) as total_days_present,
        COUNT(DISTINCT fa.student_id) as total_students,
        COUNT(DISTINCT fa.course_code) as total_courses
    FROM fact_attendance fa
    INNER JOIN dim_time dt ON fa.date_key = dt.date_key
    INNER JOIN dim_student ds ON fa.student_id = ds.student_id
    GROUP BY dt.year, dt.quarter
    HAVING COUNT(DISTINCT fa.student_id) > 0
    ORDER BY dt.year ASC, dt.quarter ASC
    """
    df = pd.read_sql_query(text(query), engine)
    print(f"✓ Query executed successfully")
    print(f"Rows returned: {len(df)}")
    if not df.empty:
        print("\nFirst 5 rows:")
        print(df.head().to_string(index=False))
        print(f"\nResponse format:")
        print(f"  periods: {df['period'].tolist()[:5]}")
        print(f"  attendance: {df['avg_attendance'].round(2).tolist()[:5]}")
    else:
        print("  ⚠ No data returned!")
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()

engine.dispose()
print("\n" + "=" * 80)


