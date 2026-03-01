"""
Admin API - system status, ETL tracking, audit logs, run ETL, setup audit DB (sysadmin only).
"""
from pathlib import Path
import os
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

def _get_etl_log_dir():
    """
    Single source of truth for ETL log directory so logs are always stored and retrievable.
    Uses ETL_LOG_DIR env var if set (e.g. persistent volume); otherwise backend_dir/logs.
    Same logic is used in etl_pipeline.py so both write and read from the same place.
    """
    raw = os.environ.get('ETL_LOG_DIR')
    if raw and raw.strip():
        log_dir = Path(raw.strip()).resolve()
    else:
        log_dir = (backend_dir / 'logs').resolve()
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir

from config import (
    DATA_WAREHOUSE_CONN_STRING,
    DATA_WAREHOUSE_NAME,
    MYSQL_HOST,
    MYSQL_PORT,
    MYSQL_USER,
    MYSQL_PASSWORD,
    MYSQL_CHARSET,
)
def _get_rbac_conn_string():
    """RBAC DB connection (ucu_rbac) - same as app.py."""
    return DATA_WAREHOUSE_CONN_STRING.replace(DATA_WAREHOUSE_NAME, 'ucu_rbac')

try:
    from audit_log import log as audit_log
except ImportError:
    audit_log = None

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

SETTINGS_FILE = Path(backend_dir) / 'data' / 'admin_settings.json'


_ABOUT_DEFAULTS = {
    'systemDescription': (
        'This platform is a data analytics and ETL management system. It supports data pipelines, '
        'warehouse integration, analyst dashboards, and administrative oversight—including ETL run '
        'history, notifications, audit logs, and user management.'
    ),
    'teamIntro': (
        'Developed by the NextGen Data Architects team as part of their studies in '
        'Bachelor of Science in Data Science and Analytics at Uganda Christian University.'
    ),
    'developers': [
        {'name': 'Guloba Emmanuel Edube', 'githubHandle': 'Edube20Emmanuel'},
        {'name': 'Emmanuel Nsubuga', 'githubHandle': 'Cemputus'},
        {'name': 'Asingwiire Enoch', 'githubHandle': 'asingwiireenoch'},
    ],
}

_ADMIN_SETTINGS_DEFAULTS = {
    'systemName': 'NextGen Data Architects',
    'apiUrl': '',
    'supportEmail': '',
    'enableNotifications': True,
    'emailOnEtlFailure': True,
    'dailyDigest': False,
    'etl_auto_enabled': False,
    'etl_auto_interval_minutes': 60,
    'sessionTimeout': 24,
    'sessionTimeoutUnit': 'hours',
    'maxLoginAttempts': 5,
    'theme': 'system',
    'compactSidebar': False,
    'about': _ABOUT_DEFAULTS,
}


def _load_settings():
    """Load admin settings from JSON file; merge with defaults so notification keys always exist."""
    base = dict(_ADMIN_SETTINGS_DEFAULTS)
    if not SETTINGS_FILE.exists():
        return base
    try:
        with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
            loaded = json.load(f)
        if isinstance(loaded, dict):
            base.update(loaded)
            # Deep-merge about so missing keys get defaults
            if isinstance(base.get('about'), dict):
                about = dict(_ABOUT_DEFAULTS)
                about.update(base['about'])
                if isinstance(about.get('developers'), list):
                    devs = list(about['developers'])
                    for i, d in enumerate(devs):
                        if isinstance(d, dict):
                            devs[i] = {'name': d.get('name', ''), 'githubHandle': d.get('githubHandle', '')}
                    about['developers'] = devs
                base['about'] = about
            else:
                base['about'] = dict(_ABOUT_DEFAULTS)
        return base
    except Exception:
        return base


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
        'dim_program', 'dim_time', 'dim_employee', 'dim_app_user',
        'fact_enrollment', 'fact_attendance', 'fact_payment', 'fact_grade',
    ]
    for table in tables:
        try:
            r = pd.read_sql_query(f"SELECT COUNT(*) as c FROM `{table}`", engine)
            counts[table] = int(r['c'][0]) if not r.empty and pd.notna(r['c'][0]) else 0
        except Exception:
            counts[table] = None
    return counts


def _get_demo_counts():
    """Demo app user counts for KPI fallback when ucu_rbac is empty or unreachable."""
    demo = [
        {'role': 'sysadmin'}, {'role': 'analyst'}, {'role': 'senate'}, {'role': 'staff'},
        {'role': 'dean'}, {'role': 'hod'}, {'role': 'hr'}, {'role': 'finance'},
    ]
    return {
        'total': len(demo),
        'staff': sum(1 for d in demo if (d.get('role') or '').lower() == 'staff'),
    }


