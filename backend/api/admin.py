from pathlib import Path
import os
import re
import threading
import sys
import json
import time
from collections import deque
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt
from werkzeug.security import generate_password_hash, check_password_hash
import pandas as pd
from sqlalchemy import create_engine, text

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

ETL_RUN_LEDGER_FILENAME = 'etl_runs_ledger.jsonl'
ETL_HISTORY_MERGE_DB_CAP = 10000

def _get_etl_log_dir():
    raw = os.environ.get('ETL_LOG_DIR')
    if raw and raw.strip():
        log_dir = Path(raw.strip()).resolve()
    else:
        log_dir = (backend_dir / 'logs').resolve()
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir

def _count_synthetic_files():
    synthetic_root = backend_dir / 'data' / 'Synthetic_Data'
    if not synthetic_root.exists():
        return 0
    exts = {'.csv', '.xlsx'}
    try:
        return sum(
            1
            for p in synthetic_root.iterdir()
            if p.is_file() and p.suffix.lower() in exts
        )
    except Exception:
        return 0

from config import (
    DATA_WAREHOUSE_CONN_STRING,
    PG_HOST,
    PG_PORT,
    PG_USER,
    PG_PASSWORD,
)
from config.connection import RBAC_DB_NAME
from db_engines import get_dw_engine, get_rbac_engine
def _get_rbac_conn_string():
    from config.connection import get_sqlalchemy_conn_string, RBAC_DB_NAME
    return get_sqlalchemy_conn_string(RBAC_DB_NAME)

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
    'etl_auto_interval_minutes': 300,
    'sessionTimeout': 24,
    'sessionTimeoutUnit': 'hours',
    'maxLoginAttempts': 5,
    'theme': 'system',
    'compactSidebar': False,
    'about': _ABOUT_DEFAULTS,
}

def _load_settings():
    base = dict(_ADMIN_SETTINGS_DEFAULTS)
    if not SETTINGS_FILE.exists():
        return base
    try:
        with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
            loaded = json.load(f)
        if isinstance(loaded, dict):
            base.update(loaded)
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
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
        json.dump(settings, f, indent=2)

@admin_bp.route('/ping', methods=['GET'])
def ping():
    return jsonify({'ok': True, 'message': 'Admin API active'}), 200

@admin_bp.route('/settings', methods=['GET'])
@jwt_required()
def get_settings():
    err, code = _require_sysadmin()
    if err is not None:
        return err, code
    return jsonify({'settings': _load_settings()})

@admin_bp.route('/settings', methods=['PUT'])
@jwt_required()
def put_settings():
    err, code = _require_sysadmin()
    if err is not None:
        return err, code
    data = request.get_json(silent=True) or {}
    incoming = data.get('settings')
    if not isinstance(incoming, dict):
        return jsonify({'error': 'settings must be an object'}), 400
    prev = _load_settings()
    merged = {**prev, **incoming}
    if merged.get('etl_auto_enabled'):
        if not prev.get('etl_auto_enabled') or merged.get('last_etl_auto_run') is None:
            merged['last_etl_auto_run'] = time.time()
    _save_settings(merged)
    try:
        from export_user_snapshot import run_export_user_snapshot_async
        run_export_user_snapshot_async()
    except Exception:
        pass
    return jsonify({'settings': _load_settings()})

def _require_sysadmin():
    claims = get_jwt()
    role = (claims.get('role') or '').strip().lower()
    if role not in ('sysadmin', 'admin'):
        return jsonify({'error': 'Admin access required'}), 403
    return None, None

