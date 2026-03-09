"""
Create RBAC tables in the database — PostgreSQL version
"""
from sqlalchemy import create_engine
from models.user import Base, User, AuditLog
from config import DATA_WAREHOUSE_CONN_STRING, DATA_WAREHOUSE_NAME
import sys

RBAC_DB_NAME = "ucu_rbac"
RBAC_CONN_STRING = DATA_WAREHOUSE_CONN_STRING.replace(DATA_WAREHOUSE_NAME, RBAC_DB_NAME)

def create_rbac_database():
    """Create RBAC database and tables"""
    try:
        from pg_helpers import ensure_ucu_rbac_database
        ensure_ucu_rbac_database()

        # Create tables via ORM
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
