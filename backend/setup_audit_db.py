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
from config import MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_CHARSET, DATA_WAREHOUSE_CONN_STRING
from urllib.parse import quote_plus

def main():
    password_encoded = quote_plus(MYSQL_PASSWORD) if MYSQL_PASSWORD else ''
    conn_no_db = f"mysql+pymysql://{MYSQL_USER}:{password_encoded}@{MYSQL_HOST}:{MYSQL_PORT}/?charset={MYSQL_CHARSET}"
    print("Creating database ucu_rbac and table audit_logs...")
    try:
        engine = create_engine(conn_no_db)
        with engine.connect() as conn:
            conn.execute(text("CREATE DATABASE IF NOT EXISTS ucu_rbac CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
            conn.commit()
        engine.dispose()

        rbac_conn = DATA_WAREHOUSE_CONN_STRING.replace("UCU_DataWarehouse", "ucu_rbac")
        engine = create_engine(rbac_conn)
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    log_id BIGINT PRIMARY KEY AUTO_INCREMENT,
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
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_user_id (user_id),
                    INDEX idx_action (action),
                    INDEX idx_resource (resource),
                    INDEX idx_created_at (created_at),
                    INDEX idx_role (role_name)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """))
            conn.commit()
        engine.dispose()
        print("Done. ucu_rbac.audit_logs is ready. Audit Logs in the admin UI will work now.")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