def _get_console_kpis(warehouse_engine, etl_runs, log_dir):
    """Live KPIs: employees = ETL (dim_employee) + all app users; staff = dim_employee (staff/lecturers) + app users with role Staff only.
    etl_jobs = total count of ETL log files (keeps counting as new runs are added)."""
    log_dir = Path(log_dir)
    etl_jobs_total = len(list(log_dir.glob('etl_pipeline_*.log'))) if log_dir.exists() else 0
    kpis = {
        'registered_users': 0,
        'active_sessions': 0,
        'etl_jobs': etl_jobs_total,
        'system_health': 100,
        'employees': 0,
        'staff': 0,
    }
    # Students in warehouse (updates when new data is loaded)
    try:
        r = pd.read_sql_query(text("SELECT COUNT(*) as c FROM dim_student"), warehouse_engine)
        total_students = int(r['c'][0]) if not r.empty and pd.notna(r['c'][0]) else 0
    except Exception:
        total_students = 0
        kpis['system_health'] = 50
    # ETL: employees from warehouse (dim_employee) – re-run ETL to populate
    etl_employee_count = 0
    etl_staff_lecturer_count = 0  # dim_employee rows (all are staff/lecturers per ETL)
    try:
        r = pd.read_sql_query(text("SELECT COUNT(*) as c FROM `dim_employee`"), warehouse_engine)
        etl_employee_count = int(r['c'][0]) if not r.empty and pd.notna(r['c'][0]) else 0
        etl_staff_lecturer_count = etl_employee_count  # dim_employee = staff/lecturers only
    except Exception:
        pass
    # App users (all are non-students: staff, dean, hod, hr, finance, analyst, sysadmin)
    try:
        rbac_engine = create_engine(_get_rbac_conn_string())
        _ensure_app_users_table(rbac_engine)
        try:
            r = pd.read_sql_query(text("SELECT COUNT(*) as c FROM app_users"), rbac_engine)
            app_users_count = int(r['c'][0]) if not r.empty and pd.notna(r['c'][0]) else 0
        except Exception:
            app_users_count = 0
            if kpis['system_health'] > 0:
                kpis['system_health'] = 50
        app_staff_role_count = 0
        try:
            r = pd.read_sql_query(text("""
                SELECT COUNT(*) as c FROM app_users
                WHERE LOWER(TRIM(role)) = 'staff'
            """), rbac_engine)
            app_staff_role_count = int(r['c'][0]) if not r.empty and pd.notna(r['c'][0]) else 0
        except Exception:
            pass
        # Employees = ETL (dim_employee) + all app users (none are students)
        kpis['employees'] = etl_employee_count + app_users_count
        # Staff = only employees with role Staff: dim_employee (staff/lecturers) + app users with role Staff
        kpis['staff'] = etl_staff_lecturer_count + app_staff_role_count
        try:
            _ensure_audit_db()
            r = pd.read_sql_query(text("""
                SELECT COUNT(DISTINCT username) as c FROM audit_logs
                WHERE action = 'login' AND status = 'success'
                AND created_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
            """), rbac_engine)
            kpis['active_sessions'] = int(r['c'][0]) if not r.empty and pd.notna(r['c'][0]) else 0
        except Exception as e:
            print(f"[_get_console_kpis] active_sessions query failed: {e}")
        rbac_engine.dispose()
    except Exception as e:
        app_users_count = 0
        if kpis['system_health'] > 0:
            kpis['system_health'] = 50
        kpis['employees'] = etl_employee_count
        kpis['staff'] = etl_staff_lecturer_count  # at least ETL staff/lecturers
    # If both still 0, try direct PyMySQL to ucu_rbac (in case SQLAlchemy engine had issues)
    if kpis['employees'] == 0 and kpis['staff'] == 0:
        try:
            import pymysql
            conn = pymysql.connect(
                host=MYSQL_HOST,
                port=int(MYSQL_PORT),
                user=MYSQL_USER,
                password=MYSQL_PASSWORD,
                database='ucu_rbac',
                charset=MYSQL_CHARSET or 'utf8mb4',
            )
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM app_users")
            app_total = (cur.fetchone() or (0,))[0]
            cur.execute("SELECT COUNT(*) FROM app_users WHERE LOWER(TRIM(role)) = 'staff'")
            app_staff = (cur.fetchone() or (0,))[0]
            conn.close()
            kpis['employees'] = etl_employee_count + app_total
            kpis['staff'] = etl_staff_lecturer_count + app_staff
            app_users_count = app_total
        except Exception:
            pass
    # If still 0 (e.g. ucu_rbac not set up or empty), include demo app users so KPIs show something
    if kpis['employees'] == 0 and kpis['staff'] == 0:
        _demo = _get_demo_counts()
        kpis['employees'] = etl_employee_count + _demo['total']
        kpis['staff'] = etl_staff_lecturer_count + _demo['staff']
        app_users_count = _demo['total']
    # Total users = students (warehouse) + app users (all roles)
    kpis['registered_users'] = total_students + app_users_count
    return kpis


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
        # Ensure limit is valid integer between 1 and 500 (safe to use in f-string after validation)
        limit = max(1, min(int(limit), 500))
        # Direct SQL with validated limit (safe from injection since limit is validated int)
        # Ensure limit is definitely an integer
        limit_int = int(limit)
        query = f"""
            SELECT log_id, user_id, username, role_name, action, resource, resource_id,
                   status, error_message, created_at
            FROM audit_logs
            ORDER BY created_at DESC
            LIMIT {limit_int}
        """
        print(f"[_get_audit_logs] Executing query: SELECT ... LIMIT {limit_int}")
        df = pd.read_sql_query(query, engine)
        actual_count = len(df)
        print(f"[_get_audit_logs] Query returned {actual_count} rows (requested LIMIT {limit_int})")
        if actual_count > limit_int:
            print(f"[_get_audit_logs] WARNING: Got {actual_count} rows but LIMIT was {limit_int}!")
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
                'created_at': row['created_at'].strftime('%Y-%m-%d %H:%M:%S') if hasattr(row['created_at'], 'strftime') else (row['created_at'].isoformat()[:19].replace('T', ' ') if hasattr(row['created_at'], 'isoformat') else str(row['created_at'])),
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


