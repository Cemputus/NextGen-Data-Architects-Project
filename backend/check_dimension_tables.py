"""Check dimension tables data"""
from sqlalchemy import create_engine, text
from config import DATA_WAREHOUSE_CONN_STRING

engine = create_engine(DATA_WAREHOUSE_CONN_STRING)

print("=" * 60)
print("DIMENSION TABLES DATA CHECK")
print("=" * 60)

with engine.connect() as conn:
    tables = ['dim_faculty', 'dim_department', 'dim_program']
    
    for table in tables:
        # Check if table exists
        result = conn.execute(text(f"SHOW TABLES LIKE '{table}'"))
        if result.rowcount > 0:
            # Table exists, get count
            result = conn.execute(text(f'SELECT COUNT(*) as count FROM {table}'))
            count = result.fetchone()[0]
            print(f"\n✓ {table}: {count} records")
            
            if count > 0:
                # Get sample records
                if table == 'dim_faculty':
                    result = conn.execute(text('SELECT faculty_id, faculty_name FROM dim_faculty LIMIT 5'))
                    print("  Sample records:")
                    for row in result:
                        print(f"    - {row[0]}: {row[1]}")
                elif table == 'dim_department':
                    result = conn.execute(text('SELECT department_id, department_name, faculty_id FROM dim_department LIMIT 5'))
                    print("  Sample records:")
                    for row in result:
                        print(f"    - {row[0]}: {row[1]} (Faculty: {row[2]})")
                elif table == 'dim_program':
                    result = conn.execute(text('SELECT program_id, program_name, department_id FROM dim_program LIMIT 5'))
                    print("  Sample records:")
                    for row in result:
                        print(f"    - {row[0]}: {row[1]} (Dept: {row[2]})")
        else:
            print(f"\n✗ {table}: Table does not exist")

print("\n" + "=" * 60)
print("✓ All dimension tables checked!")
print("=" * 60)

