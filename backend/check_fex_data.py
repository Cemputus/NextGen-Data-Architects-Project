"""
Quick script to check if FEX data exists in the data warehouse
"""
from sqlalchemy import create_engine, text
from config import DATA_WAREHOUSE_CONN_STRING
import pandas as pd

def check_fex_data():
    try:
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        
        # Check exam status distribution
        print("=" * 60)
        print("EXAM STATUS DISTRIBUTION")
        print("=" * 60)
        status_query = """
        SELECT 
            exam_status,
            COUNT(*) as count
        FROM fact_grade
        GROUP BY exam_status
        ORDER BY count DESC
        """
        status_df = pd.read_sql_query(text(status_query), engine)
        print(status_df.to_string())
        print()
        
        # Check total records
        total_query = "SELECT COUNT(*) as total FROM fact_grade"
        total_df = pd.read_sql_query(text(total_query), engine)
        print(f"Total grade records: {total_df['total'].iloc[0]}")
        print()
        
        # Check FEX records specifically
        fex_query = """
        SELECT 
            COUNT(*) as total_fex,
            COUNT(CASE WHEN exam_status = 'MEX' THEN 1 END) as total_mex,
            COUNT(CASE WHEN exam_status = 'FCW' THEN 1 END) as total_fcw,
            COUNT(CASE WHEN exam_status = 'Completed' THEN 1 END) as total_completed
        FROM fact_grade
        """
        fex_df = pd.read_sql_query(text(fex_query), engine)
        print("=" * 60)
        print("FEX ANALYTICS SUMMARY")
        print("=" * 60)
        print(f"Total FEX: {fex_df['total_fex'].iloc[0]}")
        print(f"Total MEX: {fex_df['total_mex'].iloc[0]}")
        print(f"Total FCW: {fex_df['total_fcw'].iloc[0]}")
        print(f"Total Completed: {fex_df['total_completed'].iloc[0]}")
        print()
        
        # Check if FEX data has proper joins
        join_query = """
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
        join_df = pd.read_sql_query(text(join_query), engine)
        print("=" * 60)
        print("FEX DATA WITH JOINS (as used in API)")
        print("=" * 60)
        print(f"Total FEX: {join_df['total_fex'].iloc[0]}")
        print(f"Total MEX: {join_df['total_mex'].iloc[0]}")
        print(f"Total FCW: {join_df['total_fcw'].iloc[0]}")
        print(f"Total Completed: {join_df['total_completed'].iloc[0]}")
        print(f"Total Exams: {join_df['total_exams'].iloc[0]}")
        print()
        
        # Sample FEX records
        sample_query = """
        SELECT 
            fg.grade_id,
            fg.student_id,
            fg.course_code,
            fg.exam_status,
            fg.grade,
            fg.letter_grade,
            ds.access_number,
            dc.course_name
        FROM fact_grade fg
        JOIN dim_student ds ON fg.student_id = ds.student_id
        JOIN dim_course dc ON fg.course_code = dc.course_code
        WHERE fg.exam_status = 'FEX'
        LIMIT 5
        """
        sample_df = pd.read_sql_query(text(sample_query), engine)
        print("=" * 60)
        print("SAMPLE FEX RECORDS")
        print("=" * 60)
        if not sample_df.empty:
            print(sample_df.to_string())
        else:
            print("No FEX records found!")
        print()
        
        engine.dispose()
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    check_fex_data()



