"""
Quick script to check if high school data exists in the database
"""
from sqlalchemy import create_engine, text
from config import DATA_WAREHOUSE_CONN_STRING
import pandas as pd

def check_high_school_data():
    try:
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        
        # Check total high schools
        print("=" * 60)
        print("CHECKING HIGH SCHOOL DATA")
        print("=" * 60)
        
        query1 = """
        SELECT 
            COUNT(DISTINCT high_school) as distinct_high_schools,
            COUNT(*) as total_students_with_high_school
        FROM dim_student 
        WHERE high_school IS NOT NULL 
        AND high_school != '' 
        AND high_school != 'NULL'
        """
        df1 = pd.read_sql_query(text(query1), engine)
        print(f"\n1. Distinct High Schools: {df1['distinct_high_schools'].iloc[0] if not df1.empty else 0}")
        print(f"2. Total Students with High School: {df1['total_students_with_high_school'].iloc[0] if not df1.empty else 0}")
        
        # Check sample high schools
        query2 = """
        SELECT DISTINCT high_school 
        FROM dim_student 
        WHERE high_school IS NOT NULL 
        AND high_school != '' 
        AND high_school != 'NULL'
        LIMIT 10
        """
        df2 = pd.read_sql_query(text(query2), engine)
        print(f"\n3. Sample High Schools (first 10):")
        if not df2.empty:
            for idx, row in df2.iterrows():
                print(f"   - {row['high_school']}")
        else:
            print("   No high schools found!")
        
        # Check if students have programs (needed for joins)
        query3 = """
        SELECT 
            COUNT(*) as students_with_program,
            COUNT(CASE WHEN program_id IS NULL THEN 1 END) as students_without_program
        FROM dim_student
        WHERE high_school IS NOT NULL 
        AND high_school != '' 
        AND high_school != 'NULL'
        """
        df3 = pd.read_sql_query(text(query3), engine)
        print(f"\n4. Students with Program: {df3['students_with_program'].iloc[0] if not df3.empty else 0}")
        print(f"5. Students without Program: {df3['students_without_program'].iloc[0] if not df3.empty else 0}")
        
        # Test the actual query structure
        print("\n" + "=" * 60)
        print("TESTING ACTUAL QUERY")
        print("=" * 60)
        
        test_query = """
        SELECT 
            ds.high_school,
            COUNT(DISTINCT ds.student_id) as total_students
        FROM dim_student ds
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        WHERE ds.high_school IS NOT NULL 
        AND ds.high_school != '' 
        AND ds.high_school != 'NULL'
        GROUP BY ds.high_school
        HAVING COUNT(DISTINCT ds.student_id) > 0
        ORDER BY total_students DESC
        LIMIT 5
        """
        
        df4 = pd.read_sql_query(text(test_query), engine)
        print(f"\n6. Query Results (first 5):")
        if not df4.empty:
            print(df4.to_string(index=False))
        else:
            print("   Query returned 0 rows!")
            print("   This means the query structure might be filtering out all data.")
        
        engine.dispose()
        print("\n" + "=" * 60)
        print("CHECK COMPLETE")
        print("=" * 60)
        
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_high_school_data()

