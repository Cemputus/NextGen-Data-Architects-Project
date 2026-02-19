"""
Admin API - system status, ETL tracking, audit logs, run ETL, setup audit DB (sysadmin only).
"""
from pathlib import Path
import re
import threading
import sys
import json
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt
from werkzeug.security import generate_password_hash, check_password_hash
import pandas as pd
from sqlalchemy import create_engine, text

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from config import DATA_WAREHOUSE_CONN_STRING, MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_CHARSET

RBAC_CONN_STRING = DATA_WAREHOUSE_CONN_STRING.replace('UCU_DataWarehouse', 'ucu_rbac')

try:
    from audit_log import log as audit_log
except ImportError:
    audit_log = None

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

SETTINGS_FILE = Path(backend_dir) / 'data' / 'admin_settings.json'


def _load_settings():
    """Load admin settings from JSON file; return dict or empty dict."""
    if not SETTINGS_FILE.exists():
        return {}
    try:
        with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def _save_settings(settings):
    """Persist admin settings to JSON file."""
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
        json.dump(settings, f, indent=2)


@admin_bp.route('/ping', methods=['GET'])
def ping():
    """No auth - confirm admin API is reachable (returns 200)."""
    return jsonify({'ok': True, 'message': 'Admin API active'}), 200


@admin_bp.route('/settings', methods=['GET'])
@jwt_required()
def get_settings():
    """Return persisted admin settings (sysadmin only)."""
    err, code = _require_sysadmin()
    if err is not None:
        return err, code
    return jsonify({'settings': _load_settings()})


@admin_bp.route('/settings', methods=['PUT'])
@jwt_required()
def put_settings():
    """Update and persist admin settings (sysadmin only)."""
    err, code = _require_sysadmin()
    if err is not None:
        return err, code
    data = request.get_json(silent=True) or {}
    settings = data.get('settings')
    if not isinstance(settings, dict):
        return jsonify({'error': 'settings must be an object'}), 400
    _save_settings(settings)
    return jsonify({'settings': _load_settings()})


def _require_sysadmin():
    """Ensure current user has sysadmin role. Returns (None, None) if ok, else (error_response, status_code)."""
    claims = get_jwt()
    role = (claims.get('role') or '').lower()
    if role != 'sysadmin':
        return jsonify({'error': 'Admin access required'}), 403
    return None, None


def _get_warehouse_counts(engine):
    """Return dict of table names to row counts for data warehouse."""
    counts = {}
    tables = [
        'dim_student', 'dim_course', 'dim_semester', 'dim_faculty', 'dim_department',
        'dim_program', 'dim_time', 'fact_enrollment', 'fact_attendance', 'fact_payment', 'fact_grade',
    ]
    for table in tables:
        try:
            r = pd.read_sql_query(f"SELECT COUNT(*) as c FROM `{table}`", engine)
            counts[table] = int(r['c'][0]) if not r.empty and pd.notna(r['c'][0]) else 0
        except Exception:
            counts[table] = None
    return counts


def _get_etl_run_history(log_dir, max_runs=20):
    """Parse ETL log directory and return list of runs."""
    log_dir = Path(log_dir)
    if not log_dir.exists():
        return []
    log_files = sorted(log_dir.glob('etl_pipeline_*.log'), key=lambda p: p.stat().st_mtime, reverse=True)
    history = []
    for log_file in log_files[:max_runs]:
        start_time = None
        duration_str = None
        success = False
        try:
            with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            for line in lines:
                m = re.search(r'Start time: (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})', line)
                if m:
                    start_time = m.group(1)
                m = re.search(r'ETL Pipeline completed successfully in ([\d:\.]+)', line)
                if m:
                    duration_str = m.group(1)
                    success = True
                if 'ETL Pipeline failed' in line:
                    success = False
        except Exception:
            pass
        history.append({
            'log_file': log_file.name,
            'start_time': start_time,
            'duration': duration_str,
            'success': success,
        })
    return history


