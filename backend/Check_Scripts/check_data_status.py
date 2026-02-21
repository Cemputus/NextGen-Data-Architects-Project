"""
Quick diagnostic script to check if FEX data exists
Run this to diagnose why FEX analytics shows zeros
"""
import sys
from pathlib import Path

backend_dir = Path(__file__).parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

print("=" * 60)
print("FEX DATA DIAGNOSTIC CHECK")
print("=" * 60)
print("\nThis script will help diagnose why FEX analytics shows zeros.")
print("\nPossible causes:")
print("1. ETL pipeline hasn't been run")
print("2. Source database doesn't have FEX records")
print("3. Data wasn't loaded into data warehouse")
print("\n" + "=" * 60)

try:
    from sqlalchemy import create_engine, text
    from config import DATA_WAREHOUSE_CONN_STRING, DB1_CONN_STRING
    import pandas as pd
    
    print("\n✓ Dependencies loaded successfully")
    
    # Check data warehouse
    print("\n1. Checking Data Warehouse (UCU_DataWarehouse)...")
    try:
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        
        # Check if fact_grade exists
        check_table = "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'UCU_DataWarehouse' AND table_name = 'fact_grade'"
        table_exists = pd.read_sql_query(text(check_table), engine)
        
        if table_exists['count'].iloc[0] == 0:
            print("   ✗ fact_grade table does NOT exist")
            print("   → SOLUTION: Run the ETL pipeline to create tables and load data")
            engine.dispose()
            sys.exit(1)
        else:
            print("   ✓ fact_grade table exists")
        
        # Check total records
        total_query = "SELECT COUNT(*) as total FROM fact_grade"
        total_df = pd.read_sql_query(text(total_query), engine)
        total = total_df['total'].iloc[0] if not total_df.empty else 0
        print(f"   Total records in fact_grade: {total}")
        
        if total == 0:
            print("   ✗ fact_grade table is EMPTY")
            print("   → SOLUTION: Run the ETL pipeline to load data")
            engine.dispose()
            sys.exit(1)
        
        # Check exam_status distribution
        status_query = """
        SELECT 
            exam_status,
            COUNT(*) as count
        FROM fact_grade
        GROUP BY exam_status
        ORDER BY count DESC
        """
        status_df = pd.read_sql_query(text(status_query), engine)
        
        if not status_df.empty:
            print("\n   Exam Status Distribution:")
            for _, row in status_df.iterrows():
                status = row['exam_status'] if pd.notna(row['exam_status']) else 'NULL'
                count = row['count']
                print(f"   - {status}: {count}")
            
            fex_count = status_df[status_df['exam_status'] == 'FEX']['count'].sum() if 'FEX' in status_df['exam_status'].values else 0
            if fex_count == 0:
                print("\n   ⚠ WARNING: No FEX records found in fact_grade!")
                print("   → This means the source data doesn't have FEX records")
                print("   → Check if setup_databases.py generated FEX data")
        else:
            print("   ⚠ No exam_status data found")
        
        engine.dispose()
        
    except Exception as e:
        print(f"   ✗ Error checking data warehouse: {e}")
        print("   → Make sure MySQL is running and databases exist")
    
    # Check source database
    print("\n2. Checking Source Database (UCU_SourceDB1)...")
    try:
        engine = create_engine(DB1_CONN_STRING)
        
        # Check if grades table exists
        check_table = "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'UCU_SourceDB1' AND table_name = 'grades'"
        table_exists = pd.read_sql_query(text(check_table), engine)
        
        if table_exists['count'].iloc[0] == 0:
            print("   ✗ grades table does NOT exist in source database")
            print("   → SOLUTION: Run setup_databases.py to create source data")
        else:
            print("   ✓ grades table exists")
            
            # Check ExamStatus distribution
            status_query = """
            SELECT 
                ExamStatus,
                COUNT(*) as count
            FROM grades
            GROUP BY ExamStatus
            ORDER BY count DESC
            """
            status_df = pd.read_sql_query(text(status_query), engine)
            
            if not status_df.empty:
                print("\n   ExamStatus Distribution in Source:")
                for _, row in status_df.iterrows():
                    status = row['ExamStatus'] if pd.notna(row['ExamStatus']) else 'NULL'
                    count = row['count']
                    print(f"   - {status}: {count}")
                
                fex_count = status_df[status_df['ExamStatus'] == 'FEX']['count'].sum() if 'FEX' in status_df['ExamStatus'].values else 0
                if fex_count == 0:
                    print("\n   ⚠ WARNING: No FEX records in source database!")
                    print("   → SOLUTION: Re-run setup_databases.py to generate FEX data")
            else:
                print("   ⚠ No ExamStatus data found")
        
        engine.dispose()
        
    except Exception as e:
        print(f"   ✗ Error checking source database: {e}")
    
    print("\n" + "=" * 60)
    print("DIAGNOSTIC COMPLETE")
    print("=" * 60)
    print("\nNext Steps:")
    print("1. If fact_grade is empty: Run ETL pipeline (python etl_pipeline.py)")
    print("2. If source has no FEX: Run setup_databases.py to regenerate data")
    print("3. If data exists but query fails: Check backend logs for SQL errors")
    print("\n")
    
except ImportError as e:
    print(f"\n✗ Error importing modules: {e}")
    print("Make sure you're in the backend directory and dependencies are installed")
    print("Run: pip install -r requirements.txt")
    sys.exit(1)
except Exception as e:
    print(f"\n✗ Unexpected error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

