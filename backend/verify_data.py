"""
Script to verify data is loaded in the data warehouse
"""
from sqlalchemy import create_engine, text
import pandas as pd
from config import DATA_WAREHOUSE_CONN_STRING

def verify_data():
    """Verify data exists in the data warehouse"""
    engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
    
    checks = {
        'Students': "SELECT COUNT(*) as count FROM dim_student",
        'Courses': "SELECT COUNT(*) as count FROM dim_course",
        'Grades': "SELECT COUNT(*) as count FROM fact_grade",
        'FEX Records': "SELECT COUNT(*) as count FROM fact_grade WHERE exam_status = 'FEX'",
        'MEX Records': "SELECT COUNT(*) as count FROM fact_grade WHERE exam_status = 'MEX'",
        'FCW Records': "SELECT COUNT(*) as count FROM fact_grade WHERE exam_status = 'FCW'",
        'Enrollments': "SELECT COUNT(*) as count FROM fact_enrollment",
        'Payments': "SELECT COUNT(*) as count FROM fact_payment",
        'Attendance': "SELECT COUNT(*) as count FROM fact_attendance",
        'High Schools': "SELECT COUNT(DISTINCT high_school) as count FROM dim_student WHERE high_school IS NOT NULL AND high_school != ''"
    }
    
    print("=" * 60)
    print("DATA WAREHOUSE VERIFICATION")
    print("=" * 60)
    
    for name, query in checks.items():
        try:
            result = pd.read_sql_query(text(query), engine)
            count = int(result['count'][0]) if not result.empty else 0
            status = "✓" if count > 0 else "✗"
            print(f"{status} {name:20s}: {count:>10,}")
        except Exception as e:
            print(f"✗ {name:20s}: ERROR - {str(e)}")
    
    print("=" * 60)
    print("\nIf counts are 0, run the ETL pipeline:")
    print("  python backend/etl_pipeline.py")
    print("\nTo train ML models:")
    print("  python backend/ml_models.py")
    print("=" * 60)
    
    engine.dispose()

if __name__ == "__main__":
    verify_data()
