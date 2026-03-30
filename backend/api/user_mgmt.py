import pandas as pd
from datetime import datetime
from flask import Blueprint, request, jsonify, make_response
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity, verify_jwt_in_request
from sqlalchemy import create_engine, text
from werkzeug.security import generate_password_hash, check_password_hash

from config.connection import (
    RBAC_DB_NAME,
    DATA_WAREHOUSE_CONN_STRING,
    get_sqlalchemy_conn_string,
)
from db_engines import get_dw_engine

user_mgmt_bp = Blueprint('user_mgmt', __name__)
RBAC_CONN_STRING = get_sqlalchemy_conn_string(RBAC_DB_NAME)

DEMO_ACCOUNTS_FOR_LIST = [
    {'username': 'admin', 'role': 'sysadmin', 'full_name': 'System Administrator'},
    {'username': 'analyst', 'role': 'analyst', 'full_name': 'Data Analyst'},
    {'username': 'senate', 'role': 'senate', 'full_name': 'Senate Member'},
    {'username': 'staff', 'role': 'staff', 'full_name': 'Staff Member'},
    {'username': 'dean', 'role': 'dean', 'full_name': 'Faculty Dean'},
    {'username': 'hod', 'role': 'hod', 'full_name': 'Head of Department'},
    {'username': 'hr', 'role': 'hr', 'full_name': 'HR Manager'},
    {'username': 'finance', 'role': 'finance', 'full_name': 'Finance Manager'},
]