def _get_audit_logs(limit=200):
    """Fetch audit logs from ucu_rbac.audit_logs if available; else return empty list and message."""
    rbac_conn = DATA_WAREHOUSE_CONN_STRING.replace('UCU_DataWarehouse', 'ucu_rbac')
    try:
        engine = create_engine(rbac_conn)
        limit = max(1, min(int(limit), 500))
        df = pd.read_sql_query(
            f"""
            SELECT log_id, user_id, username, role_name, action, resource, resource_id,
                   status, error_message, created_at
            FROM audit_logs
            ORDER BY created_at DESC
            LIMIT {limit}
            """,
            engine,
        )
        engine.dispose()
        logs = []
        for _, row in df.iterrows():
            logs.append({
                'log_id': int(row['log_id']) if pd.notna(row['log_id']) else None,
                'user_id': int(row['user_id']) if pd.notna(row['user_id']) else None,
                'username': str(row['username']) if pd.notna(row['username']) else '',
                'role_name': str(row['role_name']) if pd.notna(row['role_name']) else '',
                'action': str(row['action']) if pd.notna(row['action']) else '',
                'resource': str(row['resource']) if pd.notna(row['resource']) else '',
                'resource_id': str(row['resource_id']) if pd.notna(row['resource_id']) else '',
                'status': str(row['status']) if pd.notna(row['status']) else '',
                'error_message': str(row['error_message']) if pd.notna(row['error_message']) else '',
                'created_at': row['created_at'].isoformat() if hasattr(row['created_at'], 'isoformat') else str(row['created_at']),
            })
        return logs, None
    except Exception as e:
        return [], str(e)


# Demo/staff accounts (same as auth.DEMO_USERS) for user list display only
DEMO_ACCOUNTS = [
    {'username': 'admin', 'role': 'sysadmin', 'full_name': 'System Administrator'},
    {'username': 'analyst', 'role': 'analyst', 'full_name': 'Data Analyst'},
    {'username': 'senate', 'role': 'senate', 'full_name': 'Senate Member'},
    {'username': 'staff', 'role': 'staff', 'full_name': 'Staff Member'},
    {'username': 'dean', 'role': 'dean', 'full_name': 'Faculty Dean'},
    {'username': 'hod', 'role': 'hod', 'full_name': 'Head of Department'},
    {'username': 'hr', 'role': 'hr', 'full_name': 'HR Manager'},
    {'username': 'finance', 'role': 'finance', 'full_name': 'Finance Manager'},
]


