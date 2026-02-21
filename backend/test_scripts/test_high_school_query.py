"""
Test the high school analytics query to see what's happening
"""
from sqlalchemy import create_engine, text
from config import DATA_WAREHOUSE_CONN_STRING
import pandas as pd

def test_query():
    engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
    
    # Test the exact query structure used in the API
    query = """
    SELECT 
        ds.high_school,
        COALESCE(ds.high_school_district, 'Unknown') as high_school_district,
        COUNT(DISTINCT ds.student_id) as total_students,
        COUNT(DISTINCT CASE WHEN ds.status = 'Active' THEN ds.student_id END) as active_students,
        COUNT(DISTINCT CASE WHEN ds.status = 'Graduated' THEN ds.student_id END) as graduated_students,
        COUNT(DISTINCT CASE WHEN ds.status = 'Withdrawn' THEN ds.student_id END) as withdrawn_students,
        COUNT(DISTINCT fe.student_id) as enrolled_students,
        COUNT(DISTINCT dp.program_id) as programs_enrolled,
        AVG(CASE WHEN fg.exam_status = 'Completed' THEN fg.grade ELSE NULL END) as avg_grade,
        COUNT(CASE WHEN fg.exam_status = 'FEX' THEN 1 END) as total_fex,
        COUNT(CASE WHEN fg.exam_status = 'MEX' THEN 1 END) as total_mex,
        COALESCE(SUM(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN fp.status = 'Pending' THEN fp.amount ELSE 0 END), 0) as total_pending
    FROM dim_student ds
    LEFT JOIN fact_enrollment fe ON ds.student_id = fe.student_id
    LEFT JOIN fact_grade fg ON ds.student_id = fg.student_id
    LEFT JOIN fact_payment fp ON ds.student_id = fp.student_id
    LEFT JOIN fact_attendance fa ON ds.student_id = fa.student_id
    LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
    LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
    LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
    WHERE ds.high_school IS NOT NULL AND ds.high_school != '' AND ds.high_school != 'NULL'
    GROUP BY ds.high_school, ds.high_school_district
    HAVING COUNT(DISTINCT ds.student_id) > 0
    ORDER BY total_students DESC
    LIMIT 10
    """
    
    try:
        print("=" * 60)
        print("TESTING HIGH SCHOOL ANALYTICS QUERY")
        print("=" * 60)
        df = pd.read_sql_query(text(query), engine)
        print(f"\nQuery returned {len(df)} rows")
        if len(df) > 0:
            print("\nFirst 5 rows:")
            print(df[['high_school', 'total_students', 'active_students', 'avg_grade']].to_string(index=False))
        else:
            print("\n⚠️ Query returned 0 rows!")
            print("This means the query structure is filtering out all data.")
            
            # Test simpler query
            print("\n" + "=" * 60)
            print("TESTING SIMPLER QUERY (without fact table joins)")
            print("=" * 60)
            simple_query = """
            SELECT 
                ds.high_school,
                COUNT(DISTINCT ds.student_id) as total_students
            FROM dim_student ds
            WHERE ds.high_school IS NOT NULL 
            AND ds.high_school != '' 
            AND ds.high_school != 'NULL'
            GROUP BY ds.high_school
            ORDER BY total_students DESC
            LIMIT 10
            """
            df2 = pd.read_sql_query(text(simple_query), engine)
            print(f"Simple query returned {len(df2)} rows")
            if len(df2) > 0:
                print(df2.to_string(index=False))
                print("\n✓ Basic query works! The issue is with the LEFT JOINs or aggregations.")
            else:
                print("✗ Even simple query returns 0 rows - check WHERE clause")
                
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        engine.dispose()

if __name__ == "__main__":
    test_query()

