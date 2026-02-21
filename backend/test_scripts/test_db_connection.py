"""
Test MySQL database connection with current credentials
"""
import pymysql
from config import MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, DATA_WAREHOUSE_NAME

print("=" * 60)
print("Testing MySQL Database Connection")
print("=" * 60)
print(f"Host: {MYSQL_HOST}")
print(f"Port: {MYSQL_PORT}")
print(f"User: {MYSQL_USER}")
print(f"Password: {'*' * len(MYSQL_PASSWORD) if MYSQL_PASSWORD else '(empty)'}")
print(f"Database: {DATA_WAREHOUSE_NAME}")
print("=" * 60)

try:
    # Test connection without database first
    print("\n1. Testing connection to MySQL server (no database)...")
    conn = pymysql.connect(
        host=MYSQL_HOST,
        port=int(MYSQL_PORT),
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        charset='utf8mb4'
    )
    print("✓ Successfully connected to MySQL server!")
    conn.close()
    
    # Test connection with database
    print(f"\n2. Testing connection to database '{DATA_WAREHOUSE_NAME}'...")
    conn = pymysql.connect(
        host=MYSQL_HOST,
        port=int(MYSQL_PORT),
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=DATA_WAREHOUSE_NAME,
        charset='utf8mb4'
    )
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
    
except pymysql.err.OperationalError as e:
    error_code, error_msg = e.args
    print(f"\n✗ Connection failed!")
    print(f"Error Code: {error_code}")
    print(f"Error Message: {error_msg}")
    print("\n" + "=" * 60)
    print("TROUBLESHOOTING:")
    print("=" * 60)
    
    if error_code == 1045:
        print("This is an authentication error. Possible solutions:")
        print("\n1. Check your MySQL root password:")
        print("   - Open MySQL Command Line Client or MySQL Workbench")
        print("   - Try logging in with: mysql -u root -p")
        print("   - If that works, note the password you used")
        print("\n2. Update your credentials:")
        print("   Option A: Set environment variables (recommended):")
        print("   - Windows PowerShell:")
        print("     $env:MYSQL_USER='root'")
        print("     $env:MYSQL_PASSWORD='your_actual_password'")
        print("   - Windows CMD:")
        print("     set MYSQL_USER=root")
        print("     set MYSQL_PASSWORD=your_actual_password")
        print("   - Linux/Mac:")
        print("     export MYSQL_USER='root'")
        print("     export MYSQL_PASSWORD='your_actual_password'")
        print("\n   Option B: Edit backend/config.py directly:")
        print("     MYSQL_USER = 'root'")
        print("     MYSQL_PASSWORD = 'your_actual_password'")
        print("\n3. If you forgot your MySQL root password:")
        print("   - Follow MySQL password reset instructions for your OS")
        print("   - Or create a new MySQL user with proper permissions")
    elif error_code == 2003:
        print("Cannot connect to MySQL server. Check:")
        print("   - Is MySQL server running?")
        print("   - Is the host/port correct?")
    elif error_code == 1049:
        print(f"Database '{DATA_WAREHOUSE_NAME}' does not exist.")
        print("   - Run: python setup_databases.py")
        print("   - Then run: python etl_pipeline.py")
    else:
        print(f"Unknown error. Error code: {error_code}")
        print(f"Error message: {error_msg}")
    
    print("=" * 60)
    
except Exception as e:
    print(f"\n✗ Unexpected error: {type(e).__name__}")
    print(f"Error: {str(e)}")
    print("=" * 60)


