from sqlalchemy import create_engine, text
from config import RBAC_DB_NAME
from config.connection import get_sqlalchemy_conn_string
from db_engines import get_rbac_engine


def log(action, resource, username=None, role_name=None, resource_id=None, status='success', error_message=None):
    try:
        engine = get_rbac_engine()
        with engine.connect() as conn:
            conn.execute(text("""
                INSERT INTO audit_logs (username, role_name, action, resource, resource_id, status, error_message)
                VALUES (:username, :role_name, :action, :resource, :resource_id, :status, :error_message)
            """), {
                'username': username or '',
                'role_name': role_name or '',
                'action': action,
                'resource': resource,
                'resource_id': resource_id,
                'status': status,
                'error_message': error_message,
            })
            conn.commit()
    except Exception:
        pass