def _ensure_app_users_table(engine):
    """Create ucu_rbac DB if not exists, then app_users table (real users added via Admin)."""
    import pymysql
    try:
        conn = pymysql.connect(
            host=MYSQL_HOST, port=int(MYSQL_PORT), user=MYSQL_USER, password=MYSQL_PASSWORD
        )
        conn.cursor().execute("CREATE DATABASE IF NOT EXISTS ucu_rbac CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        conn.commit()
        conn.close()
    except Exception:
        pass
    try:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS app_users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(100) NOT NULL UNIQUE,
                    password_hash VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL,
                    full_name VARCHAR(200),
                    faculty_id INT NULL,
                    department_id INT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.commit()
    except Exception:
        pass


@admin_bp.route('/faculties', methods=['GET'])
@jwt_required()
def list_faculties():
    """List faculties from dim_faculty for dean assignment. Sysadmin only."""
    err, code = _require_sysadmin()
    if err is not None:
        return err, code
    try:
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        df = pd.read_sql_query("SELECT faculty_id, faculty_name FROM dim_faculty ORDER BY faculty_name", engine)
        engine.dispose()
        return jsonify({'faculties': df.to_dict('records')})
    except Exception as e:
        return jsonify({'error': str(e), 'faculties': []}), 500


@admin_bp.route('/departments', methods=['GET'])
@jwt_required()
def list_departments():
    """List departments from dim_department, optionally by faculty_id. Sysadmin only."""
    err, code = _require_sysadmin()
    if err is not None:
        return err, code
    faculty_id = request.args.get('faculty_id', type=int)
    try:
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        if faculty_id:
            df = pd.read_sql_query(
                text("SELECT department_id, department_name, faculty_id FROM dim_department WHERE faculty_id = :fid ORDER BY department_name"),
                engine,
                params={'fid': faculty_id}
            )
        else:
            df = pd.read_sql_query(
                "SELECT department_id, department_name, faculty_id FROM dim_department ORDER BY department_name",
                engine
            )
        engine.dispose()
        return jsonify({'departments': df.to_dict('records')})
    except Exception as e:
        return jsonify({'error': str(e), 'departments': []}), 500


@admin_bp.route('/users', methods=['GET'])
@jwt_required()
def list_users():
    """List users: students from dim_student + demo/staff accounts + app_users. Sysadmin only."""
    err, code = _require_sysadmin()
    if err is not None:
        return err, code
    search = (request.args.get('search') or '').strip().lower()
    role_filter = (request.args.get('role') or '').strip().lower()
    limit = min(max(request.args.get('limit', type=int) or 500, 1), 2000)
    offset = max(request.args.get('offset', type=int) or 0, 0)
    users = []
    warning = None
    try:
        if not role_filter or role_filter == 'student':
            try:
                engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
                query = """
                    SELECT student_id, access_number, reg_no, first_name, last_name
                    FROM dim_student
                """
                params = {}
                conditions = []
                if search:
                    conditions.append(
                        "(LOWER(access_number) LIKE :search OR LOWER(reg_no) LIKE :search "
                        "OR LOWER(first_name) LIKE :search OR LOWER(last_name) LIKE :search "
                        "OR LOWER(CONCAT(first_name, ' ', last_name)) LIKE :search)"
                    )
                    params['search'] = f'%{search}%'
                if conditions:
                    query += " WHERE " + " AND ".join(conditions)
                query += " ORDER BY last_name, first_name LIMIT :limit OFFSET :offset"
                params['limit'] = limit
                params['offset'] = offset
                df = pd.read_sql_query(text(query), engine, params=params)
                engine.dispose()
                for _, row in df.iterrows():
                    first = str(row['first_name']) if pd.notna(row['first_name']) else ''
                    last = str(row['last_name']) if pd.notna(row['last_name']) else ''
                    users.append({
                        'id': str(row['student_id']),
                        'username': str(row['access_number']) if pd.notna(row['access_number']) else '',
                        'access_number': str(row['access_number']) if pd.notna(row['access_number']) else '',
                        'reg_number': str(row['reg_no']) if pd.notna(row['reg_no']) else '',
                        'first_name': first,
                        'last_name': last,
                        'full_name': f'{first} {last}'.strip() or '—',
                        'role': 'student',
                        'type': 'student',
                    })
            except Exception:
                pass
        if not role_filter or role_filter != 'student':
            for acc in DEMO_ACCOUNTS:
                if role_filter and acc['role'] != role_filter:
                    continue
                if search and search not in acc['username'].lower() and search not in (acc.get('full_name') or '').lower():
                    continue
                users.append({
                    'id': acc['username'],
                    'username': acc['username'],
                    'access_number': None,
                    'reg_number': None,
                    'first_name': acc.get('full_name') or acc['username'],
                    'last_name': '',
                    'full_name': acc.get('full_name') or acc['username'],
                    'role': acc['role'],
                    'type': 'demo',
                })
        # Real users from app_users (added via Add User)
        try:
            rbac_engine = create_engine(RBAC_CONN_STRING)
            _ensure_app_users_table(rbac_engine)
            app_df = pd.read_sql_query(
                "SELECT id, username, role, full_name, faculty_id, department_id FROM app_users",
                rbac_engine
            )
            rbac_engine.dispose()
            demo_usernames = {a['username'].lower() for a in DEMO_ACCOUNTS}
            for _, row in app_df.iterrows():
                uname = str(row['username']) if pd.notna(row['username']) else ''
                if not uname or uname.lower() in demo_usernames:
                    continue
                if role_filter and (str(row['role']) if pd.notna(row['role']) else '').lower() != role_filter:
                    continue
                if search and search not in uname.lower() and search not in (str(row['full_name']) if pd.notna(row['full_name']) else '').lower():
                    continue
                users.append({
                    'id': str(row['id']),
                    'username': uname,
                    'access_number': None,
                    'reg_number': None,
                    'first_name': str(row['full_name']) if pd.notna(row['full_name']) else uname,
                    'last_name': '',
                    'full_name': str(row['full_name']) if pd.notna(row['full_name']) else uname,
                    'role': str(row['role']) if pd.notna(row['role']) else 'staff',
                    'type': 'app_user',
                    'faculty_id': int(row['faculty_id']) if pd.notna(row['faculty_id']) else None,
                    'department_id': int(row['department_id']) if pd.notna(row['department_id']) else None,
                })
        except Exception:
            pass
    except Exception as e:
        warning = str(e)
    out = {'users': users, 'total': len(users)}
    if warning:
        out['warning'] = warning
    return jsonify(out)


@admin_bp.route('/users', methods=['POST'])
@jwt_required()
def create_user():
    """Create a real user (dean, hod, staff, hr, finance) with optional faculty/department scope. Sysadmin only."""
    err, code = _require_sysadmin()
    if err is not None:
        return err, code
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    role = (data.get('role') or 'staff').strip().lower()
    full_name = (data.get('full_name') or '').strip() or username
    faculty_id = data.get('faculty_id') if data.get('faculty_id') is not None else None
    department_id = data.get('department_id') if data.get('department_id') is not None else None
    if not username:
        return jsonify({'error': 'Username is required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    allowed_roles = {'dean', 'hod', 'staff', 'hr', 'finance', 'analyst', 'sysadmin'}
    if role not in allowed_roles:
        return jsonify({'error': f'Role must be one of: {", ".join(sorted(allowed_roles))}'}), 400
    if role == 'dean' and faculty_id is None:
        return jsonify({'error': 'Dean must be assigned to a faculty'}), 400
    if role == 'hod' and department_id is None:
        return jsonify({'error': 'HOD must be assigned to a department'}), 400
    demo_usernames = {a['username'].lower() for a in DEMO_ACCOUNTS}
    if username.lower() in demo_usernames:
        return jsonify({'error': 'Username is reserved for a demo account'}), 400
    try:
        rbac_engine = create_engine(RBAC_CONN_STRING)
        _ensure_app_users_table(rbac_engine)
        password_hash = generate_password_hash(password, method='pbkdf2:sha256')
        with rbac_engine.connect() as conn:
            conn.execute(
                text("""
                    INSERT INTO app_users (username, password_hash, role, full_name, faculty_id, department_id)
                    VALUES (:username, :password_hash, :role, :full_name, :faculty_id, :department_id)
                """),
                {
                    'username': username,
                    'password_hash': password_hash,
                    'role': role,
                    'full_name': full_name,
                    'faculty_id': faculty_id,
                    'department_id': department_id,
                }
            )
            conn.commit()
        rbac_engine.dispose()
        return jsonify({'message': 'User created successfully', 'username': username}), 201
    except Exception as e:
        msg = str(e)
        if 'Duplicate' in msg or 'UNIQUE' in msg or '1062' in msg:
            return jsonify({'error': 'Username already exists'}), 409
        return jsonify({'error': msg}), 500


@admin_bp.route('/system-status', methods=['GET'])
@jwt_required()
def system_status():
    """Data warehouse counts and ETL run history. Optional query: etl_runs_limit=5|10|20|50 (default 20)."""
    err, code = _require_sysadmin()
    if err is not None:
        return err, code
    limit = request.args.get('etl_runs_limit', type=int)
    if limit is None or limit < 1:
        limit = 20
    limit = min(max(limit, 1), 100)
    engine = None
    try:
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        warehouse = _get_warehouse_counts(engine)
        log_dir = Path(backend_dir) / 'logs'
        etl_runs = _get_etl_run_history(log_dir, max_runs=limit)
        return jsonify({
            'warehouse': warehouse,
            'etl_runs': etl_runs,
            'source_databases': {
                'UCU_SourceDB1': 'Academics',
                'UCU_SourceDB2': 'Administration',
            },
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    finally:
        if engine:
            engine.dispose()


def _run_etl_in_background():
    """Run ETL pipeline in a subprocess with backend as cwd so it runs like CLI and logs correctly."""
    import subprocess
    try:
        subprocess.run(
            [sys.executable, '-m', 'etl_pipeline'],
            cwd=str(backend_dir),
            capture_output=False,
            timeout=300,
        )
    except subprocess.TimeoutExpired:
        pass
    except Exception as e:
        import traceback
        traceback.print_exc()


@admin_bp.route('/run-etl', methods=['POST'])
@jwt_required()
def run_etl():
    """Start ETL pipeline in background. Returns immediately; refresh system-status to see new run."""
    err, code = _require_sysadmin()
    if err is not None:
        return err, code
    claims = get_jwt()
    username = claims.get('username') or ''
    role_name = claims.get('role') or ''
    if audit_log:
        audit_log('etl_started', 'system', username=username, role_name=role_name, resource_id='etl_pipeline', status='success')
    thread = threading.Thread(target=_run_etl_in_background, daemon=True)
    thread.start()
    return jsonify({
        'message': 'ETL pipeline started. The page will refresh in a few seconds to show the new run.',
        'started': True,
    }), 202


def _ensure_audit_db():
    """Create ucu_rbac database and audit_logs table if they don't exist. Returns (success, error_message)."""
    from urllib.parse import quote_plus
    password_encoded = quote_plus(MYSQL_PASSWORD) if MYSQL_PASSWORD else ''
    conn_no_db = f"mysql+pymysql://{MYSQL_USER}:{password_encoded}@{MYSQL_HOST}:{MYSQL_PORT}/?charset={MYSQL_CHARSET}"
    try:
        engine = create_engine(conn_no_db)
        with engine.connect() as conn:
            conn.execute(text("CREATE DATABASE IF NOT EXISTS ucu_rbac CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
            conn.commit()
        engine.dispose()

        rbac_conn = DATA_WAREHOUSE_CONN_STRING.replace('UCU_DataWarehouse', 'ucu_rbac')
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
        return True, None
    except Exception as e:
        return False, str(e)


@admin_bp.route('/setup-audit-db', methods=['POST'])
@jwt_required()
def setup_audit_db():
    """Create ucu_rbac database and audit_logs table so audit logging works."""
    err, code = _require_sysadmin()
    if err is not None:
        return err, code
    claims = get_jwt()
    username = claims.get('username') or ''
    role_name = claims.get('role') or ''
    ok, msg = _ensure_audit_db()
    if ok:
        if audit_log:
            audit_log('audit_db_setup', 'system', username=username, role_name=role_name, resource_id='ucu_rbac', status='success')
        return jsonify({'message': 'Audit database and table created. You can now use Audit Logs.'}), 200
    return jsonify({'error': msg}), 500


@admin_bp.route('/audit-logs', methods=['GET'])
@jwt_required()
def audit_logs():
    """Audit log entries (from ucu_rbac.audit_logs or empty if DB not set up)."""
    err, code = _require_sysadmin()
    if err is not None:
        return err, code
    limit = 200
    try:
        logs, db_error = _get_audit_logs(limit=limit)
        return jsonify({
            'logs': logs,
            'total': len(logs),
            'message': None if not db_error else f'Audit DB not available: {db_error}. Use "Set up audit DB" below to create ucu_rbac and audit_logs.',
        })
    except Exception as e:
        return jsonify({'error': str(e), 'logs': [], 'total': 0}), 500