_WAREHOUSE_TABLE_INFO = {
    'dim_student': ('Dimension', 'Students (RegNo, name, program, year, status)'),
    'dim_course': ('Dimension', 'Courses (code, name, credits)'),
    'dim_semester': ('Dimension', 'Semesters (Easter, Trinity, Advent)'),
    'dim_faculty': ('Dimension', 'Faculties and deans'),
    'dim_department': ('Dimension', 'Departments and heads'),
    'dim_program': ('Dimension', 'Academic programs'),
    'dim_time': ('Dimension', 'Date dimension for reporting'),
    'dim_employee': ('Dimension', 'Staff/employees (HR)'),
    'dim_app_user': ('Dimension', 'App users and roles (RBAC)'),
    'dim_high_school': ('Dimension', 'High schools linked to students'),
    'dim_date': ('Dimension', 'Synthetic date dimension from source'),
    'fact_enrollment': ('Fact', 'Student course enrollments'),
    'fact_attendance': ('Fact', 'Attendance records by student/date'),
    'fact_payment': ('Fact', 'Fee/payment transactions'),
    'fact_grade': ('Fact', 'Grades and exam status'),
    'fact_transcript': ('Fact', 'Transcript rows from synthetic data'),
    'fact_academic_performance': ('Fact', 'Academic performance KPIs'),
    'fact_sponsorship': ('Fact', 'Scholarship and sponsorship records'),
    'fact_progression': ('Fact', 'Student progression history'),
    'fact_student_high_school': ('Fact', 'Student to high school linkage'),
    'fact_grades_summary': ('Fact', 'Pre-aggregated grade summaries'),
}

def _get_warehouse_counts(engine):
    counts = {}
    tables = [
        'dim_student', 'dim_course', 'dim_semester', 'dim_faculty', 'dim_department',
        'dim_program', 'dim_time', 'dim_employee', 'dim_app_user',
        'dim_high_school', 'dim_date',
        'fact_enrollment', 'fact_attendance', 'fact_payment', 'fact_grade',
        'fact_transcript', 'fact_academic_performance', 'fact_sponsorship',
        'fact_progression', 'fact_student_high_school', 'fact_grades_summary',
    ]
    for table in tables:
        try:
            r = pd.read_sql_query(f'SELECT COUNT(*) as c FROM "{table}"', engine)
            counts[table] = int(r['c'][0]) if not r.empty and pd.notna(r['c'][0]) else 0
        except Exception:
            counts[table] = None
    return counts

def _get_warehouse_tables(engine, counts=None):
    if counts is None:
        counts = _get_warehouse_counts(engine)
    tables = list(counts.keys())
    return [
        {
            'table': t,
            'count': counts[t],
            'type': _WAREHOUSE_TABLE_INFO.get(t, ('Unknown', ''))[0],
            'description': _WAREHOUSE_TABLE_INFO.get(t, ('', ''))[1] or '—',
        }
        for t in tables
    ]

def _get_demo_counts():
    demo = [
        {'role': 'sysadmin'}, {'role': 'analyst'}, {'role': 'senate'}, {'role': 'staff'},
        {'role': 'dean'}, {'role': 'hod'}, {'role': 'hr'}, {'role': 'finance'},
    ]
    return {
        'total': len(demo),
        'staff': sum(1 for d in demo if (d.get('role') or '').lower() == 'staff'),
    }

