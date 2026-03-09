"""
Test PostgreSQL database connection with current credentials
"""
import psycopg2
from config import PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, DATA_WAREHOUSE_NAME

print("=" * 60)
print("Testing PostgreSQL Database Connection")
print("=" * 60)
print(f"Host: {PG_HOST}")
print(f"Port: {PG_PORT}")
print(f"User: {PG_USER}")
print(f"Password: {'*' * len(PG_PASSWORD) if PG_PASSWORD else '(empty)'}")
print(f"Database: {DATA_WAREHOUSE_NAME}")
print("=" * 60)

try:
    # Test connection without database first (connect to postgres default db)
    print("\n1. Testing connection to PostgreSQL server (postgres db)...")
    conn = psycopg2.connect(
        host=PG_HOST,
        port=int(PG_PORT),
        user=PG_USER,
        password=PG_PASSWORD,
        dbname="postgres"
    )
    conn.autocommit = True
    print("✓ Successfully connected to PostgreSQL server!")
    conn.close()

    # Test connection with database
    print(f"\n2. Testing connection to database '{DATA_WAREHOUSE_NAME}'...")
    conn = psycopg2.connect(
        host=PG_HOST,
        port=int(PG_PORT),
        user=PG_USER,
        password=PG_PASSWORD,
        dbname=DATA_WAREHOUSE_NAME
    )
    conn.autocommit = True
    print(f"✓ Successfully connected to database '{DATA_WAREHOUSE_NAME}'!")

    # Test a simple query
    print("\n3. Testing a simple query...")
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM dim_student")
    count = cursor.fetchone()[0]
    print(f"✓ Query successful! Found {count} students in dim_student table.")

    cursor.close()
    conn.close()
    print("\n" + "=" * 60)
    print("✓ All connection tests passed!")
    print("=" * 60)

except psycopg2.OperationalError as e:
    print(f"\n✗ Connection failed!")
    print(f"Error: {e}")
    print("\n" + "=" * 60)
    print("TROUBLESHOOTING:")
    print("=" * 60)
    print("1. Check your PostgreSQL credentials:")
    print("   - Try connecting with: psql -h localhost -U postgres")
    print("   - If that works, note the password you used")
    print("\n2. Update your credentials:")
    print("   Option A: Set environment variables (recommended):")
    print("   - Windows PowerShell:")
    print("     $env:PG_USER='postgres'")
    print("     $env:PG_PASSWORD='your_actual_password'")
    print("   - Linux/Mac:")
    print("     export PG_USER='postgres'")
    print("     export PG_PASSWORD='your_actual_password'")
    print("\n   Option B: Edit backend/config.py directly:")
    print("     PG_USER = 'postgres'")
    print("     PG_PASSWORD = 'your_actual_password'")
    print("\n3. Is the PostgreSQL server running?")
    print("   - Docker: docker-compose up postgres")
    print("   - Local: check with: pg_isready")
    print("=" * 60)

except Exception as e:
    print(f"\n✗ Unexpected error: {type(e).__name__}")
    print(f"Error: {str(e)}")
    print("=" * 60)