def _ensure_dim_app_user_table(engine):
    try:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS dim_app_user (
                    app_user_id INT PRIMARY KEY,
                    username VARCHAR(100) NOT NULL UNIQUE,
                    role VARCHAR(50) NOT NULL,
                    full_name VARCHAR(200),
                    faculty_id INT NULL,
                    department_id INT NULL,
                    created_at TIMESTAMP NULL
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dau_username ON dim_app_user(username)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dau_role ON dim_app_user(role)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dau_faculty ON dim_app_user(faculty_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dau_department ON dim_app_user(department_id)"))
            conn.commit()
    except Exception:
        pass

def _sync_dim_app_user(action, app_user_id, data=None):
    try:
        dw_engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        _ensure_dim_app_user_table(dw_engine)
        with dw_engine.connect() as conn:
            if action == 'delete':
                conn.execute(text("DELETE FROM dim_app_user WHERE app_user_id = :aid"), {'aid': app_user_id})
            elif action in ('insert', 'update') and data:
                conn.execute(text("""
                    INSERT INTO dim_app_user (app_user_id, username, role, full_name, faculty_id, department_id, created_at)
                    VALUES (:aid, :username, :role, :full_name, :faculty_id, :department_id, :created_at)
                    ON CONFLICT (app_user_id) DO UPDATE SET
                    username = EXCLUDED.username, role = EXCLUDED.role, full_name = EXCLUDED.full_name,
                    faculty_id = EXCLUDED.faculty_id, department_id = EXCLUDED.department_id
                """), {
                    'aid': app_user_id,
                    'username': data.get('username', ''),
                    'role': data.get('role', 'staff'),
                    'full_name': data.get('full_name') or data.get('username', ''),
                    'faculty_id': data.get('faculty_id'),
                    'department_id': data.get('department_id'),
                    'created_at': data.get('created_at'),
                })
            conn.commit()
        dw_engine.dispose()
    except Exception:
        pass

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
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS staff_course_assignments (
                    app_user_id INT NOT NULL,
                    course_code VARCHAR(50) NOT NULL,
                    PRIMARY KEY (app_user_id, course_code),
                    FOREIGN KEY (app_user_id) REFERENCES app_users(id) ON DELETE CASCADE
                )
            """))
            conn.commit()
            try:
                conn.execute(text("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS created_by_username VARCHAR(100)"))
                conn.commit()
            except Exception:
                pass
    except Exception:
        pass

DEFAULT_APP_USER = {
    'username': 'Cemputus',
    'password': 'cen123',
    'role': 'staff',
    'full_name': 'Emmanuel Nsubuga',
    'faculty_id': 1,
    'department_id': 1,
}

def _ensure_default_app_user(engine):
    try:
        ph = generate_password_hash(DEFAULT_APP_USER['password'], method='pbkdf2:sha256')
        with engine.connect() as conn:
            r = pd.read_sql_query(
                text("SELECT id FROM app_users WHERE LOWER(username) = :uname"),
                conn, params={'uname': DEFAULT_APP_USER['username'].lower()}
            )
            if not r.empty:
                conn.execute(
                    text("UPDATE app_users SET password_hash = :ph, full_name = :fn, role = :role, faculty_id = :fid, department_id = :did WHERE LOWER(username) = :uname"),
                    {
                        'ph': ph, 'fn': DEFAULT_APP_USER['full_name'], 'role': DEFAULT_APP_USER['role'],
                        'fid': DEFAULT_APP_USER['faculty_id'], 'did': DEFAULT_APP_USER['department_id'],
                        'uname': DEFAULT_APP_USER['username'].lower(),
                    }
                )
            else:
                conn.execute(
                    text("""
                        INSERT INTO app_users (username, password_hash, role, full_name, faculty_id, department_id)
                        VALUES (:username, :ph, :role, :fn, :fid, :did)
                    """),
                    {
                        'username': DEFAULT_APP_USER['username'],
                        'ph': ph, 'role': DEFAULT_APP_USER['role'], 'fn': DEFAULT_APP_USER['full_name'],
                        'fid': DEFAULT_APP_USER['faculty_id'], 'did': DEFAULT_APP_USER['department_id'],
                    }
                )
            conn.commit()
            r = pd.read_sql_query(text("SELECT id FROM app_users WHERE LOWER(username) = :uname"), conn, params={'uname': DEFAULT_APP_USER['username'].lower()})
            if not r.empty:
                _sync_dim_app_user('insert', int(r.iloc[0]['id']), {
                    'username': DEFAULT_APP_USER['username'], 'role': DEFAULT_APP_USER['role'],
                    'full_name': DEFAULT_APP_USER['full_name'], 'faculty_id': DEFAULT_APP_USER['faculty_id'],
                    'department_id': DEFAULT_APP_USER['department_id'], 'created_at': datetime.now(),
                })
    except Exception:
        pass

@user_mgmt_bp.route('/api/user-mgmt/ping', methods=['GET', 'OPTIONS'], strict_slashes=False)
@user_mgmt_bp.route('/user-mgmt/ping', methods=['GET', 'OPTIONS'], strict_slashes=False)
def user_mgmt_ping():
    if request.method == 'OPTIONS':
        return _user_mgmt_options()
    return jsonify({'ok': True, 'message': 'User Management API active'}), 200

def _user_mgmt_options():
    origin = request.headers.get('Origin') or ''
    allowed = ('http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5000', 'http://127.0.0.1:5000')
    allow_origin = origin if origin in allowed else 'http://localhost:3000'
    resp = make_response('', 200)
    resp.headers['Access-Control-Allow-Origin'] = allow_origin
    resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, PATCH, DELETE, OPTIONS'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    resp.headers['Access-Control-Allow-Credentials'] = 'true'
    resp.headers['Access-Control-Max-Age'] = '86400'
    return resp

def _user_mgmt_dispatch(subpath):
    raw = (subpath or '').strip().rstrip('/')
    norm = raw.lower()
    if '?' in norm:
        norm = norm.split('?')[0].strip()
    if norm == 'ping':
        return jsonify({'ok': True, 'message': 'Admin API active'}), 200
    if norm == 'users' and request.method == 'GET':
        return admin_list_users()
    if norm == 'users' and request.method == 'POST':
        return admin_create_user()
    if request.method == 'GET' and norm.startswith('users/'):
        parts = raw.split('/')
        if len(parts) == 3 and parts[1].lower() in ('student', 'demo', 'app_user'):
            try:
                verify_jwt_in_request()
            except Exception:
                return jsonify({'error': 'Auth required'}), 401
            err = _require_sysadmin()
            if err is not None:
                return err
            return admin_get_user(parts[1], parts[2])
    if request.method in ('PATCH', 'DELETE') and norm.startswith('users/app_user/'):
        parts = raw.split('/')
        if len(parts) == 3 and parts[2].isdigit():
            try:
                verify_jwt_in_request()
            except Exception:
                return jsonify({'error': 'Auth required'}), 401
            err = _require_sysadmin()
            if err is not None:
                return err
            uid = int(parts[2])
            if request.method == 'PATCH':
                return admin_update_user(uid)
            return admin_delete_user(uid)
    if norm == 'faculties' and request.method == 'GET':
        return admin_list_faculties()
    if norm == 'departments' and request.method == 'GET':
        return admin_list_departments()
    if request.method == 'OPTIONS':
        return _user_mgmt_options()
    return jsonify({'error': 'Not found', 'path': subpath}), 404

@user_mgmt_bp.route('/api/user-mgmt/<path:subpath>', methods=['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], strict_slashes=False)
def user_mgmt_handle(subpath):
    return _user_mgmt_dispatch(subpath)

@user_mgmt_bp.route('/user-mgmt/<path:subpath>', methods=['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], strict_slashes=False)
def user_mgmt_handle_no_api(subpath):
    return _user_mgmt_dispatch(subpath)

def _require_sysadmin():
    claims = get_jwt()
    role = str(claims.get('role') or '').strip().lower()
    if role not in ('sysadmin', 'admin'):
        return jsonify({'error': 'Admin access required'}), 403
    return None

@user_mgmt_bp.route('/api/user-mgmt/users', methods=['GET'], strict_slashes=False)
@user_mgmt_bp.route('/api/sysadmin/users', methods=['GET'], strict_slashes=False)
@user_mgmt_bp.route('/api/admin/users', methods=['GET'], strict_slashes=False)
@jwt_required()
def admin_list_users():
    err = _require_sysadmin()
    if err is not None:
        return err
    search = (request.args.get('search') or '').strip().lower()
    role_filter = (request.args.get('role') or '').strip().lower()
    limit = min(max(request.args.get('limit', type=int) or 500, 1), 10000)
    offset = max(request.args.get('offset', type=int) or 0, 0)
    users_app = []
    users_demo = []
    users_students = []
    warning = None
    try:
        try:
            rbac_engine = create_engine(RBAC_CONN_STRING)
            _ensure_app_users_table(rbac_engine)
            app_df = pd.read_sql_query(
                "SELECT id, username, role, full_name, faculty_id, department_id, created_by_username FROM app_users",
                rbac_engine
            )
            rbac_engine.dispose()
            demo_usernames = {a['username'].lower() for a in DEMO_ACCOUNTS_FOR_LIST}
            for _, row in app_df.iterrows():
                uname = str(row['username']) if pd.notna(row['username']) else ''
                if not uname or uname.lower() in demo_usernames:
                    continue
                if role_filter and (str(row['role']) if pd.notna(row['role']) else '').lower() != role_filter:
                    continue
                if search and search not in uname.lower() and search not in (str(row['full_name']) if pd.notna(row['full_name']) else '').lower():
                    continue
                users_app.append({
                    'id': str(row['id']), 'username': uname,
                    'access_number': None, 'reg_number': None,
                    'first_name': str(row['full_name']) if pd.notna(row['full_name']) else uname,
                    'last_name': '',
                    'full_name': str(row['full_name']) if pd.notna(row['full_name']) else uname,
                    'role': str(row['role']) if pd.notna(row['role']) else 'staff',
                    'type': 'app_user',
                    'faculty_id': int(row['faculty_id']) if pd.notna(row['faculty_id']) else None,
                    'department_id': int(row['department_id']) if pd.notna(row['department_id']) else None,
                    'created_by_username': str(row['created_by_username']) if pd.notna(row.get('created_by_username')) else None,
                })
        except Exception as e:
            warning = str(e)
        if not role_filter or role_filter != 'student':
            for acc in DEMO_ACCOUNTS_FOR_LIST:
                if role_filter and acc['role'] != role_filter:
                    continue
                if search and search not in acc['username'].lower() and search not in (acc.get('full_name') or '').lower():
                    continue
                users_demo.append({
                    'id': acc['username'], 'username': acc['username'],
                    'access_number': None, 'reg_number': None,
                    'first_name': acc.get('full_name') or acc['username'], 'last_name': '',
                    'full_name': acc.get('full_name') or acc['username'],
                    'role': acc['role'], 'type': 'demo',
                })
        if not role_filter or role_filter == 'student':
            try:
                engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
                q = """
                    SELECT ds.student_id, ds.access_number, ds.reg_no, ds.first_name, ds.last_name,
                           ds.admission_date, ds.year_of_study, dp.program_name
                    FROM dim_student ds
                    LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
                """
                params = {}
                conditions = []
                if search:
                    conditions.append(
                        "(LOWER(ds.access_number) LIKE :search OR LOWER(ds.reg_no) LIKE :search "
                        "OR LOWER(ds.first_name) LIKE :search OR LOWER(ds.last_name) LIKE :search "
                        "OR LOWER(ds.first_name || ' ' || ds.last_name) LIKE :search)"
                    )
                    params['search'] = f'%{search}%'
                if conditions:
                    q += " WHERE " + " AND ".join(conditions)
                q += " ORDER BY ds.last_name, ds.first_name LIMIT :limit"
                params['limit'] = limit
                df = pd.read_sql_query(text(q), engine, params=params)
                engine.dispose()
                for _, row in df.iterrows():
                    first = str(row['first_name']) if pd.notna(row['first_name']) else ''
                    last = str(row['last_name']) if pd.notna(row['last_name']) else ''
                    adm = row.get('admission_date')
                    year_of_admission = int(adm.year) if adm is not None and pd.notna(adm) and hasattr(adm, 'year') else None
                    users_students.append({
                        'id': str(row['student_id']),
                        'username': str(row['access_number']) if pd.notna(row['access_number']) else '',
                        'access_number': str(row['access_number']) if pd.notna(row['access_number']) else '',
                        'reg_number': str(row['reg_no']) if pd.notna(row['reg_no']) else '',
                        'first_name': first, 'last_name': last,
                        'full_name': f'{first} {last}'.strip() or '—',
                        'role': 'student', 'type': 'student',
                        'program_name': str(row['program_name']) if pd.notna(row.get('program_name')) else None,
                        'year_of_admission': year_of_admission,
                        'year_of_study': int(row['year_of_study']) if pd.notna(row.get('year_of_study')) else None,
                    })
            except Exception:
                pass
    except Exception as e:
        warning = str(e)
    users = users_students + users_app + users_demo
    total = len(users)
    users = users[offset:offset + limit]
    out = {'users': users, 'total': total}
    if warning:
        out['warning'] = warning
    return jsonify(out)

@user_mgmt_bp.route('/api/user-mgmt/users/<user_type>/<user_id>', methods=['GET'], strict_slashes=False)
@jwt_required()
def admin_get_user(user_type, user_id):
    err = _require_sysadmin()
    if err is not None:
        return err
    user_type = (user_type or '').strip().lower()
    if user_type not in ('student', 'demo', 'app_user'):
        return jsonify({'error': 'Invalid user type'}), 400
    try:
        if user_type == 'student':
            engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
            try:
                sid_param = int(user_id)
            except (ValueError, TypeError):
                sid_param = user_id
            df = pd.read_sql_query(
                text("""
                    SELECT ds.student_id, ds.access_number, ds.reg_no, ds.first_name, ds.last_name,
                           ds.admission_date, ds.year_of_study, ds.status,
                           dp.program_name
                    FROM dim_student ds
                    LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
                    WHERE ds.student_id = :sid
                       OR ds.access_number = :sid2
                       OR ds.reg_no = :sid3
                """),
                engine, params={'sid': sid_param, 'sid2': str(user_id), 'sid3': str(user_id)}
            )
            engine.dispose()
            if df.empty:
                return jsonify({'error': 'Student not found'}), 404
            row = df.iloc[0]
            first = str(row['first_name']) if pd.notna(row['first_name']) else ''
            last = str(row['last_name']) if pd.notna(row['last_name']) else ''
            adm_date = row.get('admission_date')
            year_of_admission = None
            if adm_date is not None and pd.notna(adm_date):
                if hasattr(adm_date, 'year'):
                    year_of_admission = int(adm_date.year)
                elif isinstance(adm_date, str) and len(adm_date) >= 4:
                    try:
                        year_of_admission = int(adm_date[:4])
                    except (ValueError, TypeError):
                        pass
            return jsonify({
                'id': str(row['student_id']),
                'username': str(row['access_number']) if pd.notna(row['access_number']) else '',
                'access_number': str(row['access_number']) if pd.notna(row['access_number']) else '',
                'reg_number': str(row['reg_no']) if pd.notna(row['reg_no']) else '',
                'first_name': first, 'last_name': last,
                'full_name': f'{first} {last}'.strip() or '—',
                'role': 'student', 'type': 'student',
                'admission_date': adm_date.strftime('%Y-%m-%d') if adm_date is not None and pd.notna(adm_date) and hasattr(adm_date, 'strftime') else None,
                'year_of_admission': year_of_admission,
                'year_of_study': int(row['year_of_study']) if pd.notna(row.get('year_of_study')) else None,
                'program_name': str(row['program_name']) if pd.notna(row.get('program_name')) else None,
                'status': str(row['status']) if pd.notna(row.get('status')) else None,
            })
        if user_type == 'demo':
            for acc in DEMO_ACCOUNTS_FOR_LIST:
                if acc['username'].lower() == str(user_id).lower():
                    return jsonify({
                        'id': acc['username'], 'username': acc['username'],
                        'access_number': None, 'reg_number': None,
                        'first_name': acc.get('full_name') or acc['username'], 'last_name': '',
                        'full_name': acc.get('full_name') or acc['username'],
                        'role': acc['role'], 'type': 'demo',
                    })
            return jsonify({'error': 'Demo user not found'}), 404
        rbac_engine = create_engine(RBAC_CONN_STRING)
        _ensure_app_users_table(rbac_engine)
        try:
            uid_int = int(user_id)
            df = pd.read_sql_query(
                text("SELECT id, username, role, full_name, faculty_id, department_id, created_by_username FROM app_users WHERE id = :uid"),
                rbac_engine, params={'uid': uid_int}
            )
        except (ValueError, TypeError):
            df = pd.DataFrame()
        if df.empty and str(user_id).strip():
            df = pd.read_sql_query(
                text("SELECT id, username, role, full_name, faculty_id, department_id, created_by_username FROM app_users WHERE LOWER(username) = :uname"),
                rbac_engine, params={'uname': str(user_id).strip().lower()}
            )
        rbac_engine.dispose()
        if df.empty:
            return jsonify({'error': 'User not found'}), 404
        row = df.iloc[0]
        uname = str(row['username']) if pd.notna(row['username']) else ''
        out = {
            'id': str(row['id']), 'username': uname,
            'access_number': None, 'reg_number': None,
            'first_name': str(row['full_name']) if pd.notna(row['full_name']) else uname,
            'last_name': '',
            'full_name': str(row['full_name']) if pd.notna(row['full_name']) else uname,
            'role': str(row['role']) if pd.notna(row['role']) else 'staff',
            'type': 'app_user',
            'faculty_id': int(row['faculty_id']) if pd.notna(row['faculty_id']) else None,
            'department_id': int(row['department_id']) if pd.notna(row['department_id']) else None,
            'created_by_username': str(row['created_by_username']) if pd.notna(row.get('created_by_username')) else None,
        }
        try:
            dw = create_engine(DATA_WAREHOUSE_CONN_STRING)
            if out.get('faculty_id'):
                fd = pd.read_sql_query(text("SELECT faculty_name FROM dim_faculty WHERE faculty_id = :fid"), dw, params={'fid': out['faculty_id']})
                out['faculty_name'] = fd.iloc[0]['faculty_name'] if not fd.empty else None
            else:
                out['faculty_name'] = None
            if out.get('department_id'):
                dd = pd.read_sql_query(text("SELECT department_name FROM dim_department WHERE department_id = :did"), dw, params={'did': out['department_id']})
                out['department_name'] = dd.iloc[0]['department_name'] if not dd.empty else None
            else:
                out['department_name'] = None
            dw.dispose()
        except Exception:
            out['faculty_name'] = None
            out['department_name'] = None
        return jsonify(out)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@user_mgmt_bp.route('/api/user-mgmt/users/app_user/<int:user_id>', methods=['PATCH'], strict_slashes=False)
@jwt_required()
def admin_update_user(user_id):
    err = _require_sysadmin()
    if err is not None:
        return err
    data = request.get_json() or {}
    allowed_roles = {'dean', 'hod', 'staff', 'hr', 'finance', 'analyst', 'sysadmin', 'senate'}
    role = (data.get('role') or '').strip().lower()
    if role and role not in allowed_roles:
        return jsonify({'error': f'Role must be one of: {", ".join(sorted(allowed_roles))}'}), 400
    faculty_id = data.get('faculty_id') if data.get('faculty_id') is not None else None
    department_id = data.get('department_id') if data.get('department_id') is not None else None
    if role == 'dean' and faculty_id is None:
        return jsonify({'error': 'Dean must be assigned to a faculty'}), 400
    if role == 'hod' and department_id is None:
        return jsonify({'error': 'HOD must be assigned to a department'}), 400
    if role == 'staff' and (data.get('faculty_id') is not None or data.get('department_id') is not None):
        eff_f = data.get('faculty_id') if 'faculty_id' in data else None
        eff_d = data.get('department_id') if 'department_id' in data else None
        if eff_f is None or eff_d is None:
            return jsonify({'error': 'Staff must be assigned to a faculty and a department'}), 400
    try:
        rbac_engine = create_engine(RBAC_CONN_STRING)
        _ensure_app_users_table(rbac_engine)
        with rbac_engine.connect() as conn:
            check = pd.read_sql_query(text("SELECT id, username, role, full_name, faculty_id, department_id FROM app_users WHERE id = :uid"), conn, params={'uid': user_id})
            if check.empty:
                rbac_engine.dispose()
                return jsonify({'error': 'User not found'}), 404
            current = check.iloc[0].to_dict()
            updates = []
            params = {'uid': user_id}
            if 'full_name' in data:
                full_name = (data.get('full_name') or '').strip() or (current.get('full_name') or current.get('username'))
                updates.append('full_name = :full_name')
                params['full_name'] = full_name
            if role:
                updates.append('role = :role')
                params['role'] = role
            if 'faculty_id' in data:
                updates.append('faculty_id = :faculty_id')
                params['faculty_id'] = faculty_id
            if 'department_id' in data:
                updates.append('department_id = :department_id')
                params['department_id'] = department_id
            password = (data.get('password') or '').strip()
            if password and len(password) >= 6:
                updates.append('password_hash = :password_hash')
                params['password_hash'] = generate_password_hash(password, method='pbkdf2:sha256')
            if not updates:
                rbac_engine.dispose()
                return jsonify({'message': 'No changes', 'username': str(current.get('username'))}), 200
            effective_role = role if role else (str(current.get('role')) if current.get('role') else '')
            def _safe_int(v):
                if v is None or (isinstance(v, float) and v != v):
                    return None
                try:
                    return int(v)
                except (TypeError, ValueError):
                    return None
            effective_faculty = params.get('faculty_id') if 'faculty_id' in data else _safe_int(current.get('faculty_id'))
            effective_dept = params.get('department_id') if 'department_id' in data else _safe_int(current.get('department_id'))
            if effective_role == 'dean' and effective_faculty is None:
                rbac_engine.dispose()
                return jsonify({'error': 'Dean must be assigned to a faculty'}), 400
            if effective_role == 'hod' and effective_dept is None:
                rbac_engine.dispose()
                return jsonify({'error': 'HOD must be assigned to a department'}), 400
            if effective_role == 'staff' and (effective_faculty is None or effective_dept is None):
                rbac_engine.dispose()
                return jsonify({'error': 'Staff must be assigned to a faculty and a department'}), 400
            if effective_role == 'dean' and effective_faculty is not None:
                conflict = pd.read_sql_query(
                    text("SELECT id FROM app_users WHERE role = 'dean' AND faculty_id = :fid AND id != :uid"),
                    conn, params={'fid': effective_faculty, 'uid': user_id}
                )
                if not conflict.empty:
                    rbac_engine.dispose()
                    return jsonify({'error': 'This faculty already has a dean assigned'}), 400
            if effective_role == 'hod' and effective_dept is not None:
                conflict = pd.read_sql_query(
                    text("SELECT id FROM app_users WHERE role = 'hod' AND department_id = :did AND id != :uid"),
                    conn, params={'did': effective_dept, 'uid': user_id}
                )
                if not conflict.empty:
                    rbac_engine.dispose()
                    return jsonify({'error': 'This department already has an HOD assigned'}), 400
            conn.execute(text(f"UPDATE app_users SET {', '.join(updates)} WHERE id = :uid"), params)
            conn.commit()
            try:
                from export_user_snapshot import run_export_user_snapshot_async
                run_export_user_snapshot_async()
            except Exception:
                pass
            updated = pd.read_sql_query(
                text("SELECT id, username, role, full_name, faculty_id, department_id FROM app_users WHERE id = :uid"),
                conn, params={'uid': user_id}
            )
            if not updated.empty:
                r = updated.iloc[0]
                _sync_dim_app_user('update', user_id, {
                    'username': str(r.get('username', '')),
                    'role': str(r.get('role', 'staff')),
                    'full_name': str(r.get('full_name') or r.get('username', '')),
                    'faculty_id': int(r['faculty_id']) if pd.notna(r.get('faculty_id')) else None,
                    'department_id': int(r['department_id']) if pd.notna(r.get('department_id')) else None,
                })
        rbac_engine.dispose()
        return jsonify({'message': 'User updated', 'id': user_id}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@user_mgmt_bp.route('/api/user-mgmt/users/app_user/<int:user_id>', methods=['DELETE'], strict_slashes=False)
@jwt_required()
def admin_delete_user(user_id):
    err = _require_sysadmin()
    if err is not None:
        return err
    try:
        rbac_engine = create_engine(RBAC_CONN_STRING)
        _ensure_app_users_table(rbac_engine)
        with rbac_engine.connect() as conn:
            result = conn.execute(text("DELETE FROM app_users WHERE id = :uid"), {'uid': user_id})
            conn.commit()
            if result.rowcount == 0:
                rbac_engine.dispose()
                return jsonify({'error': 'User not found'}), 404
        rbac_engine.dispose()
        _sync_dim_app_user('delete', user_id)
        try:
            from export_user_snapshot import run_export_user_snapshot_async
            run_export_user_snapshot_async()
        except Exception:
            pass
        return jsonify({'message': 'User deleted', 'id': user_id}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@user_mgmt_bp.route('/api/user-mgmt/users/reset-password', methods=['POST'], strict_slashes=False)
@jwt_required()
def admin_reset_app_user_password():
    err = _require_sysadmin()
    if err is not None:
        return err
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    new_password = (data.get('new_password') or '').strip()
    if not username:
        return jsonify({'error': 'Username is required'}), 400
    if len(new_password) < 6:
        return jsonify({'error': 'New password must be at least 6 characters'}), 400
    try:
        rbac_engine = create_engine(RBAC_CONN_STRING)
        _ensure_app_users_table(rbac_engine)
        with rbac_engine.connect() as conn:
            check = pd.read_sql_query(
                text("SELECT id FROM app_users WHERE LOWER(username) = :uname"),
                conn, params={'uname': username.lower()}
            )
            if check.empty:
                rbac_engine.dispose()
                return jsonify({'error': 'App user not found'}), 404
            uid = int(check.iloc[0]['id'])
            conn.execute(
                text("UPDATE app_users SET password_hash = :ph WHERE id = :uid"),
                {'ph': generate_password_hash(new_password, method='pbkdf2:sha256'), 'uid': uid}
            )
            conn.commit()
        rbac_engine.dispose()
        try:
            from export_user_snapshot import run_export_user_snapshot_async
            run_export_user_snapshot_async()
        except Exception:
            pass
        return jsonify({'message': 'Password reset successfully', 'username': username}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@user_mgmt_bp.route('/api/user-mgmt/users', methods=['POST'], strict_slashes=False)
@user_mgmt_bp.route('/api/sysadmin/users', methods=['POST'], strict_slashes=False)
@user_mgmt_bp.route('/api/admin/users', methods=['POST'], strict_slashes=False)
@jwt_required()
def admin_create_user():
    err = _require_sysadmin()
    if err is not None:
        return err
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = (data.get('password') or '').strip()
    role = (data.get('role') or 'staff').strip().lower()
    full_name = (data.get('full_name') or '').strip() or username
    faculty_id = data.get('faculty_id') if data.get('faculty_id') is not None else None
    department_id = data.get('department_id') if data.get('department_id') is not None else None
    if not username:
        return jsonify({'error': 'Username is required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    allowed_roles = {'dean', 'hod', 'staff', 'hr', 'finance', 'analyst', 'sysadmin', 'senate'}
    if role not in allowed_roles:
        return jsonify({'error': f'Role must be one of: {", ".join(sorted(allowed_roles))}'}), 400
    if role == 'dean' and faculty_id is None:
        return jsonify({'error': 'Dean must be assigned to a faculty'}), 400
    if role == 'hod' and department_id is None:
        return jsonify({'error': 'HOD must be assigned to a department'}), 400
    if role == 'staff' and (faculty_id is None or department_id is None):
        return jsonify({'error': 'Staff must be assigned to a faculty and a department'}), 400
    demo_usernames = {a['username'].lower() for a in DEMO_ACCOUNTS_FOR_LIST}
    if username.lower() in demo_usernames:
        return jsonify({'error': 'Username is reserved for a demo account'}), 400
    if role == 'dean' and faculty_id is not None and faculty_id in _faculty_ids_with_dean():
        return jsonify({'error': 'This faculty already has a dean assigned'}), 400
    if role == 'hod' and department_id is not None and department_id in _department_ids_with_hod():
        return jsonify({'error': 'This department already has an HOD assigned'}), 400
    try:
        try:
            from api.auth import _ensure_ucu_rbac_database
            _ensure_ucu_rbac_database()
        except Exception:
            pass
        rbac_engine = create_engine(RBAC_CONN_STRING)
        _ensure_app_users_table(rbac_engine)
        password_hash = generate_password_hash(password, method='pbkdf2:sha256')
        with rbac_engine.connect() as conn:
            dup = pd.read_sql_query(
                text(
                    """
                    SELECT 1 FROM app_users
                    WHERE LOWER(TRIM(username)) = LOWER(:uname)
                    LIMIT 1
                    """
                ),
                conn,
                params={'uname': username},
            )
            if not dup.empty:
                rbac_engine.dispose()
                return jsonify({'error': 'Username already exists'}), 409

            try:
                max_id_row = conn.execute(text("SELECT COALESCE(MAX(id), 0) AS max_id FROM app_users")).fetchone()
                max_id = int(max_id_row[0]) if max_id_row is not None else 0
                conn.execute(
                    text("SELECT setval(pg_get_serial_sequence('app_users', 'id'), :next_id, false)"),
                    {'next_id': max_id + 1},
                )
            except Exception:
                pass

            creator = (get_jwt().get('username') or '').strip() or None
            r = conn.execute(
                text("""
                    INSERT INTO app_users (username, password_hash, role, full_name, faculty_id, department_id, created_by_username)
                    VALUES (:username, :password_hash, :role, :full_name, :faculty_id, :department_id, :created_by_username)
                    RETURNING id
                """),
                {
                    'username': username,
                    'password_hash': password_hash,
                    'role': role,
                    'full_name': full_name,
                    'faculty_id': faculty_id,
                    'department_id': department_id,
                    'created_by_username': creator,
                },
            )
            row = r.fetchone()
            new_id = int(row[0]) if row and row[0] is not None else None
            conn.commit()
        rbac_engine.dispose()
        if new_id:
            _sync_dim_app_user('insert', new_id, {
                'username': username, 'role': role, 'full_name': full_name,
                'faculty_id': faculty_id, 'department_id': department_id, 'created_at': datetime.now(),
            })
        try:
            from export_user_snapshot import run_export_user_snapshot_async
            run_export_user_snapshot_async()
        except Exception:
            pass
        return jsonify({'message': 'User created successfully', 'username': username}), 201
    except Exception as e:
        msg = str(e)
        if 'Duplicate' in msg or 'UNIQUE' in msg or '1062' in msg:
            return jsonify({'error': 'Username already exists'}), 409
        return jsonify({'error': msg}), 500

def _faculty_ids_with_dean():
    try:
        rbac_engine = create_engine(RBAC_CONN_STRING)
        _ensure_app_users_table(rbac_engine)
        df = pd.read_sql_query(
            "SELECT DISTINCT faculty_id FROM app_users WHERE role = 'dean' AND faculty_id IS NOT NULL",
            rbac_engine
        )
        rbac_engine.dispose()
        return {int(r['faculty_id']) for _, r in df.iterrows() if pd.notna(r['faculty_id'])}
    except Exception:
        return set()

def _department_ids_with_hod():
    try:
        rbac_engine = create_engine(RBAC_CONN_STRING)
        _ensure_app_users_table(rbac_engine)
        df = pd.read_sql_query(
            "SELECT DISTINCT department_id FROM app_users WHERE role = 'hod' AND department_id IS NOT NULL",
            rbac_engine
        )
        rbac_engine.dispose()
        return {int(r['department_id']) for _, r in df.iterrows() if pd.notna(r['department_id'])}
    except Exception:
        return set()

@user_mgmt_bp.route('/api/user-mgmt/faculties', methods=['GET'], strict_slashes=False)
@user_mgmt_bp.route('/api/sysadmin/faculties', methods=['GET'], strict_slashes=False)
@user_mgmt_bp.route('/api/admin/faculties', methods=['GET'], strict_slashes=False)
@jwt_required()
def admin_list_faculties():
    err = _require_sysadmin()
    if err is not None:
        return err
    for_role = (request.args.get('for_role') or '').strip().lower()
    current_faculty_id = request.args.get('current_faculty_id', type=int)
    try:
        engine = get_dw_engine()
        df = pd.read_sql_query(
            "SELECT faculty_id, faculty_name FROM dim_faculty ORDER BY faculty_name",
            engine
        )
        engine.dispose()
        records = df.to_dict('records') if not df.empty else []
        if for_role == 'dean':
            assigned = _faculty_ids_with_dean()
            records = [r for r in records if r['faculty_id'] not in assigned or (current_faculty_id is not None and r['faculty_id'] == current_faculty_id)]
        return jsonify({'faculties': records})
    except Exception as e:
        return jsonify({'faculties': [], 'warning': str(e)}), 200

@user_mgmt_bp.route('/api/user-mgmt/departments', methods=['GET'], strict_slashes=False)
@user_mgmt_bp.route('/api/sysadmin/departments', methods=['GET'], strict_slashes=False)
@user_mgmt_bp.route('/api/admin/departments', methods=['GET'], strict_slashes=False)
@jwt_required()
def admin_list_departments():
    err = _require_sysadmin()
    if err is not None:
        return err
    faculty_id = request.args.get('faculty_id', type=int)
    for_role = (request.args.get('for_role') or '').strip().lower()
    current_department_id = request.args.get('current_department_id', type=int)
    try:
        engine = get_dw_engine()
        if faculty_id:
            df = pd.read_sql_query(
                text("SELECT department_id, department_name, faculty_id FROM dim_department WHERE faculty_id = :fid ORDER BY department_name"),
                engine, params={'fid': faculty_id}
            )
        else:
            df = pd.read_sql_query(
                "SELECT department_id, department_name, faculty_id FROM dim_department ORDER BY department_name",
                engine
            )
        engine.dispose()
        records = df.to_dict('records') if not df.empty else []
        if for_role == 'hod':
            assigned = _department_ids_with_hod()
            records = [r for r in records if r['department_id'] not in assigned or (current_department_id is not None and r['department_id'] == current_department_id)]
        return jsonify({'departments': records})
    except Exception as e:
        return jsonify({'departments': [], 'warning': str(e)}), 200

def _require_hod():
    claims = get_jwt()
    if (claims.get('role') or '').strip().lower() != 'hod':
        return jsonify({'error': 'HOD access required'}), 403
    if claims.get('department_id') is None:
        return jsonify({'error': 'HOD must be assigned to a department'}), 403
    return None

@user_mgmt_bp.route('/api/hod/department-courses', methods=['GET'], strict_slashes=False)
@jwt_required()
def hod_department_courses():
    err = _require_hod()
    if err is not None:
        return err
    dept_id = get_jwt().get('department_id')
    try:
        engine = get_dw_engine()
        df = pd.read_sql_query(text("""
            SELECT DISTINCT dc.course_code, dc.course_name
            FROM fact_enrollment fe
            JOIN dim_student ds ON fe.student_id = ds.student_id
            JOIN dim_program dp ON ds.program_id = dp.program_id
            JOIN dim_course dc ON fe.course_code = dc.course_code
            WHERE dp.department_id = :dept_id
            ORDER BY dc.course_name
        """), engine, params={'dept_id': dept_id})
        engine.dispose()
        courses = [{'course_code': r['course_code'], 'course_name': str(r['course_name']) if pd.notna(r['course_name']) else r['course_code']} for _, r in df.iterrows()]
        return jsonify({'courses': courses})
    except Exception as e:
        return jsonify({'error': str(e), 'courses': []}), 500

@user_mgmt_bp.route('/api/hod/staff-in-department', methods=['GET'], strict_slashes=False)
@jwt_required()
def hod_staff_in_department():
    err = _require_hod()
    if err is not None:
        return err
    dept_id = get_jwt().get('department_id')
    try:
        rbac_engine = create_engine(RBAC_CONN_STRING)
        _ensure_app_users_table(rbac_engine)
        df = pd.read_sql_query(text("""
            SELECT id, username, full_name, role, department_id
            FROM app_users WHERE role = 'staff' AND department_id = :dept_id
            ORDER BY full_name, username
        """), rbac_engine, params={'dept_id': dept_id})
        rbac_engine.dispose()
        staff = [{'id': int(r['id']), 'username': str(r['username']), 'full_name': str(r['full_name']) if pd.notna(r['full_name']) else str(r['username'])} for _, r in df.iterrows()]
        return jsonify({'staff': staff})
    except Exception as e:
        return jsonify({'error': str(e), 'staff': []}), 500

@user_mgmt_bp.route('/api/hod/staff-assignments/<int:staff_id>', methods=['GET'], strict_slashes=False)
@jwt_required()
def hod_get_staff_assignments(staff_id):
    err = _require_hod()
    if err is not None:
        return err
    dept_id = get_jwt().get('department_id')
    try:
        rbac_engine = create_engine(RBAC_CONN_STRING)
        _ensure_app_users_table(rbac_engine)
        check = pd.read_sql_query(text("SELECT id FROM app_users WHERE id = :uid AND role = 'staff' AND department_id = :dept_id"), rbac_engine, params={'uid': staff_id, 'dept_id': dept_id})
        if check.empty:
            rbac_engine.dispose()
            return jsonify({'error': 'Staff not found in your department'}), 404
        df = pd.read_sql_query(text("SELECT course_code FROM staff_course_assignments WHERE app_user_id = :uid"), rbac_engine, params={'uid': staff_id})
        rbac_engine.dispose()
        course_codes = [str(r['course_code']) for _, r in df.iterrows() if pd.notna(r['course_code'])]
        return jsonify({'course_codes': course_codes})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@user_mgmt_bp.route('/api/hod/staff-assignments/<int:staff_id>', methods=['PUT'], strict_slashes=False)
@jwt_required()
def hod_set_staff_assignments(staff_id):
    err = _require_hod()
    if err is not None:
        return err
    dept_id = get_jwt().get('department_id')
    data = request.get_json() or {}
    course_codes = data.get('course_codes')
    if course_codes is not None and not isinstance(course_codes, list):
        course_codes = [course_codes]
    course_codes = list(course_codes) if course_codes else []
    try:
        rbac_engine = create_engine(RBAC_CONN_STRING)
        _ensure_app_users_table(rbac_engine)
        with rbac_engine.connect() as conn:
            check = pd.read_sql_query(text("SELECT id FROM app_users WHERE id = :uid AND role = 'staff' AND department_id = :dept_id"), conn, params={'uid': staff_id, 'dept_id': dept_id})
            if check.empty:
                rbac_engine.dispose()
                return jsonify({'error': 'Staff not found in your department'}), 404
            conn.execute(text("DELETE FROM staff_course_assignments WHERE app_user_id = :uid"), {'uid': staff_id})
            for cc in course_codes:
                cc = str(cc).strip()[:50]
                if cc:
                    conn.execute(text("INSERT IGNORE INTO staff_course_assignments (app_user_id, course_code) VALUES (:uid, :cc)"), {'uid': staff_id, 'cc': cc})
            conn.commit()
        rbac_engine.dispose()
        return jsonify({'message': 'Assignments updated', 'staff_id': staff_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
