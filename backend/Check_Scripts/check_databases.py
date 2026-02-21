"""
Script to check all databases, tables, and row counts
"""
import pymysql
from config import (
    MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD,
    DB1_NAME, DB2_NAME, DATA_WAREHOUSE_NAME
)

def get_database_info():
    """Get information about all databases, tables, and row counts"""
    try:
        conn = pymysql.connect(
            host=MYSQL_HOST,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD
        )
        cursor = conn.cursor()
        
        # Get all databases (excluding system databases)
        cursor.execute("SHOW DATABASES")
        all_dbs = [row[0] for row in cursor.fetchall() 
                   if row[0] not in ['information_schema', 'mysql', 'performance_schema', 'sys']]
        
        print("=" * 80)
        print(f"DATABASE INVENTORY - Total Databases: {len(all_dbs)}")
        print("=" * 80)
        
        total_tables = 0
        total_rows = 0
        
        for db_name in sorted(all_dbs):
            try:
                cursor.execute(f"USE `{db_name}`")
                cursor.execute("SHOW TABLES")
                tables = [row[0] for row in cursor.fetchall()]
                
                if not tables:
                    continue
                
                print(f"\n{'='*80}")
                print(f"DATABASE: {db_name}")
                print(f"{'='*80}")
                print(f"Tables: {len(tables)}")
                print("-" * 80)
                
                db_total_rows = 0
                
                for table in sorted(tables):
                    try:
                        cursor.execute(f"SELECT COUNT(*) FROM `{table}`")
                        row_count = cursor.fetchone()[0]
                        db_total_rows += row_count
                        total_rows += row_count
                        
                        # Get table structure info
                        cursor.execute(f"DESCRIBE `{table}`")
                        columns = cursor.fetchall()
                        num_columns = len(columns)
                        
                        print(f"  📊 {table:40s} | Rows: {row_count:>8,} | Columns: {num_columns:>3}")
                        total_tables += 1
                    except Exception as e:
                        print(f"  ❌ {table:40s} | Error: {str(e)}")
                
                print("-" * 80)
                print(f"  Total rows in {db_name}: {db_total_rows:,}")
                
            except Exception as e:
                print(f"\n❌ Error accessing database '{db_name}': {str(e)}")
        
        print("\n" + "=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"Total Databases: {len(all_dbs)}")
        print(f"Total Tables:    {total_tables}")
        print(f"Total Rows:      {total_rows:,}")
        print("=" * 80)
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error connecting to MySQL: {str(e)}")

if __name__ == "__main__":
    get_database_info()

