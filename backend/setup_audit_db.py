"""
Create ucu_rbac database and audit_logs table for audit trail.
Run once to fix: Unknown database 'ucu_rbac'
  cd backend && python setup_audit_db.py
"""
import sys
from pathlib import Path

backend_dir = Path(__file__).parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, text
from config import DATA_WAREHOUSE_CONN_STRING, DATA_WAREHOUSE_NAME

def main():
    print("Creating database ucu_rbac and table audit_logs...")
    try:
        from pg_helpers import ensure_ucu_rbac_database
        ensure_ucu_rbac_database()

        rbac_conn = DATA_WAREHOUSE_CONN_STRING.replace(DATA_WAREHOUSE_NAME, "ucu_rbac")
        engine = create_engine(rbac_conn)
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    log_id BIGSERIAL PRIMARY KEY,
                    user_id INT,
                    username VARCHAR(100),
                    role_name VARCHAR(50),
                    action VARCHAR(100) NOT NULL,
                    resource VARCHAR(100),
                    resource_id VARCHAR(100),
                    old_value TEXT,
                    new_value TEXT,
                    ip_address VARCHAR(45),
                    user_agent VARCHAR(500),
                    status VARCHAR(50),
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_audit_role ON audit_logs(role_name)"))
            conn.commit()
        engine.dispose()
        print("Done. ucu_rbac.audit_logs is ready. Audit Logs in the admin UI will work now.")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
