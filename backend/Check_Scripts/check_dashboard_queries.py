"""
Check if data exists for dashboard queries
"""
import pandas as pd
from sqlalchemy import create_engine, text
from config import DATA_WAREHOUSE_CONN_STRING

print("=" * 80)
print("Checking Dashboard Data Availability")
print("=" * 80)

engine = create_engine(DATA_WAREHOUSE_CONN_STRING)

# Check fact_grade data
print("\n1. Checking fact_grade data...")
try:
    grade_query = """
    SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT student_id) as unique_students,
        COUNT(DISTINCT date_key) as unique_dates,
        COUNT(CASE WHEN exam_status = 'Completed' THEN 1 END) as completed_exams,
        MIN(date_key) as min_date,
        MAX(date_key) as max_date
    FROM fact_grade
    """
    grade_data = pd.read_sql_query(text(grade_query), engine)
    print(grade_data.to_string(index=False))
    
    # Check if we have data with time dimension
    time_join_query = """
    SELECT 
        COUNT(*) as records_with_time,
        COUNT(DISTINCT dt.year) as unique_years,
        COUNT(DISTINCT dt.quarter) as unique_quarters,
        MIN(dt.year) as min_year,
        MAX(dt.year) as max_year
    FROM fact_grade fg
    JOIN dim_time dt ON fg.date_key = dt.date_key
    """
    time_data = pd.read_sql_query(text(time_join_query), engine)
    print("\nWith time dimension join:")
    print(time_data.to_string(index=False))
    
    # Sample query similar to dashboard
    sample_query = """
    SELECT 
        CONCAT('Q', CAST(dt.quarter AS CHAR), ' ', CAST(dt.year AS CHAR)) as period,
        dt.year,
        dt.quarter,
        AVG(CASE WHEN fg.exam_status = 'Completed' THEN fg.grade ELSE NULL END) as avg_grade,
        COUNT(CASE WHEN fg.exam_status = 'Completed' THEN 1 END) as completed_exams
    FROM fact_grade fg
    JOIN dim_time dt ON fg.date_key = dt.date_key
    GROUP BY dt.year, dt.quarter
    ORDER BY dt.year ASC, dt.quarter ASC
    LIMIT 10
    """
    sample_data = pd.read_sql_query(text(sample_query), engine)
    print("\nSample grades-over-time query result:")
    if not sample_data.empty:
        print(sample_data.to_string(index=False))
    else:
        print("  No data returned!")
except Exception as e:
    print(f"Error: {e}")

# Check fact_payment data
print("\n\n2. Checking fact_payment data...")
try:
    payment_query = """
    SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT student_id) as unique_students,
        COUNT(DISTINCT date_key) as unique_dates,
        COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed_payments,
        COUNT(CASE WHEN status = 'Pending' THEN 1 END) as pending_payments,
        SUM(CASE WHEN status = 'Completed' THEN amount ELSE 0 END) as total_completed,
        SUM(CASE WHEN status = 'Pending' THEN amount ELSE 0 END) as total_pending
    FROM fact_payment
    """
    payment_data = pd.read_sql_query(text(payment_query), engine)
    print(payment_data.to_string(index=False))
    
    # Sample payment trends query
    sample_query = """
    SELECT 
        CONCAT('Q', CAST(dt.quarter AS CHAR), ' ', CAST(dt.year AS CHAR)) as period,
        SUM(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END) as total_amount,
        COUNT(CASE WHEN fp.status = 'Completed' THEN 1 END) as completed_count
    FROM fact_payment fp
    JOIN dim_time dt ON fp.date_key = dt.date_key
    GROUP BY dt.year, dt.quarter
    ORDER BY dt.year, dt.quarter
    LIMIT 10
    """
    sample_data = pd.read_sql_query(text(sample_query), engine)
    print("\nSample payment-trends query result:")
    if not sample_data.empty:
        print(sample_data.to_string(index=False))
    else:
        print("  No data returned!")
except Exception as e:
    print(f"Error: {e}")

# Check fact_attendance data
print("\n\n3. Checking fact_attendance data...")
try:
    attendance_query = """
    SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT student_id) as unique_students,
        COUNT(DISTINCT date_key) as unique_dates,
        SUM(days_present) as total_days_present,
        SUM(total_hours) as total_hours
    FROM fact_attendance
    """
    attendance_data = pd.read_sql_query(text(attendance_query), engine)
    print(attendance_data.to_string(index=False))
    
    # Sample attendance trends query
    sample_query = """
    SELECT 
        CONCAT('Q', CAST(dt.quarter AS CHAR), ' ', CAST(dt.year AS CHAR)) as period,
        AVG(fa.total_hours) as avg_attendance,
        COUNT(DISTINCT fa.student_id) as total_students
    FROM fact_attendance fa
    JOIN dim_time dt ON fa.date_key = dt.date_key
    GROUP BY dt.year, dt.quarter
    ORDER BY dt.year ASC, dt.quarter ASC
    LIMIT 10
    """
    sample_data = pd.read_sql_query(text(sample_query), engine)
    print("\nSample attendance-trends query result:")
    if not sample_data.empty:
        print(sample_data.to_string(index=False))
    else:
        print("  No data returned!")
except Exception as e:
    print(f"Error: {e}")

# Check dim_time data
print("\n\n4. Checking dim_time data...")
try:
    time_query = """
    SELECT 
        COUNT(*) as total_dates,
        MIN(year) as min_year,
        MAX(year) as max_year,
        COUNT(DISTINCT year) as unique_years,
        COUNT(DISTINCT quarter) as unique_quarters
    FROM dim_time
    """
    time_data = pd.read_sql_query(text(time_query), engine)
    print(time_data.to_string(index=False))
except Exception as e:
    print(f"Error: {e}")

engine.dispose()
print("\n" + "=" * 80)
print("Diagnostic Complete")
print("=" * 80)


