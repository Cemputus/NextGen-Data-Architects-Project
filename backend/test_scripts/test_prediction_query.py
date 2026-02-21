"""
Test the prediction query for a specific student
"""
import pandas as pd
from sqlalchemy import create_engine, text
from config import DATA_WAREHOUSE_CONN_STRING

student_id = "A26143"

engine = create_engine(DATA_WAREHOUSE_CONN_STRING)

query = text("""
SELECT 
    ds.student_id,
    -- Tuition Features (must match training query exactly)
    COALESCE(SUM(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END), 0) as total_paid,
    COALESCE(SUM(CASE WHEN fp.status = 'Pending' THEN fp.amount ELSE 0 END), 0) as total_pending,
    COALESCE(SUM(fp.amount), 0) as total_required,
    CASE 
        WHEN SUM(fp.amount) > 0 
        THEN SUM(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END) / SUM(fp.amount) * 100
        ELSE 0 
    END as payment_completion_rate,
    COUNT(CASE WHEN fp.status = 'Completed' THEN 1 END) as completed_payments,
    DATEDIFF(CURDATE(), MAX(CASE WHEN fp.status = 'Completed' THEN fp.date_key ELSE NULL END)) as days_since_last_payment,
    CASE 
        WHEN SUM(CASE WHEN fp.status = 'Pending' THEN fp.amount ELSE 0 END) > 500000 
        THEN 1 ELSE 0 
    END as has_significant_balance,
    -- Attendance Features
    COALESCE(SUM(fa.total_hours), 0) as total_attendance_hours,
    COALESCE(SUM(fa.days_present), 0) as total_days_present,
    COALESCE(COUNT(fa.attendance_id), 0) as total_attendance_records,
    CASE 
        WHEN COUNT(fa.attendance_id) > 0 AND SUM(COALESCE(fa.days_present, 0)) > 0
        THEN LEAST(100.0, (SUM(COALESCE(fa.days_present, 0)) / NULLIF(COUNT(fa.attendance_id), 0)) * 100.0)
        ELSE 0.0 
    END as attendance_rate,
    COALESCE(COUNT(DISTINCT fa.course_code), 0) as courses_attended,
    COALESCE(AVG(fa.total_hours), 0) as avg_hours_per_course,
    -- Combined Features
    CASE 
        WHEN COUNT(fa.attendance_id) > 0 AND SUM(fp.amount) > 0
        THEN ((SUM(fa.days_present) / COUNT(fa.attendance_id)) * 100) * 
             (SUM(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END) / SUM(fp.amount) * 100) / 100
        ELSE 0 
    END as attendance_payment_score
FROM dim_student ds
LEFT JOIN fact_payment fp ON ds.student_id = fp.student_id
LEFT JOIN fact_attendance fa ON ds.student_id = fa.student_id
WHERE ds.student_id = :student_id OR ds.access_number = :student_id
GROUP BY ds.student_id
""")

result = pd.read_sql_query(query, engine, params={'student_id': student_id})

print("=" * 80)
print(f"Query Results for Student: {student_id}")
print("=" * 80)
print(result.to_string(index=False))
print("\n" + "=" * 80)
print("Key Values:")
print("=" * 80)
if not result.empty:
    row = result.iloc[0]
    print(f"total_paid: {row['total_paid']}")
    print(f"total_required: {row['total_required']}")
    print(f"payment_completion_rate: {row['payment_completion_rate']}")
    print(f"total_days_present: {row['total_days_present']}")
    print(f"total_attendance_records: {row['total_attendance_records']}")
    print(f"attendance_rate (from SQL): {row['attendance_rate']}")
    
    # Check what the Python code would calculate
    total_attendance_records = float(row['total_attendance_records']) if pd.notna(row['total_attendance_records']) else 0.0
    total_days_present = float(row['total_days_present']) if pd.notna(row['total_days_present']) else 0.0
    
    if total_attendance_records == 0:
        calculated_rate = 0.0
    else:
        calculated_rate = (total_days_present / total_attendance_records) * 100 if total_attendance_records > 0 else 0.0
        calculated_rate = min(100.0, max(0.0, calculated_rate))
    
    print(f"\nPython calculated attendance_rate: {calculated_rate}")
else:
    print("No data found for this student!")

engine.dispose()


