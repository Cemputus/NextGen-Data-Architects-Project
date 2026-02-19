"""
Quick script to verify FEX data exists in the data warehouse
"""
import sys
from pathlib import Path

# Add backend directory to path for imports
backend_dir = Path(__file__).parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

try:
    from sqlalchemy import create_engine, text
    from config import DATA_WAREHOUSE_CONN_STRING
    import pandas as pd
except ImportError as e:
    print(f"Error importing modules: {e}")
    print("Please ensure you're in the backend directory and dependencies are installed")
    sys.exit(1)

def verify_fex_data():
    try:
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        
        print("=" * 60)
        print("VERIFYING FEX DATA IN DATA WAREHOUSE")
        print("=" * 60)
        
        # Check if fact_grade table exists and has data
        print("\n1. Checking fact_grade table...")
        try:
            total_query = "SELECT COUNT(*) as total FROM fact_grade"
            total_df = pd.read_sql_query(text(total_query), engine)
            total_records = total_df['total'].iloc[0] if not total_df.empty else 0
            print(f"   Total records in fact_grade: {total_records}")
            
            if total_records == 0:
                print("   ⚠ WARNING: fact_grade table is empty!")
                print("   → You need to run the ETL pipeline to load data")
                engine.dispose()
                return
        except Exception as e:
            print(f"   ✗ Error checking fact_grade: {e}")
            engine.dispose()
            return
        
        # Check exam_status distribution
        print("\n2. Checking exam_status distribution...")
        status_query = """
        SELECT 
            exam_status,
            COUNT(*) as count,
            ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM fact_grade), 2) as percentage
        FROM fact_grade
        GROUP BY exam_status
        ORDER BY count DESC
        """
        status_df = pd.read_sql_query(text(status_query), engine)
        if not status_df.empty:
            print("\n   Exam Status Distribution:")
            print(status_df.to_string(index=False))
            
            fex_count = status_df[status_df['exam_status'] == 'FEX']['count'].sum() if 'FEX' in status_df['exam_status'].values else 0
            if fex_count == 0:
                print("\n   ⚠ WARNING: No FEX records found!")
                print("   → This means either:")
                print("     1. The ETL pipeline hasn't been run")
                print("     2. The source data doesn't have FEX records")
                print("     3. The exam_status column wasn't loaded correctly")
        else:
            print("   ⚠ No exam_status data found")
        
        # Check sample FEX records
        print("\n3. Checking sample FEX records...")
        sample_query = """
        SELECT 
            fg.grade_id,
            fg.student_id,
            fg.course_code,
            fg.exam_status,
            fg.grade,
            fg.letter_grade,
            fg.absence_reason,
            ds.access_number,
            dc.course_name
        FROM fact_grade fg
        JOIN dim_student ds ON fg.student_id = ds.student_id
        JOIN dim_course dc ON fg.course_code = dc.course_code
        WHERE fg.exam_status = 'FEX'
        LIMIT 5
        """
        sample_df = pd.read_sql_query(text(sample_query), engine)
        if not sample_df.empty:
            print(f"\n   Found {len(sample_df)} sample FEX records:")
            print(sample_df.to_string(index=False))
        else:
            print("   ⚠ No FEX records found in fact_grade")
        
        # Test the FEX analytics query
        print("\n4. Testing FEX analytics query...")
        fex_query = """
        SELECT 
            COUNT(CASE WHEN fg.exam_status = 'FEX' THEN 1 END) as total_fex,
            COUNT(CASE WHEN fg.exam_status = 'MEX' THEN 1 END) as total_mex,
            COUNT(CASE WHEN fg.exam_status = 'FCW' THEN 1 END) as total_fcw,
            COUNT(CASE WHEN fg.exam_status = 'Completed' THEN 1 END) as total_completed,
            COUNT(*) as total_exams
        FROM fact_grade fg
        JOIN dim_student ds ON fg.student_id = ds.student_id
        JOIN dim_course dc ON fg.course_code = dc.course_code
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        """
        fex_df = pd.read_sql_query(text(fex_query), engine)
        if not fex_df.empty:
            print("\n   FEX Analytics Summary:")
            print(f"   Total FEX: {fex_df['total_fex'].iloc[0]}")
            print(f"   Total MEX: {fex_df['total_mex'].iloc[0]}")
            print(f"   Total FCW: {fex_df['total_fcw'].iloc[0]}")
            print(f"   Total Completed: {fex_df['total_completed'].iloc[0]}")
            print(f"   Total Exams: {fex_df['total_exams'].iloc[0]}")
            
            if fex_df['total_fex'].iloc[0] == 0:
                print("\n   ⚠ WARNING: Query returns 0 FEX records!")
        else:
            print("   ⚠ Query returned no results")
        
        engine.dispose()
        
        print("\n" + "=" * 60)
        print("VERIFICATION COMPLETE")
        print("=" * 60)
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    verify_fex_data()



