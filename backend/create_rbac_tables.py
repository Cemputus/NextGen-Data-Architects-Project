"""
Create RBAC tables in the database
"""
from sqlalchemy import create_engine
from models.user import Base, User, AuditLog
from config import DATA_WAREHOUSE_CONN_STRING
import sys

# Use a separate database for user management or add to existing
RBAC_DB_NAME = "ucu_rbac"
RBAC_CONN_STRING = DATA_WAREHOUSE_CONN_STRING.replace("UCU_DataWarehouse", RBAC_DB_NAME)

def create_rbac_database():
    """Create RBAC database and tables"""
    try:
        # Create database
        from config import MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD
        import pymysql
        
        conn = pymysql.connect(
            host=MYSQL_HOST,
            port=MYSQL_PORT,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD
        )
        cursor = conn.cursor()
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {RBAC_DB_NAME}")
        conn.close()
        
        # Create tables
        engine = create_engine(RBAC_CONN_STRING)
        Base.metadata.create_all(engine)
        print(f"✓ RBAC database '{RBAC_DB_NAME}' created successfully!")
        print(f"✓ Tables created: users, audit_logs")
        return True
    except Exception as e:
        print(f"✗ Error creating RBAC database: {e}")
        return False

if __name__ == "__main__":
    create_rbac_database()

