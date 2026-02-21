"""
Test dashboard endpoint queries directly
"""
import pandas as pd
from sqlalchemy import create_engine, text
from config import DATA_WAREHOUSE_CONN_STRING

engine = create_engine(DATA_WAREHOUSE_CONN_STRING)

print("=" * 80)
print("Testing Dashboard Queries")
print("=" * 80)

# Test grades-over-time query
print("\n1. Testing grades-over-time query...")
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
        COUNT(DISTINCT fg.course_id) as total_courses
    FROM fact_grade fg
    JOIN dim_time dt ON fg.date_key = dt.date_key
    JOIN dim_student ds ON fg.student_id = ds.student_id
    GROUP BY dt.year, dt.quarter
    HAVING COUNT(CASE WHEN fg.exam_status = 'Completed' THEN 1 END) > 0
    ORDER BY dt.year ASC, dt.quarter ASC
    """
    df = pd.read_sql_query(text(query), engine)
    print(f"Rows returned: {len(df)}")
    if not df.empty:
        print(df.head().to_string(index=False))
    else:
        print("  No data returned!")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

# Test attendance-trends query
print("\n\n2. Testing attendance-trends query...")
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
        COUNT(DISTINCT fa.course_id) as total_courses
    FROM fact_attendance fa
    JOIN dim_time dt ON fa.date_key = dt.date_key
    JOIN dim_student ds ON fa.student_id = ds.student_id
    GROUP BY dt.year, dt.quarter
    HAVING COUNT(DISTINCT fa.student_id) > 0
    ORDER BY dt.year ASC, dt.quarter ASC
    """
    df = pd.read_sql_query(text(query), engine)
    print(f"Rows returned: {len(df)}")
    if not df.empty:
        print(df.head().to_string(index=False))
    else:
        print("  No data returned!")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

# Test payment-trends query
print("\n\n3. Testing payment-trends query...")
try:
    query = """
    SELECT 
        CONCAT('Q', CAST(dt.quarter AS CHAR), ' ', CAST(dt.year AS CHAR)) as period,
        SUM(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END) as total_amount,
        COUNT(CASE WHEN fp.status = 'Completed' THEN 1 END) as completed_count,
        COUNT(CASE WHEN fp.status = 'Pending' THEN 1 END) as pending_count
    FROM fact_payment fp
    JOIN dim_time dt ON fp.date_key = dt.date_key
    JOIN dim_student ds ON fp.student_id = ds.student_id
    GROUP BY dt.year, dt.quarter
    ORDER BY dt.year, dt.quarter
    """
    df = pd.read_sql_query(text(query), engine)
    print(f"Rows returned: {len(df)}")
    if not df.empty:
        print(df.head(10).to_string(index=False))
    else:
        print("  No data returned!")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

engine.dispose()
print("\n" + "=" * 80)
print("Test Complete")
print("=" * 80)


