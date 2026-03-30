from flask import Flask, request, jsonify, make_response, g
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required, get_jwt, get_jwt_identity, verify_jwt_in_request
import pandas as pd
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
from pathlib import Path
import re
import threading
import subprocess
import sys
import json
import time
import os

from config.connection import (
    DATA_WAREHOUSE_CONN_STRING,
    DATA_WAREHOUSE_NAME,
    RBAC_DB_NAME,
    SECRET_KEY,
    JWT_SECRET_KEY,
    PG_HOST,
    PG_PORT,
    PG_USER,
    PG_PASSWORD,
    TUITION_TRENDS_SYNTHETIC_FALLBACK,
)
from werkzeug.security import generate_password_hash
from werkzeug.exceptions import NotFound
from ml_models import MultiModelPredictor
from db_engines import get_dw_engine
from cache import make_key as _cache_key, get_json as _cache_get_json, set_json as _cache_set_json
from api.user_mgmt import user_mgmt_bp, _ensure_app_users_table, _ensure_default_app_user
from api.hr import hr_bp

from api.auth import auth_bp
from api.analytics import analytics_bp
from api.hod import hod_bp
try:
    from api.dashboards import dashboards_bp, dashboard_manager_bp, page_config_bp
except Exception as e:
    import traceback
    print("Dashboards blueprint failed to load:", e)
    traceback.print_exc()
    dashboards_bp = None
    dashboard_manager_bp = None
    page_config_bp = None

try:
    from api.predictions import predictions_bp
except ImportError:
    predictions_bp = None

try:
    from api.export import export_bp
except ImportError:
    export_bp = None

try:
    from api.admin import admin_bp
except Exception as e:
    import traceback
    print("Admin blueprint failed to load:", e)
    traceback.print_exc()
    admin_bp = None

try:
    from api.nextgen_query import nextgen_query_bp
except Exception as e:
    import traceback
    print("NextGen Query blueprint failed to load:", e)
    traceback.print_exc()
    nextgen_query_bp = None

app = Flask(__name__)
app.config['SECRET_KEY'] = SECRET_KEY
app.config['JWT_SECRET_KEY'] = JWT_SECRET_KEY
_session_expiry_on = os.environ.get('DISABLE_SESSION_EXPIRY', '0').strip().lower() in ('0', 'false', 'no')
if _session_expiry_on:
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(minutes=60)
    app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(hours=12)
else:
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=3650)
    app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=3650)

_cors_origins = [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000',
    'https://nextgen-mis.vercel.app',
    'https://www.nextgen-mis.vercel.app',
]
_frontend_url = os.environ.get('FRONTEND_URL', '').strip()
if _frontend_url:
    _cors_origins.append(_frontend_url)
_frontend_urls_raw = os.environ.get('FRONTEND_URLS', '').strip()
if _frontend_urls_raw:
    _cors_origins.extend([u.strip() for u in _frontend_urls_raw.split(',') if u.strip()])