# User management (users, faculties, departments) is served from main app (app.py) only — do not duplicate here.


def _server_time_str():
    """Single format for admin timestamps: YYYY-MM-DD HH:mm:ss (server local). Use for ETL, audit, and server_time in responses."""
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


@admin_bp.route('/server-time', methods=['GET'])
@jwt_required()
def server_time():
    """Return current server time so admin UI can show one reference and keep all timestamps in sync. Sysadmin only."""
    err, code = _require_sysadmin()
    if err is not None:
        return err, code
    return jsonify({
        'server_time': _server_time_str(),
        'server_time_iso': datetime.now().isoformat(),
    })


@admin_bp.route('/system-status', methods=['GET'])
@jwt_required()
def system_status():
    """Data warehouse counts and ETL run history. Optional query: etl_runs_limit=5|10|20|50 (default 50 for KPI)."""
    err, code = _require_sysadmin()
    if err is not None:
        return err, code
    limit = request.args.get('etl_runs_limit', type=int)
    if limit is None or limit < 1:
        limit = 50  # Default 50 so "Recent ETL runs" KPI matches "Last 50 runs (log files)"
    limit = min(max(limit, 1), 5000)
    engine = None
    try:
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        warehouse = _get_warehouse_counts(engine)
        log_dir = _get_etl_log_dir()
        log_dir.mkdir(parents=True, exist_ok=True)
        etl_runs = _get_etl_run_history(log_dir, max_runs=limit)
        console_kpis = _get_console_kpis(engine, etl_runs, log_dir)
        return jsonify({
            'warehouse': warehouse,
            'etl_runs': etl_runs,
            'console_kpis': console_kpis,
            'source_databases': {
                'UCU_SourceDB1': 'Academics',
                'UCU_SourceDB2': 'Administration',
            },
            'server_time': _server_time_str(),
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    finally:
        if engine:
            engine.dispose()


@admin_bp.route('/etl-log/<filename>', methods=['GET'])
@jwt_required()
def get_etl_log(filename):
    """Return raw content of a single ETL log file. Sysadmin only. Filename must match etl_pipeline_YYYYMMDD_HHMMSS.log."""
    err, code = _require_sysadmin()
    if err is not None:
        return err, code
    if not re.match(r'^etl_pipeline_\d{8}_\d{6}\.log$', filename):
        return jsonify({'error': 'Invalid log filename'}), 400
    log_dir = _get_etl_log_dir()
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = (log_dir / filename).resolve()
    try:
        log_path.relative_to(log_dir.resolve())
    except ValueError:
        return jsonify({'error': 'Invalid path'}), 400
    if not log_path.exists() or not log_path.is_file():
        return jsonify({'error': 'Log file not found'}), 404
    try:
        with open(log_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        return jsonify({'log_file': filename, 'content': content}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/dim-app-users', methods=['GET'])
@jwt_required()
def dim_app_users():
    """
    List App Users from the warehouse dimension dim_app_user.
    Sysadmin only. Optional query params:
      - limit (default 200, max 1000)
      - offset (default 0)
      - role (filter by LOWER(role))
    """
    err, code = _require_sysadmin()
    if err is not None:
        return err, code
    try:
        raw_limit = request.args.get('limit', type=int)
        limit = 200 if raw_limit is None else max(1, min(int(raw_limit), 1000))
    except (TypeError, ValueError):
        limit = 200
    try:
        raw_offset = request.args.get('offset', type=int)
        offset = 0 if raw_offset is None else max(0, int(raw_offset))
    except (TypeError, ValueError):
        offset = 0
    role_filter = (request.args.get('role') or '').strip().lower()
    engine = None
    try:
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        base_sql = """
            SELECT app_user_id, username, role, full_name,
                   faculty_id, department_id, created_at
            FROM dim_app_user
        """
        params = {}
        if role_filter:
            base_sql += " WHERE LOWER(role) = :role"
            params['role'] = role_filter
        base_sql += " ORDER BY username LIMIT :limit OFFSET :offset"
        params['limit'] = limit
        params['offset'] = offset
        df = pd.read_sql_query(text(base_sql), engine, params=params)
        records = df.to_dict('records') if not df.empty else []
        return jsonify({
            'app_users': records,
            'limit': limit,
            'offset': offset,
            'returned': len(records),
        })
    except Exception as e:
        return jsonify({'error': str(e), 'app_users': [], 'limit': limit, 'offset': offset}), 500
    finally:
        if engine:
            engine.dispose()


@admin_bp.route('/app-users', methods=['GET'])
@jwt_required()
def list_app_users():
    """
    List live RBAC app users from ucu_rbac.app_users.
    Sysadmin only. NOTE: Passwords are hashed and are NOT returned.
    """
    err, code = _require_sysadmin()
    if err is not None:
        return err, code
    engine = None
    try:
        engine = create_engine(_get_rbac_conn_string())
        _ensure_app_users_table(engine)
        df = pd.read_sql_query(
            text(
                "SELECT id, username, role, full_name, faculty_id, department_id, created_at "
                "FROM app_users ORDER BY username"
            ),
            engine,
        )
        records = df.to_dict('records') if not df.empty else []
        # Never expose password hashes; only metadata needed for login testing
        return jsonify({'app_users': records, 'count': len(records)})
    except Exception as e:
        return jsonify({'error': str(e), 'app_users': [], 'count': 0}), 500
    finally:
        if engine:
            engine.dispose()


def _run_etl_in_background():
    """Run export_user_snapshot + ETL pipeline in a subprocess with backend as cwd so it runs like CLI and logs correctly."""
    import subprocess
    try:
        # First export latest user/app-user snapshot so RBAC/user data is reproducible
        try:
            subprocess.run(
                [sys.executable, '-m', 'export_user_snapshot'],
                cwd=str(backend_dir),
                capture_output=False,
                timeout=60,
            )
        except subprocess.TimeoutExpired:
            pass

        # Then run the main ETL pipeline (which will also seed from snapshot on clean envs)
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
    """Audit log entries (from ucu_rbac.audit_logs or empty if DB not set up). Query param: limit (default 200, max 500)."""
    err, code = _require_sysadmin()
    if err is not None:
        return err, code
    try:
        raw_limit = request.args.get('limit')
        print(f"[audit_logs] Raw limit from request: {raw_limit}, type: {type(raw_limit)}")
        if raw_limit is None:
            limit = 200
        else:
            limit = int(raw_limit)
            if limit < 1:
                limit = 200
            elif limit > 500:
                limit = 500
        print(f"[audit_logs] Using limit: {limit}")
    except (TypeError, ValueError) as e:
        print(f"[audit_logs] Error parsing limit: {e}")
        limit = 200
    try:
        logs, db_error = _get_audit_logs(limit=limit)
        print(f"[audit_logs] Returning {len(logs)} logs (requested limit was {limit})")
        return jsonify({
            'logs': logs,
            'total': len(logs),
            'limit': limit,
            'server_time': _server_time_str(),
            'message': None if not db_error else f'Audit DB not available: {db_error}. Use "Set up audit DB" below to create ucu_rbac and audit_logs.',
        })
    except Exception as e:
        print(f"[audit_logs] Exception: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'logs': [], 'total': 0}), 500
