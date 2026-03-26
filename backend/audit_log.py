"""
Central audit logging for user actions and system events.
Writes to ucu_rbac.audit_logs. Silently skips if DB/table missing.
"""
from sqlalchemy import create_engine, text
from config import RBAC_DB_NAME
from config.connection import get_sqlalchemy_conn_string


def log(action, resource, username=None, role_name=None, resource_id=None, status='success', error_message=None):
    """
    Record an audit event.
    action: e.g. 'login', 'logout', 'profile_update', 'export_excel', 'export_pdf', 'etl_started', 'audit_db_setup', 'prediction'
    resource: e.g. 'auth', 'profile', 'export', 'system', 'predictions'
    """
    try:
        engine = create_engine(get_sqlalchemy_conn_string(RBAC_DB_NAME))
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
        engine.dispose()
    except Exception:
        pass