def _get_console_kpis(warehouse_engine, etl_runs, log_dir):
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
    try:
        r = pd.read_sql_query(text("SELECT COUNT(*) as c FROM dim_student"), warehouse_engine)
        total_students = int(r['c'][0]) if not r.empty and pd.notna(r['c'][0]) else 0
    except Exception:
        total_students = 0
        kpis['system_health'] = 50
    etl_employee_count = 0
    etl_staff_lecturer_count = 0
    try:
        r = pd.read_sql_query(text("SELECT COUNT(*) as c FROM dim_employee"), warehouse_engine)
        etl_employee_count = int(r['c'][0]) if not r.empty and pd.notna(r['c'][0]) else 0
        etl_staff_lecturer_count = etl_employee_count
    except Exception:
        pass
    try:
        rbac_engine = get_rbac_engine()
        _ensure_app_users_table(rbac_engine)
        dim_app_users = 0
        try:
            r = pd.read_sql_query(text("SELECT COUNT(*) as c FROM dim_app_user"), warehouse_engine)
            dim_app_users = int(r['c'][0]) if not r.empty and pd.notna(r['c'][0]) else 0
        except Exception:
            pass
        try:
            r = pd.read_sql_query(text("SELECT COUNT(*) as c FROM app_users"), rbac_engine)
            rbac_app_count = int(r['c'][0]) if not r.empty and pd.notna(r['c'][0]) else 0
        except Exception:
            rbac_app_count = 0
            if kpis['system_health'] == 100:
                kpis['system_health'] = 85
        app_users_count = dim_app_users if dim_app_users > 0 else rbac_app_count
        app_staff_role_count = 0
        try:
            r = pd.read_sql_query(text("""
                SELECT COUNT(*) as c FROM app_users
                WHERE LOWER(TRIM(role)) = 'staff'
            """), rbac_engine)
            app_staff_role_count = int(r['c'][0]) if not r.empty and pd.notna(r['c'][0]) else 0
        except Exception:
            pass
        kpis['employees'] = etl_employee_count + app_users_count
        kpis['staff'] = app_staff_role_count
        try:
            _ensure_audit_db()
            r = pd.read_sql_query(text("""
                SELECT COUNT(DISTINCT CONCAT(
                    COALESCE(ip_address::text, ''),
                    '|',
                    COALESCE(user_agent::text, '')
                )) as c FROM audit_logs
                WHERE LOWER(TRIM(action)) = 'login' AND LOWER(TRIM(COALESCE(status, ''))) = 'success'
                AND created_at >= NOW() - INTERVAL '30 minutes'
            """), rbac_engine)
            kpis['active_sessions'] = int(r['c'][0]) if not r.empty and pd.notna(r['c'][0]) else 0
        except Exception as e:
            print(f"[_get_console_kpis] active_sessions query failed: {e}")
    except Exception as e:
        app_users_count = 0
        if kpis['system_health'] == 100:
            kpis['system_health'] = 85
        kpis['employees'] = etl_employee_count
        kpis['staff'] = etl_staff_lecturer_count
    if kpis['employees'] == 0 and kpis['staff'] == 0:
        try:
            import psycopg2
            conn = psycopg2.connect(
                host=PG_HOST,
                port=int(PG_PORT),
                user=PG_USER,
                password=PG_PASSWORD,
                dbname=RBAC_DB_NAME,
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
    if kpis['employees'] == 0 and kpis['staff'] == 0:
        _demo = _get_demo_counts()
        kpis['employees'] = etl_employee_count + _demo['total']
        kpis['staff'] = etl_staff_lecturer_count + _demo['staff']
        app_users_count = _demo['total']
    kpis['registered_users'] = total_students + app_users_count
    return kpis

def _parse_etl_log_file_for_history(log_path: Path):
    start_time = None
    duration_str = None
    success = False
    failed = False
    try:
        with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        for line in lines:
            m = re.search(r'Start time: (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})', line)
            if m:
                start_time = m.group(1)
            m = re.search(r'ETL Pipeline completed successfully in ([\d:\.]+)', line)
            if m:
                duration_str = m.group(1)
                success = True
                failed = False
            if 'ETL Pipeline failed' in line:
                failed = True
                success = False
    except Exception:
        pass

    if success:
        status = 'success'
    elif failed:
        status = 'failed'
    else:
        status = 'in_progress'

    sort_key = None
    mfn = re.match(r'^etl_pipeline_(\d{8})_(\d{6})\.log$', log_path.name)
    if mfn:
        try:
            sort_key = datetime.strptime(mfn.group(1) + mfn.group(2), '%Y%m%d%H%M%S')
        except Exception:
            sort_key = None
    if sort_key is None and start_time:
        try:
            sort_key = datetime.strptime(start_time, '%Y-%m-%d %H:%M:%S')
        except Exception:
            sort_key = None
    if sort_key is None:
        try:
            sort_key = datetime.fromtimestamp(log_path.stat().st_mtime)
        except Exception:
            sort_key = datetime.min

    run_id = f"etl_{mfn.group(1)}_{mfn.group(2)}" if mfn else ''
    return {
        'run_id': run_id,
        'log_file': log_path.name,
        'start_time': start_time or (sort_key.strftime('%Y-%m-%d %H:%M:%S') if sort_key and sort_key != datetime.min else None),
        'end_time': None,
        'duration': duration_str,
        'success': success,
        'status': status,
        'error_message': '',
        '_sort': sort_key,
    }

def _read_etl_run_ledger_tail(log_dir: Path, max_lines=8000):
    path = log_dir / ETL_RUN_LEDGER_FILENAME
    if not path.exists() or not path.is_file():
        return []
    dq = deque(maxlen=max_lines)
    try:
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line = line.strip()
                if line:
                    dq.append(line)
    except Exception:
        return []
    rows = []
    for line in dq:
        try:
            rows.append(json.loads(line))
        except Exception:
            continue
    return rows

def _sanitize_etl_run_statuses_newest_only_in_progress(combined):
    if not combined:
        return combined
    out = []
    for i, row in enumerate(combined):
        row = dict(row)
        st = (row.get('status') or '').strip().lower()
        if i > 0 and st in ('in_progress', 'running', 'in progress'):
            row['status'] = 'failed'
            row['success'] = False
            if not (row.get('error_message') or '').strip():
                row['error_message'] = 'Superseded by a newer ETL run (incomplete log).'
        out.append(row)
    return out

def _get_etl_run_history(log_dir, max_runs=500):
    log_dir = Path(log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)
    merge_cap = min(ETL_HISTORY_MERGE_DB_CAP, max(max_runs * 4, 500))

    db_rows = []
    engine = None
    try:
        engine = get_dw_engine()
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS etl_run_history (
                    run_id VARCHAR(64) PRIMARY KEY,
                    log_file VARCHAR(255),
                    status VARCHAR(20) NOT NULL,
                    started_at TIMESTAMP NOT NULL,
                    ended_at TIMESTAMP NULL,
                    duration_seconds DOUBLE PRECISION NULL,
                    error_message TEXT NULL,
                    source_mode VARCHAR(50) NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_erh_started_at ON etl_run_history(started_at DESC)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_erh_status ON etl_run_history(status)"))
            conn.commit()
        q = text("""
            SELECT run_id, log_file, status, started_at, ended_at, duration_seconds, error_message
            FROM etl_run_history
            ORDER BY started_at DESC
            LIMIT :lim
        """)
        df = pd.read_sql_query(q, engine, params={'lim': int(merge_cap)})
        if not df.empty:
            for _, r in df.iterrows():
                started = r.get('started_at')
                ended = r.get('ended_at')
                duration_seconds = r.get('duration_seconds')
                duration_text = None
                try:
                    if pd.notna(duration_seconds):
                        duration_text = str(timedelta(seconds=float(duration_seconds)))
                except Exception:
                    duration_text = None
                sk = datetime.min
                if pd.notna(started):
                    try:
                        sk = pd.to_datetime(started).to_pydatetime()
                    except Exception:
                        sk = datetime.min
                db_rows.append({
                    'run_id': str(r.get('run_id') or ''),
                    'log_file': str(r.get('log_file') or ''),
                    'start_time': started.strftime('%Y-%m-%d %H:%M:%S') if hasattr(started, 'strftime') else (str(started) if pd.notna(started) else None),
                    'end_time': ended.strftime('%Y-%m-%d %H:%M:%S') if hasattr(ended, 'strftime') else (str(ended) if pd.notna(ended) else None),
                    'duration': duration_text,
                    'success': str(r.get('status') or '').strip().lower() == 'success',
                    'status': str(r.get('status') or 'in_progress').strip().lower() or 'in_progress',
                    'error_message': str(r.get('error_message') or ''),
                    '_sort': sk,
                })
    except Exception:
        pass
    finally:
        pass

    db_files = {r['log_file'] for r in db_rows if r.get('log_file')}

    file_rows = []
    try:
        for log_path in sorted(log_dir.glob('etl_pipeline_*.log'), key=lambda p: p.stat().st_mtime, reverse=True):
            if log_path.name in db_files:
                continue
            pr = _parse_etl_log_file_for_history(log_path)
            file_rows.append(pr)
    except Exception:
        pass

    ledger_rows = []
    for rec in _read_etl_run_ledger_tail(log_dir):
        lf = (rec.get('log_file') or '').strip()
        if not lf:
            continue
        if lf in db_files:
            continue
        p = log_dir / lf
        if p.exists():
            continue
        sk = None
        raw = rec.get('started_at')
        if raw:
            try:
                sk = datetime.fromisoformat(str(raw).replace('Z', '+00:00'))
            except Exception:
                try:
                    sk = datetime.strptime(str(raw)[:19], '%Y-%m-%d %H:%M:%S')
                except Exception:
                    sk = None
        if sk is None:
            sk = datetime.min
        st = str(raw)[:19] if raw else None
        dur_sec = rec.get('duration_seconds')
        duration_text = None
        try:
            if dur_sec is not None:
                duration_text = str(timedelta(seconds=float(dur_sec)))
        except Exception:
            pass
        st_l = str(rec.get('status') or '').strip().lower()
        ledger_rows.append({
            'run_id': str(rec.get('run_id') or ''),
            'log_file': lf,
            'start_time': st,
            'end_time': (str(rec.get('ended_at') or '')[:19]) if rec.get('ended_at') else None,
            'duration': duration_text,
            'success': st_l == 'success',
            'status': st_l or 'unknown',
            'error_message': str(rec.get('error_message') or ''),
            '_sort': sk,
        })

    seen = set()
    combined = []
    for row in db_rows + file_rows + ledger_rows:
        lf = row.get('log_file') or ''
        if not lf or lf in seen:
            continue
        seen.add(lf)
        combined.append(row)

    combined.sort(key=lambda x: x.get('_sort') or datetime.min, reverse=True)
    combined = _sanitize_etl_run_statuses_newest_only_in_progress(combined)
    out = []
    for row in combined[: int(max_runs)]:
        row = dict(row)
        row.pop('_sort', None)
        out.append(row)
    return out

def _get_audit_logs(limit=200):
    rbac_conn = _get_rbac_conn_string()
    try:
        engine = get_rbac_engine()
        limit = max(1, min(int(limit), 500))
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
    try:
        from pg_helpers import ensure_ucu_rbac_database
        ensure_ucu_rbac_database()
    except Exception:
        pass
    try:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS app_users (
                    id SERIAL PRIMARY KEY,
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

def _server_time_str():
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo("Africa/Kampala")
        now = datetime.now(tz)
    except Exception:
        now = datetime.now()
    return now.strftime('%Y-%m-%d %H:%M:%S')

@admin_bp.route('/server-time', methods=['GET'])
@jwt_required()
def server_time():
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
    err, code = _require_sysadmin()
    if err is not None:
        return err, code
    limit = request.args.get('etl_runs_limit', type=int)
    if limit is None or limit < 1:
        limit = 500
    limit = min(max(limit, 1), 5000)
    engine = None
    try:
        engine = get_dw_engine()
        warehouse = _get_warehouse_counts(engine)
        warehouse_tables = _get_warehouse_tables(engine, warehouse)
        log_dir = _get_etl_log_dir()
        log_dir.mkdir(parents=True, exist_ok=True)
        etl_runs = _get_etl_run_history(log_dir, max_runs=limit)
        console_kpis = _get_console_kpis(engine, etl_runs, log_dir)

        synthetic_file_count = _count_synthetic_files()
        other_db_sources = {
            'UCU_SourceDB1': 'Academics',
            'UCU_SourceDB2': 'Administration',
        }
        source_databases = {
            'Synthetic_Data': f'Primary — {synthetic_file_count} CSV/Excel and 3 Databases',
            **other_db_sources,
        }
        return jsonify({
            'warehouse': warehouse,
            'warehouse_tables': warehouse_tables,
            'etl_runs': etl_runs,
            'console_kpis': console_kpis,
            'source_databases': source_databases,
            'server_time': _server_time_str(),
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    finally:
        pass

@admin_bp.route('/etl-log/<filename>', methods=['GET'])
@jwt_required()
def get_etl_log(filename):
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
        engine = get_dw_engine()
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
        pass

@admin_bp.route('/app-users', methods=['GET'])
@jwt_required()
def list_app_users():
    err, code = _require_sysadmin()
    if err is not None:
        return err, code
    engine = None
    try:
        engine = get_rbac_engine()
        _ensure_app_users_table(engine)
        sql = """
            SELECT id,
                   username,
                   role,
                   full_name,
                   faculty_id,
                   department_id,
                   created_at,
                   created_by_username
            FROM app_users
            ORDER BY username
        """
        df = pd.read_sql_query(text(sql), engine)
        records = df.to_dict('records') if not df.empty else []
        return jsonify({'app_users': records, 'count': len(records)})
    except Exception as e:
        return jsonify({'error': str(e), 'app_users': [], 'count': 0}), 500
    finally:
        pass

def _run_etl_in_background():
    import subprocess
    import sys
    try:
        subprocess.run(
            [sys.executable, '-m', 'etl_pipeline'],
            cwd=str(backend_dir),
            capture_output=False,
            timeout=3600,
        )
    except Exception:
        pass

@admin_bp.route('/run-etl', methods=['POST'])
@jwt_required()
def run_etl():
    err, code = _require_sysadmin()
    if err is not None:
        return err, code

    claims = get_jwt()
    username = claims.get('username') or ''
    role_name = claims.get('role') or ''
    if audit_log:
        audit_log('etl_started', 'system', username=username, role_name=role_name, resource_id='etl_pipeline', status='success')

    import subprocess
    use_fallback = False

    try:
        import requests
        run_id = f"manual__{datetime.utcnow().isoformat()}"
        airflow_base = os.environ.get('AIRFLOW_URL', 'http://airflow:8080')
        api_url = f"{airflow_base.rstrip('/')}/api/v1/dags/etl_manual_run/dagRuns"
        airflow_user = os.environ.get('AIRFLOW_USERNAME', 'admin')
        airflow_pass = os.environ.get('AIRFLOW_PASSWORD', 'admin')
        resp = requests.post(
            api_url,
            json={'dag_run_id': run_id},
            auth=(airflow_user, airflow_pass),
            timeout=30,
        )
        if resp.status_code in (200, 201):
            return jsonify({
                'message': 'ETL pipeline started with Airflow. The page will refresh in a few seconds to show the new run.',
                'started': True,
                'in_progress': True,
            }), 202
        use_fallback = True
    except Exception:
        use_fallback = True

    if not use_fallback:
        try:
            run_id = f"manual__{datetime.utcnow().isoformat()}"
            airflow_dir = backend_dir.parent / 'airflow'
            kwargs = {'check': True, 'timeout': 30, 'capture_output': True}
            if airflow_dir.exists() and airflow_dir.is_dir():
                kwargs['cwd'] = str(airflow_dir.resolve())
            result = subprocess.run(
                ['airflow', 'dags', 'trigger', 'etl_manual_run', '--run-id', run_id],
                **kwargs,
            )
            if result.returncode == 0:
                return jsonify({
                    'message': 'ETL pipeline started with Airflow. The page will refresh in a few seconds to show the new run.',
                    'started': True,
                    'in_progress': True,
                }), 202
            use_fallback = True
        except FileNotFoundError:
            use_fallback = True
        except Exception:
            use_fallback = True

    threading.Thread(target=_run_etl_in_background, daemon=True).start()
    return jsonify({
        'message': 'ETL pipeline started in background from the backend. The page will refresh to show progress.',
        'started': True,
        'in_progress': True,
    }), 202

def _ensure_audit_db():
    try:
        from pg_helpers import ensure_ucu_rbac_database
        ensure_ucu_rbac_database()

        rbac_conn = _get_rbac_conn_string()
        engine = get_rbac_engine()
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
        return True, None
    except Exception as e:
        return False, str(e)

@admin_bp.route('/setup-audit-db', methods=['POST'])
@jwt_required()
def setup_audit_db():
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
    err, code = _require_sysadmin()
    if err is not None:
        return err, code
    try:
        raw_limit = request.args.get('limit')
        print(f"[audit_logs] Raw limit from request: {raw_limit}, type: {type(raw_limit)}")
        if raw_limit is None:
            limit = 500
        else:
            limit = int(raw_limit)
            if limit < 1:
                limit = 500
            elif limit > 5000:
                limit = 5000
        print(f"[audit_logs] Using limit: {limit}")
    except (TypeError, ValueError) as e:
        print(f"[audit_logs] Error parsing limit: {e}")
        limit = 500
    try:
        logs, db_error = _get_audit_logs(limit=limit)
        print(f"[audit_logs] Returning {len(logs)} logs (requested limit was {limit})")
        return jsonify({
            'logs': logs,
            'total': len(logs),
            'limit': limit,
            'server_time': _server_time_str(),
            'message': None if not db_error else f'Audit DB not available: {db_error}. Use \"Set up audit DB\" below to create required audit tables.',
        })
    except Exception as e:
        print(f"[audit_logs] Exception: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'logs': [], 'total': 0}), 500