_cors_origins = list(dict.fromkeys(_cors_origins))
CORS(app, supports_credentials=True, origins=_cors_origins,
     allow_headers=['Content-Type', 'Authorization'], methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
jwt = JWTManager(app)

@jwt.unauthorized_loader
def _jwt_unauthorized(err_str):
    return jsonify({'error': 'Auth required', 'detail': err_str}), 401

@jwt.invalid_token_loader
def _jwt_invalid_token(err_str):
    return jsonify({'error': 'Invalid token', 'detail': err_str}), 401

@jwt.expired_token_loader
def _jwt_expired_token(jwt_header, jwt_payload):
    return jsonify({'error': 'Token expired'}), 401

@jwt.revoked_token_loader
def _jwt_revoked_token(jwt_header, jwt_payload):
    return jsonify({'error': 'Token revoked'}), 401

KPI_CACHE_TTL_SECONDS = int(os.environ.get("KPI_CACHE_TTL_SECONDS", "10"))

def _kpi_should_cache() -> bool:
    raw = os.environ.get("KPI_CACHE_ENABLED", "1").strip().lower()
    return raw not in ("0", "false", "no", "off")

@app.before_request
def _kpi_cache_before_request():
    if not _kpi_should_cache():
        return None
    if request.method != "GET":
        return None
    path = (request.path or "").strip()
    if not (path.startswith("/api/dashboard") or path.startswith("/api/analytics")):
        return None
    if path.startswith("/api/analytics/filter-options"):
        return None

    try:
        verify_jwt_in_request()
        claims = get_jwt()
    except Exception:
        return None

    params = request.args.to_dict()
    ck = _cache_key(f"kpi:{path}", claims=claims, params=params)
    g._kpi_cache_key = ck
    cached = _cache_get_json(ck)
    if cached:
        resp = make_response(cached, 200)
        resp.headers["Content-Type"] = "application/json"
        resp.headers["X-Cache"] = "HIT"
        g._kpi_cache_hit = True
        return resp
    g._kpi_cache_hit = False
    return None

@app.after_request
def _kpi_cache_after_request(resp):
    if not _kpi_should_cache():
        return resp
    try:
        if request.method != "GET":
            return resp
        path = (request.path or "").strip()
        if not (path.startswith("/api/dashboard") or path.startswith("/api/analytics")):
            return resp
        if resp.status_code != 200:
            return resp
        if resp.mimetype != "application/json":
            return resp
        ck = getattr(g, "_kpi_cache_key", None)
        hit = getattr(g, "_kpi_cache_hit", False)
        if not ck or hit:
            return resp
        _cache_set_json(ck, resp.get_data(as_text=True), ttl_seconds=KPI_CACHE_TTL_SECONDS)
    except Exception:
        pass
    return resp

app.register_blueprint(user_mgmt_bp)
app.register_blueprint(hr_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(analytics_bp)
if dashboards_bp:
    app.register_blueprint(dashboards_bp)
if dashboard_manager_bp:
    app.register_blueprint(dashboard_manager_bp)
if page_config_bp:
    app.register_blueprint(page_config_bp)
if predictions_bp:
    app.register_blueprint(predictions_bp)
if export_bp:
    app.register_blueprint(export_bp)
if admin_bp:
    app.register_blueprint(admin_bp)
if nextgen_query_bp:
    app.register_blueprint(nextgen_query_bp)

@app.route('/api/query/assigned-visualizations', methods=['OPTIONS'], strict_slashes=False)
@app.route('/api/query/assigned-visualizations/<path:subpath>', methods=['OPTIONS'], strict_slashes=False)
def nextgen_query_assigned_viz_options(subpath=None):
    return '', 200

_ADMIN_SETTINGS_FILE = Path(__file__).resolve().parent / 'data' / 'admin_settings.json'

def _load_admin_settings():
    if not _ADMIN_SETTINGS_FILE.exists():
        return {}
    try:
        with open(_ADMIN_SETTINGS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}

def _save_admin_settings(settings):
    try:
        _ADMIN_SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(_ADMIN_SETTINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(settings, f, indent=2)
    except Exception:
        pass

def _run_etl_subprocess():
    backend_dir = Path(__file__).resolve().parent
    etl_failed = False
    log_tail = None
    try:
        result = subprocess.run(
            [sys.executable, '-m', 'etl_pipeline'],
            cwd=str(backend_dir),
            capture_output=True,
            timeout=300,
        )
        if result.returncode != 0:
            etl_failed = True
            if result.stderr:
                log_tail = (result.stderr.decode('utf-8', errors='replace') or '')[-1500:]
            elif result.stdout:
                log_tail = (result.stdout.decode('utf-8', errors='replace') or '')[-1500:]
    except subprocess.TimeoutExpired:
        etl_failed = True
        log_tail = 'ETL subprocess timed out.'
    except Exception as e:
        import traceback
        traceback.print_exc()
        etl_failed = True
        log_tail = str(e)
    if etl_failed:
        settings = _load_admin_settings()
        if settings.get('emailOnEtlFailure') and settings.get('supportEmail'):
            try:
                from email_notifications import send_etl_failure_email
                send_etl_failure_email(settings.get('supportEmail'), log_tail)
            except Exception as e:
                import traceback
                traceback.print_exc()

def _etl_scheduler_loop():
    while True:
        try:
            time.sleep(10)
            if not _ADMIN_SETTINGS_FILE.exists():
                continue
            with open(_ADMIN_SETTINGS_FILE, 'r', encoding='utf-8') as f:
                settings = json.load(f)
            if not settings.get('etl_auto_enabled'):
                continue
            interval_min = float(settings.get('etl_auto_interval_minutes') or 300)
            min_interval_sec = 5 * 60 * 60
            interval_sec = max(min_interval_sec, int(interval_min * 60))
            last_run = settings.get('last_etl_auto_run')
            now_sec = time.time()
            if last_run is None:
                settings['last_etl_auto_run'] = now_sec
                try:
                    _ADMIN_SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
                    with open(_ADMIN_SETTINGS_FILE, 'w', encoding='utf-8') as f:
                        json.dump(settings, f, indent=2)
                except Exception:
                    pass
                continue
            try:
                last_sec = float(last_run) if isinstance(last_run, (int, float)) else datetime.fromisoformat(str(last_run).replace('Z', '+00:00')).timestamp()
            except Exception:
                last_sec = 0
            if (now_sec - last_sec) < interval_sec:
                continue
            settings['last_etl_auto_run'] = now_sec
            try:
                _ADMIN_SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
                with open(_ADMIN_SETTINGS_FILE, 'w', encoding='utf-8') as f:
                    json.dump(settings, f, indent=2)
            except Exception:
                pass
            threading.Thread(target=_run_etl_subprocess, daemon=True).start()
        except Exception as e:
            import traceback
            traceback.print_exc()

if os.environ.get('USE_FLASK_ETL_SCHEDULER') == '1':
    _etl_scheduler_thread = threading.Thread(target=_etl_scheduler_loop, daemon=True)
    _etl_scheduler_thread.start()

def _daily_digest_loop():
    while True:
        try:
            time.sleep(3600)
            settings = _load_admin_settings()
            if not settings.get('dailyDigest') or not (settings.get('supportEmail') or '').strip():
                continue
            today = datetime.now().date().isoformat()
            if settings.get('last_digest_sent') == today:
                continue
            try:
                from email_notifications import send_daily_digest_email, _smtp_configured
                if not _smtp_configured():
                    continue
                summary_lines = [
                    'NextGen MIS – Daily Digest',
                    '================================',
                    f'Date: {today}',
                    '',
                    'Summary:',
                    '- Check the Admin Console for ETL run history and warehouse counts.',
                    '- Check Audit Logs for user and system activity.',
                    '',
                    'This is an automated message. Configure "Daily digest email" in Admin Settings to turn it off.',
                ]
                if send_daily_digest_email(settings.get('supportEmail'), '\n'.join(summary_lines)):
                    settings = _load_admin_settings()
                    settings['last_digest_sent'] = today
                    _save_admin_settings(settings)
            except Exception as e:
                import traceback
                traceback.print_exc()
        except Exception as e:
            import traceback
            traceback.print_exc()

_daily_digest_thread = threading.Thread(target=_daily_digest_loop, daemon=True)
_daily_digest_thread.start()

@app.route('/api/admin/<path:subpath>', methods=['GET', 'POST'], strict_slashes=False)
def admin_user_management_fallback(subpath):
    from api.user_mgmt import admin_list_users, admin_create_user, admin_list_faculties, admin_list_departments
    norm = (subpath or '').strip().rstrip('/').lower()
    if norm == 'ping' and request.method == 'GET':
        return jsonify({'ok': True, 'message': 'Admin API active'}), 200
    if norm == 'users' and request.method == 'GET':
        return admin_list_users()
    if norm == 'users' and request.method == 'POST':
        return admin_create_user()
    if norm == 'faculties' and request.method == 'GET':
        return admin_list_faculties()
    if norm == 'departments' and request.method == 'GET':
        return admin_list_departments()
    return jsonify({'error': 'Not Found', 'message': 'The requested URL was not found.'}), 404

predictor = MultiModelPredictor()
try:
    predictor.load_models()
except:
    print("Models not loaded. Train models first.")

@app.route('/')
def index():
    return jsonify({
        'message': 'NextGen Data Architects API',
        'docs': {
            'health': 'GET /api/status',
            'user_management': 'GET /api/user-mgmt/ping (no auth)',
            'user_mgmt_ping_url': 'http://127.0.0.1:5000/api/user-mgmt/ping',
        },
    }), 200

@app.errorhandler(404)
@app.errorhandler(NotFound)
def not_found(e):
    path = request.path or ''
    msg = 'The requested URL was not found.'
    if path.startswith('/api/user-mgmt') or (path.startswith('/api/admin') and ('users' in path or 'faculties' in path or 'departments' in path or 'ping' in path)):
        msg = 'User Management route not found. Please refresh and try again, or contact an administrator.'
    resp = make_response(jsonify({'error': 'Not Found', 'message': msg}), 404)
    resp.headers['Content-Type'] = 'application/json'
    return resp

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({
        'status': 'ok',
        'message': 'Backend server is running',
        'timestamp': datetime.now().isoformat()
    }), 200

def _dashboard_role_scope():
    try:
        from flask_jwt_extended import get_jwt, get_jwt_identity
        from rbac import Role
        claims = get_jwt()
        role_str = (claims.get('role') or '').strip().lower()
        try:
            role = Role(role_str)
        except Exception:
            return '', ''
        join_sql = """
        JOIN dim_program dp ON ds.program_id = dp.program_id
        JOIN dim_department ddept ON dp.department_id = ddept.department_id
        JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        """
        if role == Role.STUDENT:
            student_id = claims.get('student_id')
            access_number = claims.get('access_number')
            if student_id:
                safe_id = str(student_id).replace("'", "''")
                return '', f"ds.student_id = '{safe_id}'"
            if access_number:
                safe_acc = str(access_number).replace("'", "''")
                return '', f"ds.access_number = '{safe_acc}'"
            return '', '1=0'
        if role == Role.DEAN and claims.get('faculty_id') is not None:
            return join_sql, f"df.faculty_id = {int(claims['faculty_id'])}"
        if role == Role.HOD and claims.get('department_id') is not None:
            return join_sql, f"ddept.department_id = {int(claims['department_id'])}"
        if role == Role.STAFF:
            from api.user_mgmt import _get_staff_assigned_course_codes
            courses = _get_staff_assigned_course_codes(get_jwt_identity())
            if not courses:
                return '', '1=0'
            safe = [str(c).replace("'", "''")[:50] for c in courses]
            in_list = "','".join(safe)
            return '', f"ds.student_id IN (SELECT student_id FROM fact_enrollment WHERE course_code IN ('{in_list}'))"
    except Exception:
        pass
    return '', ''

def _sql_exam_completed_predicate(alias='fg'):
    a = alias
    return (
        f"(UPPER(TRIM(COALESCE({a}.exam_status, ''))) IN ('COMPLETED', 'COMPLETE') "
        f"OR (COALESCE(TRIM({a}.exam_status::text), '') = '' AND {a}.grade IS NOT NULL))"
    )

def _sql_grade_has_outcome_for_analytics(alias='fg'):
    a = alias
    return (
        f"({_sql_exam_completed_predicate(a)} OR "
        f"{a}.grade IS NOT NULL OR "
        f"NULLIF(TRIM({a}.letter_grade::text), '') IS NOT NULL)"
    )

def _sql_effective_grade_numeric(alias='fg'):
    a = alias
    letter_map = (
        f"CASE UPPER(TRIM(COALESCE({a}.letter_grade::text, ''))) "
        "WHEN 'A' THEN 95.0 "
        "WHEN 'B+' THEN 87.5 "
        "WHEN 'B' THEN 82.5 "
        "WHEN 'C+' THEN 77.5 "
        "WHEN 'C' THEN 72.5 "
        "WHEN 'D+' THEN 67.5 "
        "WHEN 'D' THEN 62.5 "
        "WHEN 'F' THEN 45.0 "
        "ELSE NULL END"
    )
    return f"COALESCE({a}.grade::numeric, {letter_map})"

def _filter_query_int(filters, key):
    if not filters:
        return None
    v = filters.get(key)
    if v is None:
        return None
    s = str(v).strip()
    if not s or s.lower() == 'all':
        return None
    try:
        return int(s)
    except Exception:
        return None

def _finance_chart_breakdown(filters):
    if _filter_query_int(filters, 'program_id') is not None:
        return 'program'
    if _filter_query_int(filters, 'department_id') is not None:
        return 'program'
    if _filter_query_int(filters, 'faculty_id') is not None:
        return 'department'
    return 'faculty'

def _staff_assigned_course_fact_where_parts(assigned_course_codes, semester_id_filter, filters, alias='fe'):
    if not assigned_course_codes:
        return None
    safe = [str(c).replace("'", "''")[:50] for c in assigned_course_codes]
    in_list = "','".join(safe)
    parts = [f"{alias}.course_code IN ('{in_list}')"]
    if semester_id_filter is not None:
        parts.append(f"{alias}.semester_id = {int(semester_id_filter)}")
    cc_raw = (filters or {}).get('course_code')
    if cc_raw and str(cc_raw).strip().lower() not in ('', 'all'):
        cc_norm = str(cc_raw).strip()
        assigned_set = {str(c).strip() for c in assigned_course_codes}
        if cc_norm in assigned_set:
            cc_esc = cc_norm.replace("'", "''")
            parts.append(f"{alias}.course_code = '{cc_esc}'")
        else:
            parts.append('1=0')
    return parts

@app.route('/api/dashboard/stats', methods=['GET'])
@jwt_required()
def get_dashboard_stats():
    engine = None
    try:
        from rbac import Role

        engine = get_dw_engine()
        role_join, role_where = _dashboard_role_scope()
        claims = get_jwt()
        role_str = (claims.get('role') or '').strip().lower()
        try:
            dash_role = Role(role_str)
        except Exception:
            dash_role = None

        filters = request.args.to_dict()
        lite = str(filters.get('lite') or '').strip().lower() in ('1', 'true', 'yes')

        try:
            ck = _cache_key("dashboard_stats", claims=claims, params=filters)
            cached = _cache_get_json(ck)
            if cached:
                resp = make_response(cached, 200)
                resp.headers["Content-Type"] = "application/json"
                resp.headers["X-Cache"] = "HIT"
                return resp
        except Exception:
            ck = None

        if dash_role == Role.DEAN and claims.get('faculty_id') is not None:
            filters.pop('faculty_id', None)
        elif dash_role == Role.HOD and claims.get('department_id') is not None:
            filters.pop('department_id', None)
            filters.pop('faculty_id', None)
        elif dash_role == Role.STAFF:
            filters.pop('faculty_id', None)
            filters.pop('department_id', None)
        semester_id_filter = None
        intake_year_filter = None
        try:
            if filters.get('semester_id') and str(filters.get('semester_id')).strip().lower() not in ('', 'all'):
                semester_id_filter = int(filters.get('semester_id'))
        except Exception:
            semester_id_filter = None
        try:
            if filters.get('intake_year') and str(filters.get('intake_year')).strip().lower() not in ('', 'all'):
                intake_year_filter = int(filters.get('intake_year'))
        except Exception:
            intake_year_filter = None

        filter_join = ""
        filter_where_parts = []
        if filters.get('faculty_id') and str(filters.get('faculty_id', '')).strip().lower() not in ('', 'all'):
            filter_join = """
        JOIN dim_program dp ON ds.program_id = dp.program_id
        JOIN dim_department ddept ON dp.department_id = ddept.department_id
        JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
            """
            filter_where_parts.append(f"df.faculty_id = {filters['faculty_id']}")
        if filters.get('department_id') and str(filters.get('department_id', '')).strip().lower() not in ('', 'all'):
            if not filter_join:
                filter_join = """
        JOIN dim_program dp ON ds.program_id = dp.program_id
        JOIN dim_department ddept ON dp.department_id = ddept.department_id
        JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
                """
            filter_where_parts.append(f"ddept.department_id = {filters['department_id']}")
        if filters.get('program_id') and str(filters.get('program_id', '')).strip().lower() not in ('', 'all'):
            if not filter_join:
                filter_join = """
        JOIN dim_program dp ON ds.program_id = dp.program_id
        JOIN dim_department ddept ON dp.department_id = ddept.department_id
        JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
                """
            filter_where_parts.append(f"ds.program_id = {filters['program_id']}")
        if filters.get('high_school') and str(filters.get('high_school', '')).strip().lower() not in ('', 'all'):
            hs = str(filters.get('high_school')).replace("'", "''")
            filter_where_parts.append(f"ds.high_school ILIKE '%{hs}%'")
        if intake_year_filter is not None:
            filter_where_parts.append(f"EXTRACT(YEAR FROM ds.admission_date) = {intake_year_filter}")
        if filters.get('course_code') and str(filters.get('course_code', '')).strip().lower() not in ('', 'all'):
            cc = str(filters.get('course_code')).replace("'", "''")
            filter_where_parts.append(
                f"EXISTS (SELECT 1 FROM fact_enrollment fe2 WHERE fe2.student_id = ds.student_id AND fe2.course_code = '{cc}')"
            )
        if semester_id_filter is not None:
            filter_where_parts.append(
                f"EXISTS (SELECT 1 FROM fact_enrollment fe3 WHERE fe3.student_id = ds.student_id AND fe3.semester_id = {semester_id_filter})"
            )
        use_join = role_join or filter_join
        scope_join = f" {use_join} " if use_join else ""
        all_where = [w for w in [role_where, " AND ".join(filter_where_parts) if filter_where_parts else ""] if w]
        scope_where = f" WHERE {' AND '.join(all_where)} " if all_where else ""

        enroll_student_filter_parts = [
            p for p in filter_where_parts
            if 'FROM fact_enrollment fe2' not in p and 'FROM fact_enrollment fe3' not in p
        ]
        fe_enroll_clauses = []
        if semester_id_filter is not None:
            fe_enroll_clauses.append(f"fe.semester_id = {semester_id_filter}")
        if filters.get('course_code') and str(filters.get('course_code', '')).strip().lower() not in ('', 'all'):
            cc = str(filters.get('course_code')).replace("'", "''")
            fe_enroll_clauses.append(f"fe.course_code = '{cc}'")

        if lite:
            total_students = 0
            total_enrollments = 0
            avg_grade = 0.0
            avg_retention_rate = 0.0
            try:
                total_students_result = pd.read_sql_query(
                    text(f"SELECT COUNT(DISTINCT ds.student_id) as count FROM dim_student ds{scope_join}{scope_where}"),
                    engine
                )
                total_students = int(total_students_result['count'][0]) if not total_students_result.empty and pd.notna(total_students_result['count'][0]) else 0
            except Exception as e:
                print(f"Error getting total_students (lite): {e}")
            try:
                enroll_where_parts = []
                if role_where:
                    enroll_where_parts.append(role_where)
                if enroll_student_filter_parts:
                    enroll_where_parts.append("(" + " AND ".join(enroll_student_filter_parts) + ")")
                if fe_enroll_clauses:
                    enroll_where_parts.append("(" + " AND ".join(fe_enroll_clauses) + ")")
                if enroll_where_parts:
                    wsql = " WHERE " + " AND ".join(enroll_where_parts)
                    enroll_q = (
                        f"SELECT COUNT(*) as count FROM fact_enrollment fe "
                        f"JOIN dim_student ds ON fe.student_id = ds.student_id{scope_join}{wsql}"
                    )
                else:
                    enroll_q = "SELECT COUNT(*) as count FROM fact_enrollment"
                total_enrollments_result = pd.read_sql_query(text(enroll_q), engine)
                total_enrollments = int(total_enrollments_result['count'][0]) if not total_enrollments_result.empty and pd.notna(total_enrollments_result['count'][0]) else 0
            except Exception as e:
                print(f"Error getting total_enrollments (lite): {e}")
            try:
                grade_clauses = [_sql_exam_completed_predicate('fg')]
                if semester_id_filter is not None:
                    grade_clauses.append(f"fg.semester_id = {semester_id_filter}")
                if filters.get('course_code') and str(filters.get('course_code', '')).strip().lower() not in ('', 'all'):
                    cc = str(filters.get('course_code')).replace("'", "''")
                    grade_clauses.append(f"fg.course_code = '{cc}'")
                if role_where:
                    grade_clauses.append(role_where)
                if enroll_student_filter_parts:
                    grade_clauses.append("(" + " AND ".join(enroll_student_filter_parts) + ")")
                wsql = " WHERE " + " AND ".join(grade_clauses)
                avg_q = (
                    f"SELECT AVG(fg.grade) as avg FROM fact_grade fg "
                    f"JOIN dim_student ds ON fg.student_id = ds.student_id{scope_join}{wsql}"
                )
                avg_grade_result = pd.read_sql_query(text(avg_q), engine)
                avg_grade = float(avg_grade_result['avg'][0]) if not avg_grade_result.empty and pd.notna(avg_grade_result['avg'][0]) else 0.0
            except Exception as e:
                print(f"Error getting avg_grade (lite): {e}")
            try:
                ret_q = f"""
                SELECT 
                    COUNT(DISTINCT CASE WHEN ds.status = 'Active' THEN ds.student_id END) as active,
                    COUNT(DISTINCT ds.student_id) as total
                FROM dim_student ds{scope_join}{scope_where}
                """
                retention_result = pd.read_sql_query(text(ret_q), engine)
                if not retention_result.empty and pd.notna(retention_result['total'][0]) and retention_result['total'][0] > 0:
                    avg_retention_rate = (retention_result['active'][0] / retention_result['total'][0]) * 100
                else:
                    avg_retention_rate = 0.0
            except Exception as e:
                print(f"Error getting avg_retention_rate (lite): {e}")

            total_payments = 0.0
            outstanding_payments = 0.0
            tuition_mex_count = 0
            unfiltered_payment_semester_clause = ""
            unfiltered_grade_semester_clause = ""
            if semester_id_filter is not None:
                unfiltered_payment_semester_clause = f" AND fp.semester_id = {semester_id_filter}"
                unfiltered_grade_semester_clause = f" AND fg.semester_id = {semester_id_filter}"
            else:
                try:
                    cur_df2 = pd.read_sql_query(
                        text("SELECT MAX(semester_id) AS sem FROM fact_payment WHERE semester_id IS NOT NULL"),
                        engine,
                    )
                    if not cur_df2.empty and pd.notna(cur_df2['sem'][0]):
                        cur_sem2 = int(cur_df2['sem'][0])
                        unfiltered_payment_semester_clause = f" AND fp.semester_id = {cur_sem2}"
                        unfiltered_grade_semester_clause = f" AND fg.semester_id = {cur_sem2}"
                except Exception as e:
                    print(f"Error determining unfiltered semester (lite): {e}")

            payment_filter_parts = []
            if role_where:
                payment_filter_parts.append(role_where)
            for p in filter_where_parts:
                if "fact_enrollment" in p:
                    continue
                payment_filter_parts.append(p)
            payments_scope_condition = " AND ".join(payment_filter_parts) if payment_filter_parts else "1=1"

            course_code_filter_sql = ""
            if filters.get('course_code') and str(filters.get('course_code', '')).strip().lower() not in ('', 'all'):
                cc = str(filters.get('course_code')).replace("'", "''")
                course_code_filter_sql = f" AND fg.course_code = '{cc}'"

            try:
                tuition_q = f"""
                SELECT COUNT(*) as count
                FROM fact_grade fg
                JOIN dim_student ds ON fg.student_id = ds.student_id
                {scope_join}
                WHERE fg.exam_status = 'MEX'
                  AND (fg.absence_reason LIKE '%%Tuition%%' OR fg.absence_reason LIKE '%%Financial%%')
                  {unfiltered_grade_semester_clause}
                  AND ({payments_scope_condition})
                  {course_code_filter_sql}
                """
                tuition_mex_result = pd.read_sql_query(text(tuition_q), engine)
                tuition_mex_count = int(tuition_mex_result['count'][0]) if not tuition_mex_result.empty and pd.notna(tuition_mex_result['count'][0]) else 0
            except Exception as e:
                print(f"Error getting tuition_mex_count (lite): {e}")

            try:
                pay_q = f"""
                SELECT SUM(fp.amount) as total
                FROM fact_payment fp
                JOIN dim_student ds ON fp.student_id = ds.student_id
                {scope_join}
                WHERE fp.status IN ('Completed', 'SUCCESS')
                  {unfiltered_payment_semester_clause}
                  AND ({payments_scope_condition})
                """
                total_payments_result = pd.read_sql_query(text(pay_q), engine)
                total_payments = float(total_payments_result['total'][0]) if not total_payments_result.empty and pd.notna(total_payments_result['total'][0]) else 0.0
            except Exception as e:
                print(f"Error getting total_payments (lite): {e}")

            try:
                out_q = f"""
                SELECT SUM(fp.amount) as total
                FROM fact_payment fp
                JOIN dim_student ds ON fp.student_id = ds.student_id
                {scope_join}
                WHERE fp.status IN ('Pending', 'FAILED')
                  {unfiltered_payment_semester_clause}
                  AND ({payments_scope_condition})
                """
                outstanding_result = pd.read_sql_query(text(out_q), engine)
                outstanding_payments = float(outstanding_result['total'][0]) if not outstanding_result.empty and pd.notna(outstanding_result['total'][0]) else 0.0
            except Exception as e:
                print(f"Error getting outstanding_payments (lite): {e}")

            return jsonify({
                'total_students': total_students,
                'total_enrollments': total_enrollments,
                'avg_grade': round(avg_grade, 2),
                'avg_retention_rate': round(avg_retention_rate, 2),
                'retention_rate': round(avg_retention_rate, 2),
                'total_payments': round(total_payments, 2),
                'outstanding_payments': round(outstanding_payments, 2),
                'tuition_related_missed': tuition_mex_count,
                'lite': True,
            })

        enrollment_kpi_kind = 'enrollment_records'
        if dash_role == Role.DEAN and claims.get('faculty_id') is not None:
            enrollment_kpi_kind = 'faculty_enrollment_records'
        elif dash_role == Role.HOD and claims.get('department_id') is not None:
            enrollment_kpi_kind = 'department_enrollment_records'

        current_semester_clause = ""
        if semester_id_filter is not None:
            current_semester_clause = f" AND fp.semester_id = {semester_id_filter}"
        else:
            try:
                cur_df = pd.read_sql_query(
                    text("SELECT MAX(semester_id) AS sem FROM fact_payment WHERE semester_id IS NOT NULL"),
                    engine,
                )
                if not cur_df.empty and pd.notna(cur_df['sem'][0]):
                    cur_sem = int(cur_df['sem'][0])
                    current_semester_clause = f" AND fp.semester_id = {cur_sem}"
            except Exception as e:
                print(f"Error determining current semester for payments: {e}")
                current_semester_clause = ""

        unfiltered_payment_semester_clause = ""
        unfiltered_grade_semester_clause = ""
        if semester_id_filter is not None:
            unfiltered_payment_semester_clause = f" AND fp.semester_id = {semester_id_filter}"
            unfiltered_grade_semester_clause = f" AND fg.semester_id = {semester_id_filter}"
        else:
            try:
                cur_df2 = pd.read_sql_query(
                    text("SELECT MAX(semester_id) AS sem FROM fact_payment WHERE semester_id IS NOT NULL"),
                    engine,
                )
                if not cur_df2.empty and pd.notna(cur_df2['sem'][0]):
                    cur_sem2 = int(cur_df2['sem'][0])
                    unfiltered_payment_semester_clause = f" AND fp.semester_id = {cur_sem2}"
                    unfiltered_grade_semester_clause = f" AND fg.semester_id = {cur_sem2}"
            except Exception as e:
                print(f"Error determining unfiltered semester: {e}")

        payment_filter_parts = []
        if role_where:
            payment_filter_parts.append(role_where)
        for p in filter_where_parts:
            if "fact_enrollment" in p:
                continue
            payment_filter_parts.append(p)
        payments_scope_condition = " AND ".join(payment_filter_parts) if payment_filter_parts else "1=1"
        course_code_filter_sql = ""
        if filters.get('course_code') and str(filters.get('course_code', '')).strip().lower() not in ('', 'all'):
            cc = str(filters.get('course_code')).replace("'", "''")
            course_code_filter_sql = f" AND fg.course_code = '{cc}'"

        try:
            total_students_result = pd.read_sql_query(
                text(f"SELECT COUNT(DISTINCT ds.student_id) as count FROM dim_student ds{scope_join}{scope_where}"),
                engine
            )
            total_students = int(total_students_result['count'][0]) if not total_students_result.empty and pd.notna(total_students_result['count'][0]) else 0
        except Exception as e:
            print(f"Error getting total_students: {e}")
            total_students = 0
        
        try:
            total_courses_result = pd.read_sql_query("SELECT COUNT(*) as count FROM dim_course", engine)
            total_courses = int(total_courses_result['count'][0]) if not total_courses_result.empty and pd.notna(total_courses_result['count'][0]) else 0
        except Exception as e:
            print(f"Error getting total_courses: {e}")
            total_courses = 0

        try:
            if dash_role == Role.STAFF:
                enrollment_kpi_kind = 'assigned_class_students'
                from api.user_mgmt import _get_staff_assigned_course_codes
                assigned = _get_staff_assigned_course_codes(get_jwt_identity())
                staff_fe_parts = _staff_assigned_course_fact_where_parts(
                    assigned, semester_id_filter, filters, alias='fe'
                )
                if staff_fe_parts is None:
                    total_enrollments = 0
                else:
                    staff_where_sql = " AND ".join(staff_fe_parts)
                    if enroll_student_filter_parts:
                        staff_where_sql = staff_where_sql + " AND (" + " AND ".join(enroll_student_filter_parts) + ")"
                    fj = f" {filter_join} " if (filter_join and str(filter_join).strip()) else ""
                    enroll_q = (
                        f"SELECT COUNT(DISTINCT fe.student_id) as count FROM fact_enrollment fe "
                        f"JOIN dim_student ds ON fe.student_id = ds.student_id{fj} WHERE {staff_where_sql}"
                    )
                    total_enrollments_result = pd.read_sql_query(text(enroll_q), engine)
                    total_enrollments = int(total_enrollments_result['count'][0]) if not total_enrollments_result.empty and pd.notna(total_enrollments_result['count'][0]) else 0
            else:
                enroll_where_parts = []
                if role_where:
                    enroll_where_parts.append(role_where)
                if enroll_student_filter_parts:
                    enroll_where_parts.append("(" + " AND ".join(enroll_student_filter_parts) + ")")
                if fe_enroll_clauses:
                    enroll_where_parts.append("(" + " AND ".join(fe_enroll_clauses) + ")")
                if enroll_where_parts:
                    wsql = " WHERE " + " AND ".join(enroll_where_parts)
                    needs_dim_student = bool(
                        str(scope_join).strip()
                        or role_where
                        or enroll_student_filter_parts
                    )
                    if needs_dim_student:
                        enroll_q = (
                            f"SELECT COUNT(*) as count FROM fact_enrollment fe "
                            f"JOIN dim_student ds ON fe.student_id = ds.student_id{scope_join}{wsql}"
                        )
                    else:
                        enroll_q = f"SELECT COUNT(*) as count FROM fact_enrollment fe{wsql}"
                else:
                    enroll_q = "SELECT COUNT(*) as count FROM fact_enrollment"
                total_enrollments_result = pd.read_sql_query(text(enroll_q), engine)
                total_enrollments = int(total_enrollments_result['count'][0]) if not total_enrollments_result.empty and pd.notna(total_enrollments_result['count'][0]) else 0
        except Exception as e:
            print(f"Error getting total_enrollments: {e}")
            total_enrollments = 0

        try:
            if dash_role == Role.STAFF:
                from api.user_mgmt import _get_staff_assigned_course_codes
                assigned_g = _get_staff_assigned_course_codes(get_jwt_identity())
                staff_fg_parts = _staff_assigned_course_fact_where_parts(
                    assigned_g, semester_id_filter, filters, alias='fg'
                )
                if staff_fg_parts is None:
                    avg_grade = 0.0
                else:
                    grade_clauses = [_sql_exam_completed_predicate('fg')] + staff_fg_parts
                    if enroll_student_filter_parts:
                        grade_clauses.append("(" + " AND ".join(enroll_student_filter_parts) + ")")
                    fj = f" {filter_join} " if (filter_join and str(filter_join).strip()) else ""
                    wsql = " WHERE " + " AND ".join(grade_clauses)
                    avg_q = (
                        f"SELECT AVG(fg.grade) as avg FROM fact_grade fg "
                        f"JOIN dim_student ds ON fg.student_id = ds.student_id{fj}{wsql}"
                    )
                    avg_grade_result = pd.read_sql_query(text(avg_q), engine)
                    avg_grade = float(avg_grade_result['avg'][0]) if not avg_grade_result.empty and pd.notna(avg_grade_result['avg'][0]) else 0.0
            else:
                grade_clauses = [_sql_exam_completed_predicate('fg')]
                if semester_id_filter is not None:
                    grade_clauses.append(f"fg.semester_id = {semester_id_filter}")
                if filters.get('course_code') and str(filters.get('course_code', '')).strip().lower() not in ('', 'all'):
                    cc = str(filters.get('course_code')).replace("'", "''")
                    grade_clauses.append(f"fg.course_code = '{cc}'")
                if role_where:
                    grade_clauses.append(role_where)
                if enroll_student_filter_parts:
                    grade_clauses.append("(" + " AND ".join(enroll_student_filter_parts) + ")")
                needs_grade_ds = bool(
                    str(scope_join).strip() or role_where or enroll_student_filter_parts
                )
                if needs_grade_ds:
                    wsql = " WHERE " + " AND ".join(grade_clauses)
                    avg_q = (
                        f"SELECT AVG(fg.grade) as avg FROM fact_grade fg "
                        f"JOIN dim_student ds ON fg.student_id = ds.student_id{scope_join}{wsql}"
                    )
                else:
                    sem_grade_clause = f" AND fg.semester_id = {semester_id_filter}" if semester_id_filter is not None else ""
                    cc_clause = ""
                    if filters.get('course_code') and str(filters.get('course_code', '')).strip().lower() not in ('', 'all'):
                        cc = str(filters.get('course_code')).replace("'", "''")
                        cc_clause = f" AND fg.course_code = '{cc}'"
                    avg_q = (
                        f"SELECT AVG(fg.grade) as avg FROM fact_grade fg "
                        f"WHERE {_sql_exam_completed_predicate('fg')}{sem_grade_clause}{cc_clause}"
                    )
                avg_grade_result = pd.read_sql_query(text(avg_q), engine)
                avg_grade = float(avg_grade_result['avg'][0]) if not avg_grade_result.empty and pd.notna(avg_grade_result['avg'][0]) else 0.0
        except Exception as e:
            print(f"Error getting avg_grade: {e}")
            avg_grade = 0.0

        try:
            if role_where:
                sem_grade_clause = f" AND fg.semester_id = {semester_id_filter}" if semester_id_filter is not None else ""
                mex_q = f"SELECT COUNT(*) as count FROM fact_grade fg JOIN dim_student ds ON fg.student_id = ds.student_id{scope_join} WHERE fg.exam_status = 'MEX'{sem_grade_clause} AND {role_where}"
            else:
                sem_grade_clause = f" AND semester_id = {semester_id_filter}" if semester_id_filter is not None else ""
                mex_q = f"SELECT COUNT(*) as count FROM fact_grade WHERE exam_status = 'MEX'{sem_grade_clause}"
            mex_count_result = pd.read_sql_query(text(mex_q), engine)
            mex_count = int(mex_count_result['count'][0]) if not mex_count_result.empty and pd.notna(mex_count_result['count'][0]) else 0
        except Exception as e:
            print(f"Error getting mex_count: {e}")
            mex_count = 0

        try:
            if role_where:
                sem_grade_clause = f" AND fg.semester_id = {semester_id_filter}" if semester_id_filter is not None else ""
                fex_q = f"SELECT COUNT(*) as count FROM fact_grade fg JOIN dim_student ds ON fg.student_id = ds.student_id{scope_join} WHERE fg.exam_status = 'FEX'{sem_grade_clause} AND {role_where}"
            else:
                sem_grade_clause = f" AND semester_id = {semester_id_filter}" if semester_id_filter is not None else ""
                fex_q = f"SELECT COUNT(*) as count FROM fact_grade WHERE exam_status = 'FEX'{sem_grade_clause}"
            fex_count_result = pd.read_sql_query(text(fex_q), engine)
            fex_count = int(fex_count_result['count'][0]) if not fex_count_result.empty and pd.notna(fex_count_result['count'][0]) else 0
        except Exception as e:
            print(f"Error getting fex_count: {e}")
            fex_count = 0

        try:
            tuition_q = f"""
            SELECT COUNT(*) as count
            FROM fact_grade fg
            JOIN dim_student ds ON fg.student_id = ds.student_id
            {scope_join}
            WHERE fg.exam_status = 'MEX'
              AND (fg.absence_reason LIKE '%%Tuition%%' OR fg.absence_reason LIKE '%%Financial%%')
              {unfiltered_grade_semester_clause}
              AND ({payments_scope_condition})
              {course_code_filter_sql}
            """
            tuition_mex_result = pd.read_sql_query(text(tuition_q), engine)
            tuition_mex_count = int(tuition_mex_result['count'][0]) if not tuition_mex_result.empty and pd.notna(tuition_mex_result['count'][0]) else 0
        except Exception as e:
            print(f"Error getting tuition_mex_count: {e}")
            tuition_mex_count = 0

        try:
            pay_q = f"""
            SELECT SUM(fp.amount) as total
            FROM fact_payment fp
            JOIN dim_student ds ON fp.student_id = ds.student_id
            {scope_join}
            WHERE fp.status IN ('Completed', 'SUCCESS')
              {unfiltered_payment_semester_clause}
              AND ({payments_scope_condition})
            """
            total_payments_result = pd.read_sql_query(text(pay_q), engine)
            total_payments = float(total_payments_result['total'][0]) if not total_payments_result.empty and pd.notna(total_payments_result['total'][0]) else 0.0
        except Exception as e:
            print(f"Error getting total_payments: {e}")
            total_payments = 0.0

        try:
            if role_where:
                att_q = f"SELECT AVG(fa.total_hours) as avg FROM fact_attendance fa JOIN dim_student ds ON fa.student_id = ds.student_id{scope_join}{scope_where}"
            else:
                att_q = "SELECT AVG(total_hours) as avg FROM fact_attendance"
            avg_attendance_result = pd.read_sql_query(text(att_q), engine)
            avg_attendance = float(avg_attendance_result['avg'][0]) if not avg_attendance_result.empty and pd.notna(avg_attendance_result['avg'][0]) else 0.0
        except Exception as e:
            print(f"Error getting avg_attendance: {e}")
            avg_attendance = 0.0

        try:
            if role_where:
                hs_q = f"SELECT COUNT(DISTINCT ds.high_school) as count FROM dim_student ds{scope_join}{scope_where} AND ds.high_school IS NOT NULL AND ds.high_school != ''"
            else:
                hs_q = "SELECT COUNT(DISTINCT high_school) as count FROM dim_student WHERE high_school IS NOT NULL AND high_school != ''"
            high_schools_result = pd.read_sql_query(text(hs_q), engine)
            total_high_schools = int(high_schools_result['count'][0]) if not high_schools_result.empty and pd.notna(high_schools_result['count'][0]) else 0
        except Exception as e:
            print(f"Error getting total_high_schools: {e}")
            total_high_schools = 0

        try:
            if dash_role == Role.STAFF:
                from api.user_mgmt import _get_staff_assigned_course_codes
                assigned_r = _get_staff_assigned_course_codes(get_jwt_identity())
                staff_fe_r = _staff_assigned_course_fact_where_parts(
                    assigned_r, semester_id_filter, filters, alias='fe'
                )
                if staff_fe_r is None:
                    avg_retention_rate = 0.0
                else:
                    fe_where = " AND ".join(staff_fe_r)
                    if enroll_student_filter_parts:
                        fe_where = fe_where + " AND (" + " AND ".join(enroll_student_filter_parts) + ")"
                    fj = f" {filter_join} " if (filter_join and str(filter_join).strip()) else ""
                    ret_q = f"""
                    SELECT
                        COUNT(DISTINCT CASE WHEN ds.status = 'Active' THEN ds.student_id END) as active,
                        COUNT(DISTINCT ds.student_id) as total
                    FROM dim_student ds
                    JOIN fact_enrollment fe ON fe.student_id = ds.student_id{fj}
                    WHERE {fe_where}
                    """
                    retention_result = pd.read_sql_query(text(ret_q), engine)
                    if not retention_result.empty and pd.notna(retention_result['total'][0]) and retention_result['total'][0] > 0:
                        avg_retention_rate = (retention_result['active'][0] / retention_result['total'][0]) * 100
                    else:
                        avg_retention_rate = 0.0
            elif all_where:
                ret_q = f"""
                SELECT 
                    COUNT(DISTINCT CASE WHEN ds.status = 'Active' THEN ds.student_id END) as active,
                    COUNT(DISTINCT ds.student_id) as total
                FROM dim_student ds{scope_join}{scope_where}
                """
                retention_result = pd.read_sql_query(text(ret_q), engine)
                if not retention_result.empty and pd.notna(retention_result['total'][0]) and retention_result['total'][0] > 0:
                    avg_retention_rate = (retention_result['active'][0] / retention_result['total'][0]) * 100
                else:
                    avg_retention_rate = 0.0
            else:
                ret_q = """
                SELECT 
                    COUNT(DISTINCT CASE WHEN status = 'Active' THEN student_id END) as active,
                    COUNT(DISTINCT student_id) as total
                FROM dim_student
                """
                retention_result = pd.read_sql_query(text(ret_q), engine)
                if not retention_result.empty and pd.notna(retention_result['total'][0]) and retention_result['total'][0] > 0:
                    avg_retention_rate = (retention_result['active'][0] / retention_result['total'][0]) * 100
                else:
                    avg_retention_rate = 0.0
        except Exception as e:
            print(f"Error getting avg_retention_rate: {e}")
            avg_retention_rate = 0.0

        try:
            if role_where:
                grad_q = f"""
                SELECT 
                    COUNT(DISTINCT CASE WHEN ds.status = 'Graduated' THEN ds.student_id END) as graduated,
                    COUNT(DISTINCT ds.student_id) as total
                FROM dim_student ds{scope_join}{scope_where}
                """
            else:
                grad_q = """
                SELECT 
                    COUNT(DISTINCT CASE WHEN status = 'Graduated' THEN student_id END) as graduated,
                    COUNT(DISTINCT student_id) as total
                FROM dim_student
                """
            graduation_result = pd.read_sql_query(text(grad_q), engine)
            if not graduation_result.empty and pd.notna(graduation_result['total'][0]) and graduation_result['total'][0] > 0:
                avg_graduation_rate = (graduation_result['graduated'][0] / graduation_result['total'][0]) * 100
            else:
                avg_graduation_rate = 0.0
        except Exception as e:
            print(f"Error getting avg_graduation_rate: {e}")
            avg_graduation_rate = 0.0

        try:
            out_q = f"""
            SELECT SUM(fp.amount) as total
            FROM fact_payment fp
            JOIN dim_student ds ON fp.student_id = ds.student_id
            {scope_join}
            WHERE fp.status IN ('Pending', 'FAILED')
              {unfiltered_payment_semester_clause}
              AND ({payments_scope_condition})
            """
            outstanding_result = pd.read_sql_query(text(out_q), engine)
            outstanding_payments = float(outstanding_result['total'][0]) if not outstanding_result.empty and pd.notna(outstanding_result['total'][0]) else 0.0
        except Exception as e:
            print(f"Error getting outstanding_payments: {e}")
            outstanding_payments = 0.0

        grade_kpi_kind = 'grade_average'
        retention_kpi_kind = 'retention_rate'
        if dash_role == Role.STAFF:
            grade_kpi_kind = 'assigned_class_grade_average'
            retention_kpi_kind = 'assigned_class_retention'
        elif dash_role == Role.DEAN and claims.get('faculty_id') is not None:
            grade_kpi_kind = 'faculty_grade_average'
            retention_kpi_kind = 'faculty_retention'
        elif dash_role == Role.HOD and claims.get('department_id') is not None:
            grade_kpi_kind = 'department_grade_average'
            retention_kpi_kind = 'department_retention'

        response_payload = {
            'total_students': total_students,
            'total_courses': total_courses,
            'total_enrollments': total_enrollments,
            'enrollment_kpi_kind': enrollment_kpi_kind,
            'grade_kpi_kind': grade_kpi_kind,
            'retention_kpi_kind': retention_kpi_kind,
            'avg_grade': round(avg_grade, 2),
            'total_payments': round(total_payments, 2),
            'outstanding_payments': round(outstanding_payments, 2),
            'avg_attendance': round(avg_attendance, 2),
            'missed_exams': mex_count,
            'failed_exams': fex_count,
            'tuition_related_missed': tuition_mex_count,
            'total_high_schools': total_high_schools,
            'high_schools_count': total_high_schools,
            'avg_retention_rate': round(avg_retention_rate, 2),
            'retention_rate': round(avg_retention_rate, 2),
            'avg_graduation_rate': round(avg_graduation_rate, 2),
            'graduation_rate': round(avg_graduation_rate, 2),
        }

        if dash_role == Role.STUDENT and role_where:
            try:
                skidf = pd.read_sql_query(
                    text(f"""
                    SELECT
                      (SELECT COUNT(*)::int FROM (
                        SELECT DISTINCT NULLIF(TRIM(fe.course_code), '') AS cc
                        FROM fact_enrollment fe
                        JOIN dim_student ds ON fe.student_id = ds.student_id
                        WHERE {role_where} AND NULLIF(TRIM(fe.course_code), '') IS NOT NULL
                        UNION
                        SELECT DISTINCT NULLIF(TRIM(fg.course_code), '') AS cc
                        FROM fact_grade fg
                        JOIN dim_student ds ON fg.student_id = ds.student_id
                        WHERE {role_where} AND NULLIF(TRIM(fg.course_code), '') IS NOT NULL
                      ) z) AS courses_registered,
                      (SELECT COUNT(*)::int FROM fact_grade fg
                        JOIN dim_student ds ON fg.student_id = ds.student_id
                        WHERE {role_where}) AS total_grades,
                      (SELECT COUNT(*)::int FROM fact_grade fg
                        JOIN dim_student ds ON fg.student_id = ds.student_id
                        WHERE {role_where}
                          AND UPPER(TRIM(COALESCE(fg.exam_status, ''))) = 'COMPLETED') AS completed_exams,
                      (SELECT COUNT(*)::int FROM fact_attendance fa
                        JOIN dim_student ds ON fa.student_id = ds.student_id
                        WHERE {role_where}) AS attendance_sessions_recorded,
                      (SELECT 100.0 * COALESCE(AVG(fa.days_present::double precision), 0) FROM fact_attendance fa
                        JOIN dim_student ds ON fa.student_id = ds.student_id
                        WHERE {role_where}) AS attendance_rate
                    """),
                    engine,
                )
                if not skidf.empty:
                    row = skidf.iloc[0]
                    response_payload['courses_registered'] = int(row['courses_registered'] or 0)
                    response_payload['total_grades'] = int(row['total_grades'] or 0)
                    response_payload['completed_exams'] = int(row['completed_exams'] or 0)
                    response_payload['attendance_sessions_recorded'] = int(row['attendance_sessions_recorded'] or 0)
                    ar_stu = float(row['attendance_rate'] or 0)
                    response_payload['attendance_rate'] = round(max(0.0, min(100.0, ar_stu)), 1)
                    response_payload['student_scoped_dashboard'] = True
            except Exception as e:
                print(f"Error getting student_scoped_dashboard KPIs: {e}")

        resp = jsonify(response_payload)
        try:
            if ck:
                _cache_set_json(ck, resp.get_data(as_text=True), ttl_seconds=15 if lite else 8)
                resp.headers["X-Cache"] = "MISS"
        except Exception:
            pass
        return resp
    except Exception as e:
        import traceback
        print(f"Error in get_dashboard_stats: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500
    finally:
        pass

@app.route('/api/dashboard/students-by-department', methods=['GET'])
@jwt_required()
def get_students_by_department():
    try:
        from flask_jwt_extended import get_jwt
        from rbac import Role

        claims = get_jwt()
        role_str = claims.get('role', 'student')
        try:
            role = Role(role_str.lower())
        except Exception:
            role = Role.STUDENT

        engine = get_dw_engine()
        filters = request.args.to_dict()

        try:
            ck = _cache_key("students_by_department", claims=claims, params=filters)
            cached = _cache_get_json(ck)
            if cached:
                resp = make_response(cached, 200)
                resp.headers["Content-Type"] = "application/json"
                resp.headers["X-Cache"] = "HIT"
                return resp
        except Exception:
            ck = None

        group_by = (filters.get('group_by') or 'department').strip().lower()
        if group_by not in ('department', 'faculty', 'program', 'course', 'year_of_study'):
            group_by = 'department'

        where_clauses = []

        if role == Role.DEAN and claims.get('faculty_id'):
            where_clauses.append(f"df.faculty_id = {claims['faculty_id']}")
        elif role == Role.HOD and claims.get('department_id'):
            where_clauses.append(f"ddept.department_id = {claims['department_id']}")
        elif role == Role.STAFF and claims.get('department_id'):
            where_clauses.append(f"ddept.department_id = {claims['department_id']}")

        faculty_id = filters.get('faculty_id')
        department_id = filters.get('department_id')
        program_id = filters.get('program_id')
        semester_id = filters.get('semester_id')
        intake_year = filters.get('intake_year')
        high_school = filters.get('high_school')
        course_code = filters.get('course_code')

        try:
            if faculty_id and str(faculty_id).strip().lower() not in ('', 'all'):
                where_clauses.append(f"df.faculty_id = {int(faculty_id)}")
        except Exception:
            pass
        try:
            if department_id and str(department_id).strip().lower() not in ('', 'all'):
                where_clauses.append(f"ddept.department_id = {int(department_id)}")
        except Exception:
            pass
        try:
            if program_id and str(program_id).strip().lower() not in ('', 'all'):
                where_clauses.append(f"ds.program_id = {int(program_id)}")
        except Exception:
            pass
        try:
            if semester_id and str(semester_id).strip().lower() not in ('', 'all'):
                where_clauses.append(f"fe.semester_id = {int(semester_id)}")
        except Exception:
            pass
        try:
            if intake_year and str(intake_year).strip().lower() not in ('', 'all'):
                where_clauses.append(f"EXTRACT(YEAR FROM ds.admission_date) = {int(intake_year)}")
        except Exception:
            pass
        if high_school and str(high_school).strip().lower() not in ('', 'all'):
            hs = str(high_school).replace("'", "''")
            where_clauses.append(f"ds.high_school ILIKE '%{hs}%'")
        if course_code and str(course_code).strip().lower() not in ('', 'all'):
            cc = str(course_code).replace("'", "''")
            where_clauses.append(f"fe.course_code = '{cc}'")

        where_clause = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        if group_by == 'faculty':
            query = f"""
            SELECT 
                df.faculty_name AS faculty,
                COUNT(DISTINCT ds.student_id) AS student_count
            FROM dim_student ds
            JOIN dim_program dp ON ds.program_id = dp.program_id
            JOIN dim_department ddept ON dp.department_id = ddept.department_id
            JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
            LEFT JOIN fact_enrollment fe ON ds.student_id = fe.student_id
            {where_clause}
            GROUP BY df.faculty_name
            ORDER BY student_count DESC
            """
        elif group_by == 'program':
            query = f"""
            SELECT 
                dp.program_name AS program,
                COUNT(DISTINCT ds.student_id) AS student_count
            FROM dim_student ds
            JOIN dim_program dp ON ds.program_id = dp.program_id
            JOIN dim_department ddept ON dp.department_id = ddept.department_id
            JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
            LEFT JOIN fact_enrollment fe ON ds.student_id = fe.student_id
            {where_clause}
            GROUP BY dp.program_name
            ORDER BY student_count DESC
            """
        elif group_by == 'course':
            query = f"""
            SELECT 
                COALESCE(dc.course_name, fe.course_code) AS course,
                COUNT(DISTINCT ds.student_id) AS student_count
            FROM dim_student ds
            JOIN dim_program dp ON ds.program_id = dp.program_id
            JOIN dim_department ddept ON dp.department_id = ddept.department_id
            JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
            JOIN fact_enrollment fe ON ds.student_id = fe.student_id
            LEFT JOIN dim_course dc ON fe.course_code = dc.course_code
            {where_clause}
            GROUP BY COALESCE(dc.course_name, fe.course_code)
            ORDER BY student_count DESC
            """
        elif group_by == 'year_of_study':
            query = f"""
            WITH scoped AS (
                SELECT DISTINCT
                    ds.student_id,
                    ds.year_of_study,
                    ds.status,
                    dp.program_name,
                    dp.degree_level,
                    dp.duration_years,
                    CASE
                        WHEN LOWER(COALESCE(dp.program_name, '')) LIKE '%medicine%' OR LOWER(COALESCE(dp.program_name, '')) LIKE '%dentistry%' THEN 5
                        WHEN LOWER(COALESCE(dp.program_name, '')) LIKE '%bachelor of law%' OR LOWER(COALESCE(dp.program_name, '')) LIKE '%bachelor of laws%' THEN 4
                        WHEN LOWER(COALESCE(dp.program_name, '')) LIKE '%engineering%' THEN 4
                        WHEN LOWER(COALESCE(dp.program_name, '')) LIKE '%nursing%' THEN 4
                        WHEN LOWER(COALESCE(dp.degree_level, '')) LIKE '%diploma%' OR LOWER(COALESCE(dp.program_name, '')) LIKE 'diploma%' THEN 2
                        WHEN LOWER(COALESCE(dp.degree_level, '')) LIKE '%master%' OR LOWER(COALESCE(dp.program_name, '')) LIKE '%master%' THEN 2
                        WHEN LOWER(COALESCE(dp.degree_level, '')) LIKE '%phd%' OR LOWER(COALESCE(dp.program_name, '')) LIKE '%phd%' OR LOWER(COALESCE(dp.program_name, '')) LIKE '%doctor of philosophy%' THEN 3
                        WHEN dp.duration_years IS NOT NULL AND dp.duration_years > 0 THEN dp.duration_years
                        ELSE 3
                    END AS expected_duration,
                    CASE
                        WHEN EXISTS (
                            SELECT 1
                            FROM fact_grade fgx
                            WHERE fgx.student_id = ds.student_id
                              AND fgx.semester_id = 1
                              AND COALESCE(ds.year_of_study, 1) >= 4
                              AND (fgx.exam_status IN ('FCW', 'MEX', 'FEX'))
                        ) THEN 1 ELSE 0
                    END AS has_sem1_retake_signal
                FROM dim_student ds
                JOIN dim_program dp ON ds.program_id = dp.program_id
                JOIN dim_department ddept ON dp.department_id = ddept.department_id
                JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
                LEFT JOIN fact_enrollment fe ON ds.student_id = fe.student_id
                {where_clause}
            ),
            effective AS (
                SELECT
                    student_id,
                    CASE
                        -- Default 3-year programs ONLY (exclude explicit 5y, 4y, diplomas, masters, PhD)
                        WHEN expected_duration = 3
                             AND (degree_level IS NULL OR LOWER(degree_level) NOT LIKE '%phd%')
                             AND LOWER(COALESCE(program_name, '')) NOT LIKE '%medicine%'
                             AND LOWER(COALESCE(program_name, '')) NOT LIKE '%dentistry%'
                             AND LOWER(COALESCE(program_name, '')) NOT LIKE '%engineering%'
                             AND LOWER(COALESCE(program_name, '')) NOT LIKE '%nursing%'
                             AND LOWER(COALESCE(program_name, '')) NOT LIKE 'diploma%%'
                             AND LOWER(COALESCE(degree_level, '')) NOT LIKE '%diploma%'
                             AND LOWER(COALESCE(degree_level, '')) NOT LIKE '%master%'
                             AND LOWER(COALESCE(program_name, '')) NOT LIKE '%master%'
                             AND LOWER(COALESCE(degree_level, '')) NOT LIKE '%phd%'
                             AND LOWER(COALESCE(program_name, '')) NOT LIKE '%doctor of philosophy%'
                             AND LOWER(COALESCE(status, '')) LIKE 'graduat%%'
                             AND has_sem1_retake_signal = 0
                            THEN NULL
                        WHEN expected_duration = 3
                             AND (degree_level IS NULL OR LOWER(degree_level) NOT LIKE '%phd%')
                             AND LOWER(COALESCE(program_name, '')) NOT LIKE '%medicine%'
                             AND LOWER(COALESCE(program_name, '')) NOT LIKE '%dentistry%'
                             AND LOWER(COALESCE(program_name, '')) NOT LIKE '%engineering%'
                             AND LOWER(COALESCE(program_name, '')) NOT LIKE '%nursing%'
                             AND LOWER(COALESCE(program_name, '')) NOT LIKE 'diploma%%'
                             AND LOWER(COALESCE(degree_level, '')) NOT LIKE '%diploma%'
                             AND LOWER(COALESCE(degree_level, '')) NOT LIKE '%master%'
                             AND LOWER(COALESCE(program_name, '')) NOT LIKE '%master%'
                             AND LOWER(COALESCE(degree_level, '')) NOT LIKE '%phd%'
                             AND LOWER(COALESCE(program_name, '')) NOT LIKE '%doctor of philosophy%'
                             AND has_sem1_retake_signal = 1
                            THEN 3
                        ELSE LEAST(COALESCE(year_of_study, 1), expected_duration)
                    END AS effective_year
                FROM scoped
            )
            SELECT
                effective_year AS year_of_study,
                COUNT(DISTINCT student_id) AS student_count
            FROM effective
            WHERE effective_year IS NOT NULL
            GROUP BY effective_year
            ORDER BY effective_year ASC
            """
        else:
            query = f"""
            SELECT 
                ddept.department_name AS department,
                df.faculty_name AS faculty,
                COUNT(DISTINCT ds.student_id) AS student_count
            FROM dim_student ds
            JOIN dim_program dp ON ds.program_id = dp.program_id
            JOIN dim_department ddept ON dp.department_id = ddept.department_id
            JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
            LEFT JOIN fact_enrollment fe ON ds.student_id = fe.student_id
            {where_clause}
            GROUP BY ddept.department_name, df.faculty_name
            ORDER BY student_count DESC
            """

        df_res = pd.read_sql_query(text(query), engine)

        labels = []
        if group_by == 'faculty':
            labels = df_res['faculty'].tolist()
        elif group_by == 'program':
            labels = df_res['program'].tolist()
        elif group_by == 'course':
            labels = df_res['course'].tolist()
        elif group_by == 'year_of_study':
            labels = [f"Year {int(y)}" if pd.notna(y) else "Year 1" for y in df_res['year_of_study'].tolist()]
        else:
            labels = df_res['department'].tolist()

        response = {
            'labels': labels,
            'counts': df_res['student_count'].tolist(),
            'group_by': group_by,
        }

        if group_by == 'department':
            response['departments'] = df_res['department'].tolist()
            response['faculties'] = df_res['faculty'].tolist()
        elif group_by == 'faculty':
            response['faculties'] = df_res['faculty'].tolist()
        elif group_by == 'program':
            response['programs'] = df_res['program'].tolist()
        elif group_by == 'course':
            response['courses'] = df_res['course'].tolist()
        elif group_by == 'year_of_study':
            response['years_of_study'] = labels

        resp = jsonify(response)
        try:
            if ck:
                _cache_set_json(ck, resp.get_data(as_text=True), ttl_seconds=20)
                resp.headers["X-Cache"] = "MISS"
        except Exception:
            pass
        return resp
    except Exception as e:
        print(f"Error in get_students_by_department: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/grades-over-time', methods=['GET'])
@jwt_required()
def get_grades_over_time():
    try:
        from flask_jwt_extended import get_jwt
        from rbac import Role
        
        claims = get_jwt()
        role_str = claims.get('role', 'student')
        try:
            role = Role(role_str.lower())
        except:
            role = Role.STUDENT
        
        engine = get_dw_engine()
        filters = request.args.to_dict()

        try:
            ck = _cache_key("grades_over_time", claims=claims, params=filters)
            cached = _cache_get_json(ck)
            if cached:
                resp = make_response(cached, 200)
                resp.headers["Content-Type"] = "application/json"
                resp.headers["X-Cache"] = "HIT"
                return resp
        except Exception:
            ck = None
        
        where_clauses = []
        
        if role == Role.STAFF and claims.get('department_id'):
            where_clauses.append(f"ddept.department_id = {claims['department_id']}")
        elif role == Role.STAFF and filters.get('program_id'):
            where_clauses.append(f"ds.program_id = {filters['program_id']}")
        elif role == Role.HOD and claims.get('department_id'):
            where_clauses.append(f"ddept.department_id = {claims['department_id']}")
        elif role == Role.DEAN and claims.get('faculty_id'):
            where_clauses.append(f"df.faculty_id = {claims['faculty_id']}")
        elif role == Role.STUDENT:
            if claims.get('student_id'):
                where_clauses.append(f"ds.student_id = '{claims['student_id']}'")
            elif claims.get('access_number'):
                where_clauses.append(f"ds.access_number = '{claims['access_number']}'")
        
        if filters.get('faculty_id') and str(filters['faculty_id']).strip() and str(filters['faculty_id']).lower() != 'all':
            where_clauses.append(f"df.faculty_id = {filters['faculty_id']}")
        if filters.get('department_id') and str(filters['department_id']).strip() and str(filters['department_id']).lower() != 'all':
            where_clauses.append(f"ddept.department_id = {filters['department_id']}")
        if filters.get('program_id') and str(filters['program_id']).strip() and str(filters['program_id']).lower() != 'all':
            where_clauses.append(f"ds.program_id = {filters['program_id']}")
        if filters.get('semester_id') and str(filters['semester_id']).strip() and str(filters['semester_id']).lower() != 'all':
            where_clauses.append(f"fg.semester_id = {filters['semester_id']}")
        if filters.get('high_school') and str(filters.get('high_school')).strip().lower() not in ('', 'all'):
            hs = str(filters.get('high_school')).replace("'", "''")
            where_clauses.append(f"ds.high_school ILIKE '%{hs}%'")
        if filters.get('intake_year') and str(filters.get('intake_year')).strip().lower() not in ('', 'all'):
            try:
                where_clauses.append(f"EXTRACT(YEAR FROM ds.admission_date) = {int(filters['intake_year'])}")
            except Exception:
                pass
        if filters.get('course_code') and str(filters.get('course_code')).strip().lower() not in ('', 'all'):
            cc = str(filters.get('course_code')).replace("'", "''")
            where_clauses.append(f"fg.course_code = '{cc}'")
        period = (filters.get('period') or 'quarterly').strip().lower()
        if period not in ('monthly', 'quarterly', 'yearly'):
            period = 'quarterly'

        where_clause = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        join_clause = ""
        needs_join = (role in [Role.HOD, Role.DEAN, Role.STAFF] or
                     (filters.get('faculty_id') and str(filters['faculty_id']).strip() and str(filters['faculty_id']).lower() != 'all') or
                     (filters.get('department_id') and str(filters['department_id']).strip() and str(filters['department_id']).lower() != 'all'))
        if needs_join:
            join_clause = """
            LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
            LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
            LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
            """
        if period == 'monthly':
            period_select = "CONCAT(dt.month_name, ' ', CAST(dt.year AS CHAR))"
            group_by = "dt.year, dt.month, dt.month_name"
            order_by = "dt.year ASC, dt.month ASC"
        elif period == 'yearly':
            period_select = "CAST(dt.year AS CHAR)"
            group_by = "dt.year"
            order_by = "dt.year ASC"
        else:
            period_select = "CONCAT('Q', CAST(dt.quarter AS CHAR), ' ', CAST(dt.year AS CHAR))"
            group_by = "dt.year, dt.quarter"
            order_by = "dt.year ASC, dt.quarter ASC"

        _cmp = _sql_exam_completed_predicate('fg')
        query = f"""
        SELECT
            {period_select} as period,
            AVG(CASE WHEN {_cmp} THEN fg.grade ELSE NULL END) as avg_grade,
            COUNT(CASE WHEN {_cmp} THEN 1 END) as completed_exams,
            COUNT(CASE WHEN UPPER(TRIM(COALESCE(fg.exam_status, ''))) = 'MEX' THEN 1 END) as missed_exams,
            COUNT(CASE WHEN UPPER(TRIM(COALESCE(fg.exam_status, ''))) = 'FEX' THEN 1 END) as failed_exams,
            COUNT(DISTINCT fg.student_id) as total_students,
            COUNT(DISTINCT fg.course_code) as total_courses
        FROM fact_grade fg
        INNER JOIN dim_time dt ON fg.date_key = dt.date_key
        INNER JOIN dim_student ds ON fg.student_id = ds.student_id
        {join_clause}
        {where_clause}
        GROUP BY {group_by}
        HAVING COUNT(CASE WHEN {_cmp} THEN 1 END) > 0
        ORDER BY {order_by}
        """
        
        df = pd.read_sql_query(text(query), engine)
        
        if not df.empty:
            df['total_exams'] = df['completed_exams'] + df['missed_exams'] + df['failed_exams']
            df['pass_rate'] = (df['completed_exams'] / df['total_exams'] * 100).round(2)
            df['pass_rate'] = df['pass_rate'].fillna(0)
            
            result = {
                'periods': df['period'].tolist(),
                'grades': df['avg_grade'].round(2).tolist(),
                'missed_exams': df['missed_exams'].tolist(),
                'failed_exams': df['failed_exams'].tolist(),
                'completed_exams': df['completed_exams'].tolist(),
                'total_students': df['total_students'].tolist(),
                'total_courses': df['total_courses'].tolist(),
                'pass_rate': df['pass_rate'].tolist()
            }
            resp = jsonify(result)
            try:
                if ck:
                    _cache_set_json(ck, resp.get_data(as_text=True), ttl_seconds=20)
                    resp.headers["X-Cache"] = "MISS"
            except Exception:
                pass
            return resp
        else:
            resp = jsonify({
                'periods': [],
                'grades': [],
                'missed_exams': [],
                'failed_exams': [],
                'completed_exams': [],
                'total_students': [],
                'total_courses': [],
                'pass_rate': []
            })
            try:
                if ck:
                    _cache_set_json(ck, resp.get_data(as_text=True), ttl_seconds=20)
                    resp.headers["X-Cache"] = "MISS"
            except Exception:
                pass
            return resp
    except Exception as e:
        print(f"Error in get_grades_over_time: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/payment-status', methods=['GET'])
@jwt_required()
def get_payment_status():
    try:
        from flask_jwt_extended import get_jwt
        from rbac import Role
        
        claims = get_jwt()
        role_str = claims.get('role', 'student')
        try:
            role = Role(role_str.lower())
        except:
            role = Role.STUDENT
        
        engine = get_dw_engine()
        filters = request.args.to_dict()
        
        where_clauses = []
        
        if role == Role.DEAN and claims.get('faculty_id'):
            where_clauses.append(f"df.faculty_id = {claims['faculty_id']}")
        elif role == Role.HOD and claims.get('department_id'):
            where_clauses.append(f"ddept.department_id = {claims['department_id']}")
        elif role == Role.STAFF and claims.get('department_id'):
            where_clauses.append(f"ddept.department_id = {claims['department_id']}")
        elif role == Role.STUDENT:
            if claims.get('student_id'):
                where_clauses.append(f"fp.student_id = '{claims['student_id']}'")
            elif claims.get('access_number'):
                where_clauses.append(f"ds.access_number = '{claims['access_number']}'")

        if filters.get('faculty_id') and str(filters.get('faculty_id')).strip().lower() not in ('', 'all'):
            where_clauses.append(f"df.faculty_id = {filters['faculty_id']}")
        if filters.get('department_id') and str(filters.get('department_id')).strip().lower() not in ('', 'all'):
            where_clauses.append(f"ddept.department_id = {filters['department_id']}")
        if filters.get('program_id') and str(filters.get('program_id')).strip().lower() not in ('', 'all'):
            where_clauses.append(f"ds.program_id = {filters['program_id']}")
        if filters.get('semester_id') and str(filters.get('semester_id')).strip().lower() not in ('', 'all'):
            where_clauses.append(f"fp.semester_id = {filters['semester_id']}")
        if filters.get('high_school') and str(filters.get('high_school')).strip().lower() not in ('', 'all'):
            hs = str(filters.get('high_school')).replace("'", "''")
            where_clauses.append(f"ds.high_school ILIKE '%{hs}%'")
        if filters.get('intake_year') and str(filters.get('intake_year')).strip().lower() not in ('', 'all'):
            try:
                where_clauses.append(f"EXTRACT(YEAR FROM ds.admission_date) = {int(filters['intake_year'])}")
            except Exception:
                pass
        if filters.get('course_code') and str(filters.get('course_code')).strip().lower() not in ('', 'all'):
            cc = str(filters.get('course_code')).replace("'", "''")
            where_clauses.append(
                f"EXISTS (SELECT 1 FROM fact_enrollment fe "
                f"WHERE fe.student_id = ds.student_id AND fe.course_code = '{cc}' AND fe.semester_id = fp.semester_id)"
            )

        where_clause = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        needs_ds_dim = (
            role in [Role.DEAN, Role.HOD, Role.STAFF, Role.STUDENT] or
            (filters.get('faculty_id') and str(filters.get('faculty_id')).strip().lower() not in ('', 'all')) or
            (filters.get('department_id') and str(filters.get('department_id')).strip().lower() not in ('', 'all')) or
            (filters.get('program_id') and str(filters.get('program_id')).strip().lower() not in ('', 'all')) or
            (filters.get('high_school') and str(filters.get('high_school')).strip().lower() not in ('', 'all')) or
            (filters.get('intake_year') and str(filters.get('intake_year')).strip().lower() not in ('', 'all')) or
            (filters.get('course_code') and str(filters.get('course_code')).strip().lower() not in ('', 'all'))
        )
        join_clause = ""
        if needs_ds_dim:
            join_clause = """
            LEFT JOIN LATERAL (
                SELECT ds.*
                FROM dim_student ds
                WHERE ds.student_id = fp.student_id
                   OR ds.reg_no = fp.student_id
                   OR ds.access_number = fp.student_id
                ORDER BY
                    CASE
                        WHEN ds.student_id = fp.student_id THEN 1
                        WHEN ds.reg_no = fp.student_id THEN 2
                        WHEN ds.access_number = fp.student_id THEN 3
                        ELSE 4
                    END
                LIMIT 1
            ) ds ON TRUE
            LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
            LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
            LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
            """
        
        query = f"""
        SELECT 
            fp.status,
            COUNT(*) as count
        FROM fact_payment fp
        {join_clause}
        {where_clause}
        GROUP BY fp.status
        """
        
        df = pd.read_sql_query(text(query), engine)
        
        resp = jsonify({
            'statuses': df['status'].tolist(),
            'counts': df['count'].tolist()
        })
        try:
            if ck:
                _cache_set_json(ck, resp.get_data(as_text=True), ttl_seconds=20)
                resp.headers["X-Cache"] = "MISS"
        except Exception:
            pass
        return resp
    except Exception as e:
        print(f"Error in get_payment_status: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/outstanding-by-faculty-program', methods=['GET'])
@jwt_required()
def get_outstanding_by_faculty_program():
    try:
        from flask_jwt_extended import get_jwt

        claims = get_jwt()
        filters = request.args.to_dict()
        engine = get_dw_engine()

        raw_limit = filters.get('limit', None)
        try:
            limit = int(raw_limit) if raw_limit is not None else 15
        except Exception:
            limit = 15
        limit = max(5, min(limit, 25))

        semester_id_filter = filters.get('semester_id', None)
        if semester_id_filter and str(semester_id_filter).strip().lower() in ('all', ''):
            semester_id_filter = None

        _, role_where = _dashboard_role_scope()

        join_clause = """
        JOIN dim_student ds ON fp.student_id = ds.student_id
        JOIN dim_program dp ON ds.program_id = dp.program_id
        JOIN dim_department ddept ON dp.department_id = ddept.department_id
        JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        """

        where_clauses = ["fp.status IN ('Pending','FAILED')"]
        if role_where:
            where_clauses.append(f"({role_where})")

        if filters.get('faculty_id') and str(filters['faculty_id']).strip().lower() not in ('', 'all'):
            where_clauses.append(f"df.faculty_id = {int(filters['faculty_id'])}")
        if filters.get('department_id') and str(filters['department_id']).strip().lower() not in ('', 'all'):
            where_clauses.append(f"ddept.department_id = {int(filters['department_id'])}")
        if filters.get('program_id') and str(filters['program_id']).strip().lower() not in ('', 'all'):
            where_clauses.append(f"dp.program_id = {int(filters['program_id'])}")

        if semester_id_filter is not None:
            latest_sem = int(semester_id_filter)
        else:
            latest_where = " AND ".join(where_clauses + ["fp.semester_id IS NOT NULL"])
            latest_sql = f"""
            SELECT MAX(fp.semester_id) AS sem
            FROM fact_payment fp
            {join_clause}
            WHERE {latest_where}
            """
            latest_df = pd.read_sql_query(text(latest_sql), engine)
            latest_sem = int(latest_df['sem'].iloc[0]) if not latest_df.empty and pd.notna(latest_df['sem'].iloc[0]) else None

        if latest_sem is None:
            return jsonify({'outstanding_by_faculty_program': []}), 200

        where_clauses.append(f"fp.semester_id = {latest_sem}")

        breakdown = _finance_chart_breakdown(filters)
        if breakdown == 'faculty':
            name_expr = "COALESCE(df.faculty_name, 'Unknown') AS name"
            group_by = "df.faculty_name"
        elif breakdown == 'department':
            name_expr = "COALESCE(ddept.department_name, 'Unknown') AS name"
            group_by = "ddept.department_name"
        else:
            name_expr = "COALESCE(dp.program_name, 'Unknown') AS name"
            group_by = "dp.program_name"

        query = f"""
        SELECT
            {name_expr},
            SUM(fp.amount) AS value
        FROM fact_payment fp
        {join_clause}
        WHERE {' AND '.join(where_clauses)}
        GROUP BY {group_by}
        ORDER BY value DESC
        LIMIT {limit}
        """

        df = pd.read_sql_query(text(query), engine)

        return jsonify({
            'outstanding_by_faculty_program': df.to_dict('records'),
            'semester_id': latest_sem,
            'breakdown': breakdown,
        }), 200
    except Exception as e:
        print(f"Error in get_outstanding_by_faculty_program: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/high-risk-debt-segments', methods=['GET'])
@jwt_required()
def get_high_risk_debt_segments():
    try:
        from flask_jwt_extended import get_jwt

        claims = get_jwt()
        filters = request.args.to_dict()
        engine = get_dw_engine()

        raw_limit = filters.get('limit', None)
        try:
            limit = int(raw_limit) if raw_limit is not None else 10
        except Exception:
            limit = 10
        limit = max(5, min(limit, 20))

        semester_id_filter = filters.get('semester_id', None)
        if semester_id_filter and str(semester_id_filter).strip().lower() in ('', 'all'):
            semester_id_filter = None

        _, role_where = _dashboard_role_scope()

        base_join = """
        JOIN dim_student ds ON fp.student_id = ds.student_id
        JOIN dim_program dp ON ds.program_id = dp.program_id
        JOIN dim_department ddept ON dp.department_id = ddept.department_id
        JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        """

        where_clauses = ["fp.status IN ('Pending','FAILED')"]
        if role_where:
            where_clauses.append(f"({role_where})")

        if filters.get('faculty_id') and str(filters['faculty_id']).strip().lower() not in ('', 'all'):
            where_clauses.append(f"df.faculty_id = {int(filters['faculty_id'])}")
        if filters.get('department_id') and str(filters['department_id']).strip().lower() not in ('', 'all'):
            where_clauses.append(f"ddept.department_id = {int(filters['department_id'])}")
        if filters.get('program_id') and str(filters['program_id']).strip().lower() not in ('', 'all'):
            where_clauses.append(f"dp.program_id = {int(filters['program_id'])}")

        if filters.get('intake_year') and str(filters['intake_year']).strip().lower() not in ('', 'all'):
            where_clauses.append(
                f"EXTRACT(YEAR FROM CAST(ds.admission_date AS DATE)) = {int(filters['intake_year'])}"
            )

        if semester_id_filter is not None:
            latest_sem = int(semester_id_filter)
        else:
            latest_where = " AND ".join(where_clauses + ["fp.semester_id IS NOT NULL"])
            latest_sql = f"""
            SELECT MAX(fp.semester_id) AS sem
            FROM fact_payment fp
            {base_join}
            WHERE {latest_where}
            """
            latest_df = pd.read_sql_query(text(latest_sql), engine)
            latest_sem = int(latest_df['sem'].iloc[0]) if not latest_df.empty and pd.notna(latest_df['sem'].iloc[0]) else None

        if latest_sem is None:
            return jsonify({'high_risk_debt_segments': [], 'semester_id': None}), 200

        where_clauses.append(f"fp.semester_id = {latest_sem}")

        breakdown = _finance_chart_breakdown(filters)
        if breakdown == 'faculty':
            seg_expr = "COALESCE(df.faculty_name, 'Unknown') AS segment"
            group_by = "df.faculty_name"
        elif breakdown == 'department':
            seg_expr = "COALESCE(ddept.department_name, 'Unknown') AS segment"
            group_by = "ddept.department_name"
        else:
            seg_expr = "COALESCE(dp.program_name, 'Unknown') AS segment"
            group_by = "dp.program_name"

        query = f"""
        SELECT
            {seg_expr},
            SUM(COALESCE(fp.amount, 0)) AS outstanding
        FROM fact_payment fp
        {base_join}
        WHERE {' AND '.join(where_clauses)}
        GROUP BY {group_by}
        ORDER BY outstanding DESC
        LIMIT {limit}
        """

        df = pd.read_sql_query(text(query), engine)

        return jsonify({
            'high_risk_debt_segments': df.to_dict('records'),
            'semester_id': latest_sem,
            'breakdown': breakdown,
        }), 200
    except Exception as e:
        print(f"Error in get_high_risk_debt_segments: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/attendance-by-course', methods=['GET'])
@jwt_required()
def get_attendance_by_course():
    try:
        engine = get_dw_engine()
        role_join, role_where = _dashboard_role_scope()
        scope_join = f" JOIN dim_student ds ON fa.student_id = ds.student_id {role_join} " if role_join else ""
        scope_where = f" WHERE {role_where} " if role_where else ""

        query = f"""
        SELECT 
            dc.course_name,
            AVG(fa.total_hours) as avg_hours,
            SUM(fa.days_present) as total_days
        FROM fact_attendance fa
        JOIN dim_course dc ON fa.course_code = dc.course_code
        {scope_join}
        {scope_where}
        GROUP BY dc.course_name
        ORDER BY avg_hours DESC
        LIMIT 10
        """

        df = pd.read_sql_query(text(query), engine)
        
        return jsonify({
            'courses': df['course_name'].tolist(),
            'avg_hours': df['avg_hours'].round(2).tolist(),
            'total_days': df['total_days'].tolist()
        })
    except Exception as e:
        print(f"Error in get_attendance_by_course: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/grade-distribution', methods=['GET'])
@jwt_required()
def get_grade_distribution():
    try:
        from flask_jwt_extended import get_jwt
        from rbac import Role

        claims = get_jwt()
        role_str = claims.get('role', 'student')
        try:
            role = Role(role_str.lower())
        except Exception:
            role = Role.STUDENT

        engine = get_dw_engine()
        filters = request.args.to_dict()
        role_join, role_where = _dashboard_role_scope()

        where_clauses = []
        if role == Role.STUDENT:
            student_id = claims.get('student_id')
            access_number = claims.get('access_number')
            if student_id:
                safe_id = str(student_id).replace("'", "''")
                where_clauses.append(f"ds.student_id = '{safe_id}'")
            elif access_number:
                safe_acc = str(access_number).replace("'", "''")
                where_clauses.append(f"ds.access_number = '{safe_acc}'")
            else:
                return jsonify({'grades': [], 'counts': []})
        else:
            if role_where:
                where_clauses.append(role_where)
            if filters.get('faculty_id'):
                where_clauses.append(
                    "ds.program_id IN (SELECT program_id FROM dim_program WHERE department_id IN "
                    f"(SELECT department_id FROM dim_department WHERE faculty_id = {filters['faculty_id']}))"
                )
            if filters.get('department_id'):
                where_clauses.append(
                    f"ds.program_id IN (SELECT program_id FROM dim_program WHERE department_id = {filters['department_id']})"
                )
            if filters.get('program_id'):
                where_clauses.append(f"ds.program_id = {filters['program_id']}")
            if filters.get('semester_id'):
                where_clauses.append(f"fg.semester_id = {filters['semester_id']}")
            if filters.get('high_school') and str(filters.get('high_school')).strip().lower() not in ('', 'all'):
                hs = str(filters.get('high_school')).replace("'", "''")
                where_clauses.append(f"ds.high_school ILIKE '%{hs}%'")
            if filters.get('intake_year') and str(filters.get('intake_year')).strip().lower() not in ('', 'all'):
                try:
                    where_clauses.append(f"EXTRACT(YEAR FROM ds.admission_date) = {int(filters['intake_year'])}")
                except Exception:
                    pass
            if filters.get('course_code') and str(filters.get('course_code')).strip().lower() not in ('', 'all'):
                cc = str(filters.get('course_code')).replace("'", "''")
                where_clauses.append(f"fg.course_code = '{cc}'")

        where_clauses.append(_sql_exam_completed_predicate('fg'))
        where_clause = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        query = f"""
        SELECT 
            COALESCE(NULLIF(TRIM(fg.letter_grade::text), ''), '—') AS letter_grade,
            COUNT(*) as count
        FROM fact_grade fg
        JOIN dim_student ds ON fg.student_id = ds.student_id
        {role_join}
        {where_clause}
        GROUP BY COALESCE(NULLIF(TRIM(fg.letter_grade::text), ''), '—')
        ORDER BY 
            MIN(CASE COALESCE(NULLIF(TRIM(fg.letter_grade::text), ''), '—')
                WHEN 'A' THEN 1
                WHEN 'B+' THEN 2
                WHEN 'B' THEN 3
                WHEN 'C+' THEN 4
                WHEN 'C' THEN 5
                WHEN 'D+' THEN 6
                WHEN 'D' THEN 7
                WHEN 'F' THEN 8
                WHEN '—' THEN 9
                ELSE 10
            END)
        """
        
        df = pd.read_sql_query(text(query), engine)
        
        return jsonify({
            'grades': df['letter_grade'].tolist(),
            'counts': df['count'].tolist()
        })
    except Exception as e:
        print(f"Error in get_grade_distribution: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/grade-performance-breakdown', methods=['GET'])
@jwt_required()
def get_grade_performance_breakdown():
    try:
        from flask_jwt_extended import get_jwt
        from rbac import Role

        claims = get_jwt()
        role_str = claims.get('role', 'student')
        try:
            role = Role(role_str.lower())
        except Exception:
            role = Role.STUDENT

        engine = get_dw_engine()
        filters = request.args.to_dict()
        role_join, role_where = _dashboard_role_scope()

        gb = (filters.get('group_by') or 'faculty').strip().lower()
        if gb not in ('faculty', 'department', 'program', 'year_of_study'):
            gb = 'faculty'

        where_clauses = []
        if role == Role.STUDENT:
            student_id = claims.get('student_id')
            access_number = claims.get('access_number')
            if student_id:
                safe_id = str(student_id).replace("'", "''")
                where_clauses.append(f"ds.student_id = '{safe_id}'")
            elif access_number:
                safe_acc = str(access_number).replace("'", "''")
                where_clauses.append(f"ds.access_number = '{safe_acc}'")
            else:
                return jsonify({
                    'grades': [], 'counts': [], 'segment_axis': gb,
                    'segments': [],
                    'summary': {'total_exams': 0, 'pass_count': 0, 'fail_count': 0, 'pass_rate_pct': 0.0},
                })
        else:
            if role_where:
                where_clauses.append(role_where)
            if filters.get('faculty_id'):
                where_clauses.append(
                    "ds.program_id IN (SELECT program_id FROM dim_program WHERE department_id IN "
                    f"(SELECT department_id FROM dim_department WHERE faculty_id = {filters['faculty_id']}))"
                )
            if filters.get('department_id'):
                where_clauses.append(
                    f"ds.program_id IN (SELECT program_id FROM dim_program WHERE department_id = {filters['department_id']})"
                )
            if filters.get('program_id'):
                where_clauses.append(f"ds.program_id = {filters['program_id']}")
            if filters.get('semester_id'):
                where_clauses.append(f"fg.semester_id = {filters['semester_id']}")
            if filters.get('high_school') and str(filters.get('high_school')).strip().lower() not in ('', 'all'):
                hs = str(filters.get('high_school')).replace("'", "''")
                where_clauses.append(f"ds.high_school ILIKE '%{hs}%'")
            if filters.get('intake_year') and str(filters.get('intake_year')).strip().lower() not in ('', 'all'):
                try:
                    where_clauses.append(f"EXTRACT(YEAR FROM ds.admission_date) = {int(filters['intake_year'])}")
                except Exception:
                    pass
            if filters.get('course_code') and str(filters.get('course_code')).strip().lower() not in ('', 'all'):
                cc = str(filters.get('course_code')).replace("'", "''")
                where_clauses.append(f"fg.course_code = '{cc}'")

        where_clauses.append(_sql_grade_has_outcome_for_analytics('fg'))
        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        join_tail = str(role_join).strip() or (
            "LEFT JOIN dim_program dp ON ds.program_id = dp.program_id "
            "LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id "
            "LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id"
        )

        fail_case = (
            "CASE WHEN UPPER(TRIM(COALESCE(fg.letter_grade, ''))) = 'F' THEN 1 "
            "WHEN NULLIF(TRIM(fg.letter_grade::text), '') IS NULL AND fg.grade IS NOT NULL AND fg.grade < 50 THEN 1 "
            "ELSE 0 END"
        )
        pass_case = (
            "CASE WHEN UPPER(TRIM(COALESCE(fg.letter_grade, ''))) = 'F' THEN 0 "
            "WHEN NULLIF(TRIM(fg.letter_grade::text), '') IS NOT NULL THEN 1 "
            "WHEN fg.grade IS NOT NULL AND fg.grade >= 50 THEN 1 ELSE 0 END"
        )

        dist_q = f"""
        SELECT
            COALESCE(NULLIF(TRIM(fg.letter_grade::text), ''), '—') AS letter_grade,
            COUNT(*) as count
        FROM fact_grade fg
        JOIN dim_student ds ON fg.student_id = ds.student_id
        {role_join}
        {where_sql}
        GROUP BY COALESCE(NULLIF(TRIM(fg.letter_grade::text), ''), '—')
        ORDER BY
            MIN(CASE COALESCE(NULLIF(TRIM(fg.letter_grade::text), ''), '—')
                WHEN 'A' THEN 1 WHEN 'B+' THEN 2 WHEN 'B' THEN 3 WHEN 'C+' THEN 4
                WHEN 'C' THEN 5 WHEN 'D+' THEN 6 WHEN 'D' THEN 7 WHEN 'F' THEN 8
                WHEN '—' THEN 9 ELSE 10 END)
        """
        dist_df = pd.read_sql_query(text(dist_q), engine)

        summary = {'total_exams': 0, 'pass_count': 0, 'fail_count': 0, 'pass_rate_pct': 0.0}
        try:
            sum_q = f"""
            SELECT
                COUNT(*)::bigint AS total_exams,
                COALESCE(SUM({pass_case}), 0)::bigint AS pass_n,
                COALESCE(SUM({fail_case}), 0)::bigint AS fail_n
            FROM fact_grade fg
            JOIN dim_student ds ON fg.student_id = ds.student_id
            {role_join}
            {where_sql}
            """
            sdf = pd.read_sql_query(text(sum_q), engine)
            if not sdf.empty:
                te = int(sdf['total_exams'].iloc[0] or 0)
                pn = int(sdf['pass_n'].iloc[0] or 0)
                fn = int(sdf['fail_n'].iloc[0] or 0)
                summary = {
                    'total_exams': te,
                    'pass_count': pn,
                    'fail_count': fn,
                    'pass_rate_pct': round(100.0 * pn / te, 1) if te > 0 else 0.0,
                }
        except Exception as ex:
            print(f"grade_performance_breakdown summary: {ex}")

        segments = []
        if role == Role.STUDENT:
            seg_q = f"""
            SELECT
                'Your record' AS segment_name,
                SUM({fail_case})::bigint AS fail_count,
                SUM({pass_case})::bigint AS pass_count
            FROM fact_grade fg
            JOIN dim_student ds ON fg.student_id = ds.student_id
            {where_sql}
            """
            seg_df = pd.read_sql_query(text(seg_q), engine)
            if not seg_df.empty:
                r = seg_df.iloc[0]
                fc = int(r['fail_count'] or 0)
                pc = int(r['pass_count'] or 0)
                tot = fc + pc
                pr = round(100.0 * pc / tot, 1) if tot > 0 else 0.0
                segments.append({
                    'name': 'Your record',
                    'full_name': 'Your record',
                    'pass': pc,
                    'fail': fc,
                    'total': tot,
                    'pass_rate': pr,
                })
        else:
            if gb == 'department':
                seg_expr = "COALESCE(ddept.department_name, 'Unknown')"
                group_sql = "ddept.department_id, ddept.department_name"
            elif gb == 'program':
                seg_expr = "COALESCE(dp.program_name, 'Unknown')"
                group_sql = "dp.program_id, dp.program_name"
            elif gb == 'year_of_study':
                seg_expr = "COALESCE('Year ' || NULLIF(ds.year_of_study::text, ''), 'Unknown')"
                group_sql = "ds.year_of_study"
            else:
                seg_expr = "COALESCE(df.faculty_name, 'Unknown')"
                group_sql = "df.faculty_id, df.faculty_name"

            seg_q = f"""
            SELECT
                {seg_expr} AS segment_name,
                SUM({fail_case})::bigint AS fail_count,
                SUM({pass_case})::bigint AS pass_count
            FROM fact_grade fg
            JOIN dim_student ds ON fg.student_id = ds.student_id
            {join_tail}
            {where_sql}
            GROUP BY {group_sql}
            HAVING COUNT(*) > 0
            ORDER BY SUM({pass_case}) + SUM({fail_case}) DESC
            LIMIT 16
            """
            seg_df = pd.read_sql_query(text(seg_q), engine)
            for _, r in seg_df.iterrows():
                fc = int(r['fail_count'] or 0)
                pc = int(r['pass_count'] or 0)
                tot = fc + pc
                nm = str(r['segment_name'] or 'Unknown').strip() or 'Unknown'
                pr = round(100.0 * pc / tot, 1) if tot > 0 else 0.0
                segments.append({
                    'name': nm,
                    'full_name': nm,
                    'pass': pc,
                    'fail': fc,
                    'total': tot,
                    'pass_rate': pr,
                })

        return jsonify({
            'grades': dist_df['letter_grade'].tolist() if not dist_df.empty else [],
            'counts': dist_df['count'].astype(int).tolist() if not dist_df.empty else [],
            'segment_axis': gb,
            'segments': segments,
            'summary': summary,
        })
    except Exception as e:
        print(f"Error in get_grade_performance_breakdown: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'grades': [],
            'counts': [],
            'segment_axis': 'faculty',
            'segments': [],
            'summary': {'total_exams': 0, 'pass_count': 0, 'fail_count': 0, 'pass_rate_pct': 0.0},
            'error': str(e),
        }), 500

@app.route('/api/dashboard/top-students', methods=['GET'])
@jwt_required()
def get_top_students_filtered():
    try:
        from flask_jwt_extended import get_jwt
        from rbac import Role

        claims = get_jwt()
        role_str = (claims.get('role') or 'student').strip().lower()
        try:
            role = Role(role_str)
        except Exception:
            role = Role.STUDENT

        allowed = {
            Role.SENATE, Role.ANALYST, Role.SYSADMIN, Role.DEAN, Role.HOD, Role.STAFF,
        }
        if role not in allowed:
            return jsonify({'students': [], 'grades': [], 'error': 'Forbidden'}), 403

        engine = get_dw_engine()
        qf = request.args.to_dict()

        try:
            limit = int(qf.get('limit', 10))
        except Exception:
            limit = 10
        limit = max(5, min(limit, 50))

        def _int_param(key):
            v = qf.get(key)
            if v is None or str(v).strip().lower() in ('', 'all'):
                return None
            try:
                return int(v)
            except Exception:
                return None

        fi = _int_param('faculty_id')
        di = _int_param('department_id')
        pi = _int_param('program_id')
        semester_id = _int_param('semester_id')

        where_clauses = [
            _sql_grade_has_outcome_for_analytics('fg'),
            f"({_sql_effective_grade_numeric('fg')}) IS NOT NULL",
        ]

        if role == Role.DEAN:
            fid = claims.get('faculty_id')
            if fid is None:
                return jsonify({'students': [], 'grades': []}), 200
            where_clauses.append(f"df.faculty_id = {int(fid)}")
            if di is not None:
                where_clauses.append(f"ddept.department_id = {di}")
            if pi is not None:
                where_clauses.append(f"ds.program_id = {pi}")
        elif role == Role.HOD:
            did = claims.get('department_id')
            if did is None:
                return jsonify({'students': [], 'grades': []}), 200
            where_clauses.append(f"ddept.department_id = {int(did)}")
            if pi is not None:
                where_clauses.append(f"ds.program_id = {pi}")
        elif role == Role.STAFF:
            if claims.get('department_id') is not None:
                where_clauses.append(f"ddept.department_id = {int(claims['department_id'])}")
                if pi is not None:
                    where_clauses.append(f"ds.program_id = {pi}")
            elif pi is not None:
                where_clauses.append(f"ds.program_id = {pi}")
        else:
            if fi is not None:
                where_clauses.append(f"df.faculty_id = {fi}")
            if di is not None:
                where_clauses.append(f"ddept.department_id = {di}")
            if pi is not None:
                where_clauses.append(f"ds.program_id = {pi}")

        if semester_id is not None:
            where_clauses.append(f"fg.semester_id = {semester_id}")
        iy = qf.get('intake_year')
        if iy and str(iy).strip().lower() not in ('', 'all'):
            try:
                where_clauses.append(f"EXTRACT(YEAR FROM ds.admission_date) = {int(iy)}")
            except Exception:
                pass
        hs = qf.get('high_school')
        if hs and str(hs).strip().lower() not in ('', 'all'):
            hs_esc = str(hs).replace("'", "''")
            where_clauses.append(f"ds.high_school ILIKE '%{hs_esc}%'")
        cc = qf.get('course_code')
        if cc and str(cc).strip().lower() not in ('', 'all'):
            cc_esc = str(cc).replace("'", "''")
            where_clauses.append(f"fg.course_code = '{cc_esc}'")
        yos = qf.get('year_of_study')
        if yos is not None and str(yos).strip().lower() not in ('', 'all'):
            try:
                where_clauses.append(f"COALESCE(ds.year_of_study, 0) = {int(yos)}")
            except Exception:
                pass

        dim_filters_applied = bool(
            (iy and str(iy).strip().lower() not in ('', 'all'))
            or (hs and str(hs).strip().lower() not in ('', 'all'))
            or (yos is not None and str(yos).strip().lower() not in ('', 'all'))
        )

        where_clause = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        join_clause = """
            LEFT JOIN dim_student ds ON fg.student_id = ds.student_id
            LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
            LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
            LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        """

        eff = _sql_effective_grade_numeric('fg')
        query = f"""
        SELECT 
            COALESCE(
                NULLIF(TRIM(CONCAT(COALESCE(MAX(ds.first_name::text), ''), ' ', COALESCE(MAX(ds.last_name::text), ''))), ''),
                fg.student_id::text
            ) AS student_name,
            AVG({eff}) AS avg_grade
        FROM fact_grade fg
        {join_clause}
        {where_clause}
        GROUP BY fg.student_id
        HAVING AVG({eff}) IS NOT NULL
        ORDER BY avg_grade DESC
        LIMIT {limit}
        """
        
        df = pd.read_sql_query(text(query), engine)
        if df.empty:
            use_fact_only_fallback = (
                role in (Role.SENATE, Role.ANALYST, Role.SYSADMIN)
                and fi is None
                and di is None
                and pi is None
                and not dim_filters_applied
            )
            if use_fact_only_fallback:
                eff_fb = _sql_effective_grade_numeric('fg')
                fb_where = [
                    _sql_grade_has_outcome_for_analytics('fg'),
                    f"({eff_fb}) IS NOT NULL",
                ]
                if semester_id is not None:
                    fb_where.append(f"fg.semester_id = {semester_id}")
                if cc and str(cc).strip().lower() not in ('', 'all'):
                    cc_esc = str(cc).replace("'", "''")
                    fb_where.append(f"fg.course_code = '{cc_esc}'")
                fb_sql = f"""
                SELECT fg.student_id::text AS student_name,
                       AVG({eff_fb}) AS avg_grade
                FROM fact_grade fg
                WHERE {' AND '.join(fb_where)}
                GROUP BY fg.student_id
                HAVING AVG({eff_fb}) IS NOT NULL
                ORDER BY avg_grade DESC
                LIMIT {limit}
                """
                df = pd.read_sql_query(text(fb_sql), engine)
        if df.empty:
            return jsonify({'students': [], 'grades': []}), 200

        names = []
        grades = []
        for _, row in df.iterrows():
            nm = str(row.get('student_name') or '').strip() or '—'
            ag = row.get('avg_grade')
            if pd.isna(ag):
                continue
            names.append(nm)
            grades.append(round(float(ag), 2))

        return jsonify({'students': names, 'grades': grades})
    except Exception as e:
        print(f"Error in get_top_students_filtered: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/attendance-trends', methods=['GET'])
@jwt_required()
def get_attendance_trends():
    try:
        from flask_jwt_extended import get_jwt
        from rbac import Role
        
        claims = get_jwt()
        role_str = claims.get('role', 'student')
        try:
            role = Role(role_str.lower())
        except:
            role = Role.STUDENT
        
        engine = get_dw_engine()
        filters = request.args.to_dict()
        
        where_clauses = []
        
        if role == Role.STAFF and claims.get('department_id'):
            where_clauses.append(f"ddept.department_id = {claims['department_id']}")
        elif role == Role.STAFF and filters.get('program_id'):
            where_clauses.append(f"ds.program_id = {filters['program_id']}")
        elif role == Role.HOD and claims.get('department_id'):
            where_clauses.append(f"ddept.department_id = {claims['department_id']}")
        elif role == Role.DEAN and claims.get('faculty_id'):
            where_clauses.append(f"df.faculty_id = {claims['faculty_id']}")
        elif role == Role.STUDENT:
            if claims.get('student_id'):
                where_clauses.append(f"fa.student_id = '{claims['student_id']}'")
            elif claims.get('access_number'):
                where_clauses.append(f"ds.access_number = '{claims['access_number']}'")
        
        if filters.get('faculty_id') and str(filters['faculty_id']).strip() and str(filters['faculty_id']).lower() != 'all':
            where_clauses.append(f"df.faculty_id = {filters['faculty_id']}")
        if filters.get('department_id') and str(filters['department_id']).strip() and str(filters['department_id']).lower() != 'all':
            where_clauses.append(f"ddept.department_id = {filters['department_id']}")
        if filters.get('program_id') and str(filters['program_id']).strip() and str(filters['program_id']).lower() != 'all':
            where_clauses.append(f"ds.program_id = {filters['program_id']}")
        period = (filters.get('period') or 'quarterly').strip().lower()
        if period not in ('monthly', 'quarterly', 'yearly'):
            period = 'quarterly'

        where_clause = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        join_clause = ""
        needs_join = (role in [Role.DEAN, Role.HOD, Role.STAFF, Role.STUDENT] or
                     (filters.get('faculty_id') and str(filters['faculty_id']).strip() and str(filters['faculty_id']).lower() != 'all') or
                     (filters.get('department_id') and str(filters['department_id']).strip() and str(filters['department_id']).lower() != 'all'))
        if needs_join:
            join_clause = """
            INNER JOIN dim_student ds ON fa.student_id = ds.student_id
            LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
            LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
            LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
            """
        else:
            join_clause = """
            INNER JOIN dim_student ds ON fa.student_id = ds.student_id
            """
        if period == 'monthly':
            period_select = "CONCAT(dt.month_name, ' ', CAST(dt.year AS TEXT))"
            group_by = "dt.year, dt.month, dt.month_name"
            order_by = "dt.year ASC, dt.month ASC"
        elif period == 'yearly':
            period_select = "CAST(dt.year AS TEXT)"
            group_by = "dt.year"
            order_by = "dt.year ASC"
        else:
            period_select = "CONCAT('Q', CAST(dt.quarter AS TEXT), ' ', CAST(dt.year AS TEXT))"
            group_by = "dt.year, dt.quarter"
            order_by = "dt.year ASC, dt.quarter ASC"

        query = f"""
        SELECT
            {period_select} as period,
            AVG(fa.total_hours) as avg_attendance,
            AVG(fa.days_present) as avg_days_present,
            SUM(fa.total_hours) as total_hours,
            SUM(fa.days_present) as total_days_present,
            COUNT(DISTINCT fa.student_id) as total_students,
            COUNT(DISTINCT fa.course_code) as total_courses
        FROM fact_attendance fa
        INNER JOIN dim_time dt ON fa.date_key = dt.date_key
        {join_clause}
        {where_clause}
        GROUP BY {group_by}
        HAVING COUNT(DISTINCT fa.student_id) > 0
        ORDER BY {order_by}
        """
        
        df = pd.read_sql_query(text(query), engine)
        
        if not df.empty:
            df['attendance_rate'] = (df['avg_days_present'] / 30 * 100).round(2)
            df['attendance_rate'] = df['attendance_rate'].fillna(0)
            
            result = {
                'periods': df['period'].tolist(),
                'attendance': df['avg_attendance'].round(2).tolist(),
                'days_present': df['avg_days_present'].round(2).tolist(),
                'total_hours': df['total_hours'].round(2).tolist(),
                'total_days_present': df['total_days_present'].round(2).tolist(),
                'total_students': df['total_students'].tolist(),
                'total_courses': df['total_courses'].tolist(),
                'attendance_rate': df['attendance_rate'].tolist()
            }
            return jsonify(result)
        else:
            return jsonify({
                'periods': [],
                'attendance': [],
                'days_present': [],
                'total_hours': [],
                'total_days_present': [],
                'total_students': [],
                'total_courses': [],
                'attendance_rate': []
            })
    except Exception as e:
        print(f"Error in get_attendance_trends: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/payment-trends', methods=['GET'])
@jwt_required()
def get_payment_trends():
    try:
        from flask_jwt_extended import get_jwt
        from rbac import Role
        
        claims = get_jwt()
        role_str = claims.get('role', 'finance')
        try:
            role = Role(role_str.lower())
        except:
            role = Role.FINANCE
        
        engine = get_dw_engine()
        filters = request.args.to_dict()
        
        where_clauses = []
        
        if role == Role.DEAN and claims.get('faculty_id'):
            where_clauses.append(f"df.faculty_id = {claims['faculty_id']}")
        elif role == Role.HOD and claims.get('department_id'):
            where_clauses.append(f"ddept.department_id = {claims['department_id']}")
        elif role == Role.STAFF and claims.get('department_id'):
            where_clauses.append(f"ddept.department_id = {claims['department_id']}")
        elif role == Role.STUDENT:
            if claims.get('student_id'):
                where_clauses.append(f"fp.student_id = '{claims['student_id']}'")
            elif claims.get('access_number'):
                where_clauses.append(f"ds.access_number = '{claims['access_number']}'")
        
        if filters.get('faculty_id') and str(filters['faculty_id']).strip() and str(filters['faculty_id']).lower() != 'all':
            where_clauses.append(f"df.faculty_id = {filters['faculty_id']}")
        if filters.get('department_id') and str(filters['department_id']).strip() and str(filters['department_id']).lower() != 'all':
            where_clauses.append(f"ddept.department_id = {filters['department_id']}")
        if filters.get('program_id') and str(filters['program_id']).strip() and str(filters['program_id']).lower() != 'all':
            where_clauses.append(f"ds.program_id = {filters['program_id']}")
        if filters.get('semester_id') and str(filters['semester_id']).strip() and str(filters['semester_id']).lower() != 'all':
            where_clauses.append(f"fp.semester_id = {filters['semester_id']}")
        if filters.get('high_school') and str(filters.get('high_school')).strip().lower() not in ('', 'all'):
            hs = str(filters.get('high_school')).replace("'", "''")
            where_clauses.append(f"ds.high_school ILIKE '%{hs}%'")
        if filters.get('intake_year') and str(filters.get('intake_year')).strip().lower() not in ('', 'all'):
            try:
                where_clauses.append(f"EXTRACT(YEAR FROM ds.admission_date) = {int(filters['intake_year'])}")
            except Exception:
                pass
        if filters.get('course_code') and str(filters.get('course_code')).strip().lower() not in ('', 'all'):
            cc = str(filters.get('course_code')).replace("'", "''")
            where_clauses.append(
                f"EXISTS (SELECT 1 FROM fact_enrollment fe "
                f"WHERE fe.student_id = ds.student_id AND fe.course_code = '{cc}' AND fe.semester_id = fp.semester_id)"
            )

        period = (filters.get('period') or 'quarterly').strip().lower()
        if period not in ('monthly', 'quarterly', 'yearly'):
            period = 'quarterly'
        min_year = 2000 if period == 'yearly' else 2010
        where_clauses.append(f"dt.year >= {min_year}")

        where_clause = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        faculty_filter = (
            filters.get('faculty_id')
            and str(filters['faculty_id']).strip()
            and str(filters['faculty_id']).strip().lower() != 'all'
        )
        department_filter = (
            filters.get('department_id')
            and str(filters['department_id']).strip()
            and str(filters['department_id']).strip().lower() != 'all'
        )
        program_filter = (
            filters.get('program_id')
            and str(filters['program_id']).strip()
            and str(filters['program_id']).strip().lower() != 'all'
        )
        semester_filter = (
            filters.get('semester_id')
            and str(filters['semester_id']).strip()
            and str(filters['semester_id']).strip().lower() != 'all'
        )

        high_school_filter = (
            filters.get('high_school')
            and str(filters.get('high_school')).strip()
            and str(filters.get('high_school')).strip().lower() != 'all'
        )
        intake_year_filter = (
            filters.get('intake_year')
            and str(filters.get('intake_year')).strip()
            and str(filters.get('intake_year')).strip().lower() != 'all'
        )
        course_code_filter = (
            filters.get('course_code')
            and str(filters.get('course_code')).strip()
            and str(filters.get('course_code')).strip().lower() != 'all'
        )

        if (
            role in [Role.ANALYST, Role.FINANCE, Role.SENATE, Role.SYSADMIN]
            and program_filter
            and (not faculty_filter)
            and (not department_filter)
            and (not high_school_filter)
            and (not intake_year_filter)
            and (not course_code_filter)
        ):
            program_id = filters['program_id']
            sem_clause = f" AND fp.semester_id = {filters['semester_id']}" if semester_filter else ""

            if period == 'monthly':
                period_select = "CONCAT(dt.month_name, ' ', CAST(dt.year AS TEXT))"
                group_by = "dt.year, dt.month, dt.month_name"
                order_by = "dt.year, dt.month"
            elif period == 'yearly':
                period_select = "CAST(dt.year AS TEXT)"
                group_by = "dt.year"
                order_by = "dt.year"
            else:
                period_select = "CONCAT('Q', CAST(dt.quarter AS TEXT), ' ', CAST(dt.year AS TEXT))"
                group_by = "dt.year, dt.quarter"
                order_by = "dt.year, dt.quarter"

            query = f"""
            WITH matched AS (
                SELECT
                    fp.payment_id,
                    fp.date_key,
                    fp.semester_id,
                    fp.status,
                    fp.amount,
                    1 AS match_rank
                FROM fact_payment fp
                JOIN dim_student ds ON ds.student_id = fp.student_id
                WHERE ds.program_id = {program_id}
                {sem_clause}

                UNION ALL

                SELECT
                    fp.payment_id,
                    fp.date_key,
                    fp.semester_id,
                    fp.status,
                    fp.amount,
                    2 AS match_rank
                FROM fact_payment fp
                JOIN dim_student ds ON ds.reg_no = fp.student_id
                WHERE ds.program_id = {program_id}
                {sem_clause}

                UNION ALL

                SELECT
                    fp.payment_id,
                    fp.date_key,
                    fp.semester_id,
                    fp.status,
                    fp.amount,
                    3 AS match_rank
                FROM fact_payment fp
                JOIN dim_student ds ON ds.access_number = fp.student_id
                WHERE ds.program_id = {program_id}
                {sem_clause}
            ),
            best AS (
                SELECT DISTINCT ON (payment_id)
                    payment_id,
                    date_key,
                    semester_id,
                    status,
                    amount
                FROM matched
                ORDER BY payment_id, match_rank
            )
            SELECT
                {period_select} as period,
                SUM(CASE WHEN status IN ('Completed', 'SUCCESS') THEN amount ELSE 0 END) as total_amount,
                COUNT(CASE WHEN status IN ('Completed', 'SUCCESS') THEN 1 END) as completed_count,
                COUNT(CASE WHEN status IN ('Pending', 'FAILED') THEN 1 END) as pending_count
            FROM best b
            JOIN dim_time dt ON b.date_key = dt.date_key
            WHERE dt.year >= {min_year}
            GROUP BY {group_by}
            ORDER BY {order_by}
            """

            df = pd.read_sql_query(text(query), engine)
            if not df.empty:
                return jsonify({
                    'periods': df['period'].tolist(),
                    'amounts': df['total_amount'].round(2).tolist(),
                    'completed_payments': df['completed_count'].tolist(),
                    'pending_payments': df['pending_count'].tolist()
                })
            return jsonify({
                'periods': [],
                'amounts': [],
                'completed_payments': [],
                'pending_payments': []
            })

        needs_student_join = (
            role in [Role.DEAN, Role.HOD, Role.STAFF, Role.STUDENT]
            or (filters.get('faculty_id') and str(filters['faculty_id']).strip().lower() != 'all')
            or (filters.get('department_id') and str(filters['department_id']).strip().lower() != 'all')
            or (filters.get('program_id') and str(filters['program_id']).strip().lower() != 'all')
            or high_school_filter
            or intake_year_filter
            or course_code_filter
        )

        program_pushdown = ""
        if filters.get('program_id') and str(filters['program_id']).strip().lower() != 'all':
            program_pushdown = f" AND ds.program_id = {filters['program_id']}"

        join_clause = f"""
        LEFT JOIN LATERAL (
            SELECT ds.*
            FROM dim_student ds
            WHERE (
                ds.student_id = fp.student_id
                OR ds.reg_no = fp.student_id
                OR ds.access_number = fp.student_id
            ){program_pushdown}
            ORDER BY
                CASE
                    WHEN ds.student_id = fp.student_id THEN 1
                    WHEN ds.reg_no = fp.student_id THEN 2
                    WHEN ds.access_number = fp.student_id THEN 3
                    ELSE 4
                END
            LIMIT 1
        ) ds ON TRUE
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        """ if needs_student_join else ""
        if period == 'monthly':
            period_select = "CONCAT(dt.month_name, ' ', CAST(dt.year AS TEXT))"
            group_by = "dt.year, dt.month, dt.month_name"
            order_by = "dt.year, dt.month"
        elif period == 'yearly':
            period_select = "CAST(dt.year AS TEXT)"
            group_by = "dt.year"
            order_by = "dt.year"
        else:
            period_select = "CONCAT('Q', CAST(dt.quarter AS TEXT), ' ', CAST(dt.year AS TEXT))"
            group_by = "dt.year, dt.quarter"
            order_by = "dt.year, dt.quarter"

        query = f"""
        SELECT
            {period_select} as period,
            SUM(CASE WHEN fp.status IN ('Completed', 'SUCCESS') THEN fp.amount ELSE 0 END) as total_amount,
            COUNT(CASE WHEN fp.status IN ('Completed', 'SUCCESS') THEN 1 END) as completed_count,
            COUNT(CASE WHEN fp.status IN ('Pending', 'FAILED') THEN 1 END) as pending_count
        FROM fact_payment fp
        JOIN dim_time dt ON fp.date_key = dt.date_key
        {join_clause}
        {where_clause}
        GROUP BY {group_by}
        ORDER BY {order_by}
        """
        
        df = pd.read_sql_query(text(query), engine)
        
        if not df.empty:
            return jsonify({
                'periods': df['period'].tolist(),
                'amounts': df['total_amount'].round(2).tolist(),
                'completed_payments': df['completed_count'].tolist(),
                'pending_payments': df['pending_count'].tolist()
            })
        else:
            return jsonify({
                'periods': [],
                'amounts': [],
                'completed_payments': [],
                'pending_payments': []
            })
    except Exception as e:
        print(f"Error in get_payment_trends: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/tuition-defaulters', methods=['GET'])
@jwt_required()
def get_tuition_defaulters():
    try:
        from flask_jwt_extended import get_jwt
        from rbac import Role

        claims = get_jwt()
        role_str = claims.get('role', 'finance')
        try:
            role = Role(role_str.lower())
        except Exception:
            role = Role.FINANCE

        engine = get_dw_engine()
        filters = request.args.to_dict()

        def _int_or_none(v):
            if v is None:
                return None
            s = str(v).strip()
            if not s or s.lower() == 'all':
                return None
            try:
                return int(s)
            except Exception:
                return None

        faculty_id = _int_or_none(filters.get('faculty_id'))
        department_id = _int_or_none(filters.get('department_id'))
        program_id = _int_or_none(filters.get('program_id'))
        requested_semester_id = _int_or_none(filters.get('semester_id'))
        high_school = None
        if filters.get('high_school') and str(filters.get('high_school')).strip().lower() not in ('', 'all'):
            high_school = str(filters.get('high_school')).replace("'", "''")
        intake_year = _int_or_none(filters.get('intake_year'))
        course_code = None
        if filters.get('course_code') and str(filters.get('course_code')).strip().lower() not in ('', 'all'):
            course_code = str(filters.get('course_code')).replace("'", "''")

        where_clauses = []
        if role == Role.DEAN and claims.get('faculty_id') is not None:
            where_clauses.append(f"df.faculty_id = {int(claims['faculty_id'])}")
        elif role in (Role.HOD, Role.STAFF) and claims.get('department_id') is not None:
            where_clauses.append(f"ddept.department_id = {int(claims['department_id'])}")
        elif role == Role.STUDENT:
            if claims.get('student_id') is not None:
                where_clauses.append(f"ds.student_id = '{claims['student_id']}'")
            elif claims.get('access_number'):
                where_clauses.append(f"ds.access_number = '{claims['access_number']}'")

        if faculty_id is not None:
            where_clauses.append(f"df.faculty_id = {faculty_id}")
        if department_id is not None:
            where_clauses.append(f"ddept.department_id = {department_id}")
        if program_id is not None:
            where_clauses.append(f"dp.program_id = {program_id}")
        if high_school is not None:
            where_clauses.append(f"ds.high_school ILIKE '%{high_school}%'")
        if intake_year is not None:
            where_clauses.append(f"EXTRACT(YEAR FROM ds.admission_date) = {intake_year}")
        if course_code is not None:
            where_clauses.append(
                f"EXISTS (SELECT 1 FROM fact_enrollment fe "
                f"WHERE fe.student_id = ds.student_id AND fe.course_code = '{course_code}' AND fe.semester_id = fp.semester_id)"
            )

        where_sql = " AND ".join(where_clauses)
        where_sql = f" AND {where_sql}" if where_sql else ""

        if requested_semester_id is not None:
            latest_sem = requested_semester_id
        else:
            sem_sql = f"""
                SELECT MAX(fp.semester_id) AS sem
                FROM fact_payment fp
                JOIN dim_student ds ON fp.student_id = ds.student_id
                LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
                LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
                LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
                WHERE fp.semester_id IS NOT NULL
                {where_sql}
            """
            sem_df = pd.read_sql_query(text(sem_sql), engine)
            latest_sem = int(sem_df.iloc[0]['sem']) if not sem_df.empty and pd.notna(sem_df.iloc[0]['sem']) else None

        if latest_sem is None:
            return jsonify({
                'semester_id': None,
                'tuition_defaulters': [],
            }), 200

        status_sql = "('Pending','FAILED')"
        faculty_sql = f"""
            SELECT COALESCE(df.faculty_name, 'Unknown') AS name,
                   COUNT(DISTINCT ds.student_id) AS defaulters
            FROM fact_payment fp
            JOIN dim_student ds ON fp.student_id = ds.student_id
            LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
            LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
            LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
            WHERE fp.semester_id = :sem
              AND fp.status IN {status_sql}
              {where_sql}
            GROUP BY df.faculty_name
            ORDER BY defaulters DESC
            LIMIT 8
        """
        department_sql = f"""
            SELECT COALESCE(ddept.department_name, 'Unknown') AS name,
                   COUNT(DISTINCT ds.student_id) AS defaulters
            FROM fact_payment fp
            JOIN dim_student ds ON fp.student_id = ds.student_id
            LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
            LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
            LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
            WHERE fp.semester_id = :sem
              AND fp.status IN {status_sql}
              {where_sql}
            GROUP BY ddept.department_name
            ORDER BY defaulters DESC
            LIMIT 8
        """
        program_sql = f"""
            SELECT COALESCE(dp.program_name, 'Unknown') AS name,
                   COUNT(DISTINCT ds.student_id) AS defaulters
            FROM fact_payment fp
            JOIN dim_student ds ON fp.student_id = ds.student_id
            LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
            LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
            LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
            WHERE fp.semester_id = :sem
              AND fp.status IN {status_sql}
              {where_sql}
            GROUP BY dp.program_name
            ORDER BY defaulters DESC
            LIMIT 8
        """

        faculty_df = pd.read_sql_query(text(faculty_sql), engine, params={'sem': latest_sem})
        dept_df = pd.read_sql_query(text(department_sql), engine, params={'sem': latest_sem})
        program_df = pd.read_sql_query(text(program_sql), engine, params={'sem': latest_sem})

        breakdown = _finance_chart_breakdown(filters)
        if breakdown == 'faculty':
            src_df = faculty_df
        elif breakdown == 'department':
            src_df = dept_df
        else:
            src_df = program_df

        combined = []
        if not src_df.empty:
            for _, r in src_df.iterrows():
                combined.append({
                    'name': r.get('name') or 'Unknown',
                    'value': int(r.get('defaulters') or 0),
                    'dimension': breakdown,
                })

        combined = [c for c in combined if c['value'] > 0]
        combined.sort(key=lambda x: -x['value'])
        combined = combined[:15]

        return jsonify({
            'semester_id': latest_sem,
            'tuition_defaulters': combined,
            'breakdown': breakdown,
        }), 200
    except Exception as e:
        import traceback
        print(f"Error in get_tuition_defaulters: {e}")
        print(traceback.format_exc())
        return jsonify({'tuition_defaulters': [], 'semester_id': None, 'error': str(e)}), 500
    finally:
        pass

@app.route('/api/dashboard/tuition-payment-trends-dimensions', methods=['GET'])
@jwt_required()
def get_tuition_payment_trends_dimensions():
    try:
        from flask_jwt_extended import get_jwt
        from rbac import Role

        claims = get_jwt()
        role_str = claims.get('role', 'finance')
        try:
            role = Role(role_str.lower())
        except Exception:
            role = Role.FINANCE

        engine = get_dw_engine()
        filters = request.args.to_dict()

        def _int_or_none(v):
            if v is None:
                return None
            s = str(v).strip()
            if not s or s.lower() == 'all':
                return None
            try:
                return int(s)
            except Exception:
                return None

        faculty_id = _int_or_none(filters.get('faculty_id'))
        department_id = _int_or_none(filters.get('department_id'))
        program_id = _int_or_none(filters.get('program_id'))
        semester_id = _int_or_none(filters.get('semester_id'))

        period = (filters.get('period') or 'quarterly').strip().lower()
        if period not in ('monthly', 'quarterly', 'yearly'):
            period = 'quarterly'

        min_year = 2000

        where_clauses = [f"dt.year >= {min_year}"]

        def _sql_str(s):
            if s is None:
                return ''
            return str(s).replace("'", "''")

        _paid_cond = (
            "((UPPER(TRIM(COALESCE(fp.status::text, ''))) IN ("
            "'COMPLETED', 'SUCCESS', 'PAID', 'COMPLETE', 'SETTLED', 'CLEARED', 'OK'"
            ")) OR (UPPER(TRIM(COALESCE(fp.status::text, ''))) LIKE 'COMPLETE%')"
            " OR (UPPER(TRIM(COALESCE(fp.status::text, ''))) LIKE 'PAID%'))"
        )

        if role == Role.DEAN and claims.get('faculty_id') is not None:
            where_clauses.append(f"df.faculty_id = {int(claims['faculty_id'])}")
        elif role in (Role.HOD, Role.STAFF) and claims.get('department_id') is not None:
            where_clauses.append(f"ddept.department_id = {int(claims['department_id'])}")
        elif role == Role.STUDENT:
            if claims.get('student_id') is not None:
                sid = _sql_str(claims['student_id'])
                where_clauses.append(f"ds.student_id = '{sid}'")
            elif claims.get('access_number'):
                where_clauses.append(f"ds.access_number = '{_sql_str(claims['access_number'])}'")

        if faculty_id is not None:
            where_clauses.append(f"df.faculty_id = {faculty_id}")
        if department_id is not None:
            where_clauses.append(f"ddept.department_id = {department_id}")
        if program_id is not None:
            where_clauses.append(f"dp.program_id = {program_id}")
        if semester_id is not None:
            where_clauses.append(f"fp.semester_id = {semester_id}")

        if filters.get('high_school') and str(filters.get('high_school')).strip().lower() not in ('', 'all'):
            hs = str(filters.get('high_school')).replace("'", "''")
            where_clauses.append(f"ds.high_school ILIKE '%{hs}%'")
        if filters.get('intake_year') and str(filters.get('intake_year')).strip().lower() not in ('', 'all'):
            try:
                where_clauses.append(f"EXTRACT(YEAR FROM ds.admission_date) = {int(filters['intake_year'])}")
            except Exception:
                pass
        if filters.get('course_code') and str(filters.get('course_code')).strip().lower() not in ('', 'all'):
            cc = str(filters.get('course_code')).replace("'", "''")
            where_clauses.append(
                f"EXISTS (SELECT 1 FROM fact_enrollment fe "
                f"WHERE fe.student_id = ds.student_id AND fe.course_code = '{cc}' AND fe.semester_id = fp.semester_id)"
            )

        where_sql = " AND ".join(where_clauses)

        program_pushdown = ""
        if program_id is not None:
            program_pushdown = f" AND ds.program_id = {int(program_id)}"

        if period == 'monthly':
            period_select = "CONCAT(dt.month_name, ' ', CAST(dt.year AS TEXT))"
            group_by = "dt.year, dt.month, dt.month_name"
            order_by = "dt.year, dt.month"
        elif period == 'yearly':
            period_select = "CAST(dt.year AS TEXT)"
            group_by = "dt.year"
            order_by = "dt.year"
        else:
            period_select = "CONCAT('Q', CAST(dt.quarter AS TEXT), ' ', CAST(dt.year AS TEXT))"
            group_by = "dt.year, dt.quarter"
            order_by = "dt.year, dt.quarter"

        query = f"""
        SELECT
            {period_select} AS period,
            SUM(CASE WHEN {_paid_cond} THEN fp.amount ELSE 0 END) AS total_completed_amount,
            COUNT(DISTINCT CASE WHEN {_paid_cond} THEN df.faculty_id END) AS faculty_units,
            COUNT(DISTINCT CASE WHEN {_paid_cond} THEN ddept.department_id END) AS department_units,
            COUNT(DISTINCT CASE WHEN {_paid_cond} THEN dp.program_id END) AS program_units
        FROM fact_payment fp
        JOIN dim_time dt ON fp.date_key = dt.date_key
        LEFT JOIN LATERAL (
            SELECT ds.*
            FROM dim_student ds
            WHERE (
                ds.student_id = fp.student_id
                OR ds.reg_no = fp.student_id
                OR ds.access_number = fp.student_id
            ){program_pushdown}
            ORDER BY
                CASE
                    WHEN ds.student_id = fp.student_id THEN 1
                    WHEN ds.reg_no = fp.student_id THEN 2
                    WHEN ds.access_number = fp.student_id THEN 3
                    ELSE 4
                END
            LIMIT 1
        ) ds ON TRUE
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        WHERE {where_sql}
          AND ds.student_id IS NOT NULL
        GROUP BY {group_by}
        ORDER BY {order_by}
        """

        df = pd.read_sql_query(text(query), engine)
        periods = []
        faculty_amounts = []
        department_amounts = []
        program_amounts = []

        if not df.empty:
            for _, r in df.iterrows():
                periods.append(r.get('period'))
                total_amt = float(r.get('total_completed_amount') or 0.0)

                fu = int(r.get('faculty_units') or 0)
                du = int(r.get('department_units') or 0)
                pu = int(r.get('program_units') or 0)

                faculty_amounts.append(
                    round(total_amt / fu, 2) if fu > 0 else (round(total_amt, 2) if total_amt > 0 else 0.0)
                )
                department_amounts.append(
                    round(total_amt / du, 2) if du > 0 else (round(total_amt, 2) if total_amt > 0 else 0.0)
                )
                program_amounts.append(
                    round(total_amt / pu, 2) if pu > 0 else (round(total_amt, 2) if total_amt > 0 else 0.0)
                )

        if not periods:
            from tuition_trends_synthetic import (
                build_synthetic_tuition_trends,
                should_use_synthetic_tuition_trends,
            )

            if should_use_synthetic_tuition_trends(filters, role, TUITION_TRENDS_SYNTHETIC_FALLBACK):
                return jsonify(build_synthetic_tuition_trends(period)), 200

        return jsonify({
            'periods': periods,
            'faculty_amounts': faculty_amounts,
            'department_amounts': department_amounts,
            'program_amounts': program_amounts,
        }), 200
    except Exception as e:
        import traceback
        print(f"Error in get_tuition_payment_trends_dimensions: {e}")
        print(traceback.format_exc())
        return jsonify({
            'periods': [],
            'faculty_amounts': [],
            'department_amounts': [],
            'program_amounts': [],
            'error': str(e),
        }), 500
    finally:
        try:
            pass
        except Exception:
            pass

@app.route('/api/dashboard/student-payment-breakdown', methods=['GET'])
@jwt_required()
def get_student_payment_breakdown():
    try:
        from flask_jwt_extended import get_jwt
        from rbac import Role

        claims = get_jwt()
        role_str = claims.get('role', 'student')
        try:
            role = Role(role_str.lower())
        except Exception:
            role = Role.STUDENT

        if role != Role.STUDENT:
            return jsonify({
                'total_paid': 0,
                'total_pending': 0,
                'total_amount': 0,
                'paid_percentage': 0.0,
                'pending_percentage': 0.0,
            })

        engine = get_dw_engine()

        where_clauses = []
        params = {}
        if claims.get('student_id'):
            where_clauses.append("fp.student_id = :student_id")
            params['student_id'] = str(claims['student_id'])
        elif claims.get('access_number'):
            where_clauses.append("ds.access_number = :access_number")
            params['access_number'] = str(claims['access_number'])
        else:
            return jsonify({
                'total_paid': 0,
                'total_pending': 0,
                'total_amount': 0,
                'paid_percentage': 0.0,
                'pending_percentage': 0.0,
            })

        where_clause = "WHERE " + " AND ".join(where_clauses)

        query = f"""
        SELECT
            COALESCE(SUM(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END), 0) AS total_paid,
            COALESCE(SUM(CASE WHEN fp.status = 'Pending' THEN fp.amount ELSE 0 END), 0) AS total_pending,
            COALESCE(SUM(fp.amount), 0) AS total_amount
        FROM fact_payment fp
        JOIN dim_student ds ON fp.student_id = ds.student_id
        {where_clause}
        """
        df = pd.read_sql_query(text(query), engine, params=params)

        if df.empty:
            return jsonify({
                'total_paid': 0,
                'total_pending': 0,
                'total_amount': 0,
                'paid_percentage': 0.0,
                'pending_percentage': 0.0,
            })

        row = df.iloc[0]
        total_paid = float(row['total_paid']) if pd.notna(row['total_paid']) else 0.0
        total_pending = float(row['total_pending']) if pd.notna(row['total_pending']) else 0.0
        total_amount = float(row['total_amount']) if pd.notna(row['total_amount']) else 0.0
        if total_amount <= 0:
            paid_pct = 0.0
            pending_pct = 0.0
        else:
            paid_pct = round((total_paid / total_amount) * 100.0, 2)
            pending_pct = round((total_pending / total_amount) * 100.0, 2)

        return jsonify({
            'total_paid': total_paid,
            'total_pending': total_pending,
            'total_amount': total_amount,
            'paid_percentage': paid_pct,
            'pending_percentage': pending_pct,
        })
    except Exception as e:
        import traceback
        print(f"Error in get_student_payment_breakdown: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/predict-performance', methods=['POST'])
@jwt_required()
def predict_performance():
    data = request.get_json()
    student_id = data.get('student_id')
    
    if not student_id:
        return jsonify({'error': 'Student ID required'}), 400
    
    try:
        prediction = predictor.predict(student_id)
        return jsonify({
            'student_id': student_id,
            'predicted_grade': round(float(prediction), 2)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/mex-fex-analysis', methods=['GET'])
@jwt_required()
def get_mex_fex_analysis():
    try:
        engine = get_dw_engine()
        role_join, role_where = _dashboard_role_scope()
        scope_join = f" JOIN dim_student ds ON fg.student_id = ds.student_id {role_join} " if role_join else ""
        scope_where = f" WHERE {role_where} " if role_where else ""
        scope_and = f" AND {role_where} " if role_where else ""

        overall_query = f"""
        SELECT 
            COUNT(CASE WHEN fg.exam_status = 'MEX' THEN 1 END) as total_mex,
            COUNT(CASE WHEN fg.exam_status = 'FEX' THEN 1 END) as total_fex,
            COUNT(CASE WHEN fg.exam_status = 'Completed' THEN 1 END) as total_completed,
            COUNT(*) as total_exams
        FROM fact_grade fg
        {scope_join}
        {scope_where}
        """
        overall_df = pd.read_sql_query(text(overall_query), engine)

        if role_where:
            reasons_query = f"""
            SELECT 
                CASE 
                    WHEN fg.absence_reason LIKE '%Tuition%' OR fg.absence_reason LIKE '%Financial%' THEN 'Tuition/Financial'
                    WHEN fg.absence_reason LIKE '%Family%' OR fg.absence_reason LIKE '%Death%' OR fg.absence_reason LIKE '%Bereavement%' THEN 'Family Issues'
                    WHEN fg.absence_reason LIKE '%Sickness%' OR fg.absence_reason LIKE '%Medical%' THEN 'Medical/Sickness'
                    WHEN fg.absence_reason LIKE '%Transport%' THEN 'Transportation'
                    WHEN fg.absence_reason != '' THEN 'Other'
                    ELSE 'Not Specified'
                END as reason_category,
                COUNT(*) as count
            FROM fact_grade fg
            {scope_join}
            WHERE {role_where} AND fg.exam_status = 'MEX'
            GROUP BY reason_category
            ORDER BY count DESC
            """
        else:
            reasons_query = """
            SELECT 
                CASE 
                    WHEN absence_reason LIKE '%Tuition%' OR absence_reason LIKE '%Financial%' THEN 'Tuition/Financial'
                    WHEN absence_reason LIKE '%Family%' OR absence_reason LIKE '%Death%' OR absence_reason LIKE '%Bereavement%' THEN 'Family Issues'
                    WHEN absence_reason LIKE '%Sickness%' OR absence_reason LIKE '%Medical%' THEN 'Medical/Sickness'
                    WHEN absence_reason LIKE '%Transport%' THEN 'Transportation'
                    WHEN absence_reason != '' THEN 'Other'
                    ELSE 'Not Specified'
                END as reason_category,
                COUNT(*) as count
            FROM fact_grade
            WHERE exam_status = 'MEX'
            GROUP BY reason_category
            ORDER BY count DESC
            """
        reasons_df = pd.read_sql_query(text(reasons_query), engine)

        if role_where:
            performance_query = f"""
            SELECT 
                CASE WHEN mex_count > 0 THEN 'With MEX' ELSE 'No MEX' END as category,
                AVG(avg_grade) as avg_performance,
                COUNT(*) as student_count
            FROM (
                SELECT 
                    fg.student_id,
                    COUNT(CASE WHEN fg.exam_status = 'MEX' THEN 1 END) as mex_count,
                    AVG(CASE WHEN fg.exam_status = 'Completed' THEN fg.grade ELSE NULL END) as avg_grade
                FROM fact_grade fg
                JOIN dim_student ds ON fg.student_id = ds.student_id
                {role_join}
                WHERE {role_where}
                GROUP BY fg.student_id
            ) student_stats
            WHERE avg_grade IS NOT NULL
            GROUP BY category
            """
        else:
            performance_query = """
            SELECT 
                CASE WHEN mex_count > 0 THEN 'With MEX' ELSE 'No MEX' END as category,
                AVG(avg_grade) as avg_performance,
                COUNT(*) as student_count
            FROM (
                SELECT 
                    fg.student_id,
                    COUNT(CASE WHEN fg.exam_status = 'MEX' THEN 1 END) as mex_count,
                    AVG(CASE WHEN fg.exam_status = 'Completed' THEN fg.grade ELSE NULL END) as avg_grade
                FROM fact_grade fg
                GROUP BY fg.student_id
            ) student_stats
            WHERE avg_grade IS NOT NULL
            GROUP BY category
            """
        performance_df = pd.read_sql_query(text(performance_query), engine)

        return jsonify({
            'overall': {
                'total_mex': int(overall_df['total_mex'][0]) if not overall_df.empty else 0,
                'total_fex': int(overall_df['total_fex'][0]) if not overall_df.empty else 0,
                'total_completed': int(overall_df['total_completed'][0]) if not overall_df.empty else 0,
                'total_exams': int(overall_df['total_exams'][0]) if not overall_df.empty else 0
            },
            'reasons': {
                'categories': reasons_df['reason_category'].tolist() if not reasons_df.empty else [],
                'counts': reasons_df['count'].tolist() if not reasons_df.empty else []
            },
            'performance_impact': {
                'categories': performance_df['category'].tolist() if not performance_df.empty else [],
                'avg_performance': performance_df['avg_performance'].round(2).tolist() if not performance_df.empty else [],
                'student_counts': performance_df['student_count'].tolist() if not performance_df.empty else []
            }
        })
    except Exception as e:
        print(f"Error in get_mex_fex_analysis: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/report/generate', methods=['POST', 'GET'])
@jwt_required()
def generate_report():
    from pdf_generator import PDFReportGenerator
    from flask import send_file
    from flask_jwt_extended import get_jwt
    import os
    
    try:
        generator = PDFReportGenerator(
            api_base_url=f"http://localhost:5000",
            token=request.headers.get('Authorization', '').replace('Bearer ', '')
        )
        
        output_path = generator.generate_report()
        
        if os.path.exists(output_path):
            try:
                from audit_log import log as audit_log
                claims = get_jwt()
                audit_log('report_generate', 'export', username=claims.get('username') or claims.get('access_number') or '', role_name=claims.get('role') or '', resource_id='pdf', status='success')
            except Exception:
                pass
            return send_file(
                output_path, 
                as_attachment=True, 
                download_name=f'nextgen_report_{datetime.now().strftime("%Y%m%d")}.pdf',
                mimetype='application/pdf'
            )
        else:
            return jsonify({'error': 'PDF generation failed'}), 500
    except Exception as e:
        import traceback
        print(f"Error generating PDF: {e}")
        print(traceback.format_exc())
        engine = get_dw_engine()
        
        stats_query = """
        SELECT 
            (SELECT COUNT(DISTINCT student_id) FROM dim_student) as total_students,
            (SELECT COUNT(*) FROM dim_course) as total_courses,
            (SELECT COUNT(*) FROM fact_enrollment) as total_enrollments,
            (SELECT AVG(grade) FROM fact_grade) as avg_grade,
            (SELECT SUM(amount) FROM fact_payment WHERE status = 'Completed') as total_payments
        """
        stats = pd.read_sql_query(stats_query, engine).to_dict('records')[0]
        
        dept_query = """
        SELECT 
            dc.department,
            COUNT(DISTINCT fe.student_id) as student_count
        FROM fact_enrollment fe
        JOIN dim_course dc ON fe.course_code = dc.course_code
        GROUP BY dc.department
        """
        departments = pd.read_sql_query(dept_query, engine).to_dict('records')
        
        grade_query = """
        SELECT 
            letter_grade,
            COUNT(*) as count
        FROM fact_grade
        GROUP BY letter_grade
        """
        grades = pd.read_sql_query(grade_query, engine).to_dict('records')
        
        return jsonify({
            'stats': stats,
            'departments': departments,
            'grades': grades,
            'generated_at': datetime.now().isoformat()
        })

try:
    from config.connection import get_sqlalchemy_conn_string as _gcs, RBAC_DB_NAME as _rdbn
    _rbac = create_engine(_gcs(_rdbn))
    _ensure_app_users_table(_rbac)
    _ensure_default_app_user(_rbac)
    _rbac.dispose()
except Exception as ex:
    print(f"Warning: Could not ensure RBAC DB: {ex}")

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
