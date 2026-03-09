"""
Authentication API with RBAC support
Handles login, registration, profile management, and Access Number authentication
"""
from flask import Blueprint, request, jsonify, send_file
from werkzeug.security import check_password_hash, generate_password_hash
import base64
import re
import json
from sqlalchemy import create_engine, text
import pandas as pd
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity, get_jwt
from sqlalchemy.orm import sessionmaker
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

try:
    from models.user import User, AuditLog
    from rbac import Role, has_permission, Resource, Permission
except ImportError:
    # Fallback if models not yet set up
    User = None
    AuditLog = None
    Role = None
    has_permission = None
    Resource = None
    Permission = None

from config import DATA_WAREHOUSE_CONN_STRING, PG_HOST, PG_PORT, PG_USER, PG_PASSWORD

try:
    from audit_log import log as audit_log
except ImportError:
    audit_log = None

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

PROFILE_PHOTOS_DIR = backend_dir / 'data' / 'profile_photos'
PROFILE_PHOTOS_DIR.mkdir(parents=True, exist_ok=True)


def _profile_photo_path(identity):
    """Safe filename from JWT identity."""
    if not identity:
        return None
    safe = re.sub(r'[^\w\-.]', '_', str(identity).strip())[:64]
    return PROFILE_PHOTOS_DIR / f"{safe}.jpg" if safe else None


def _has_profile_photo(identity):
    p = _profile_photo_path(identity)
    return p and p.exists()


def _audit_log_login(username, role_name, status='success', error_message=None):
    """Write login event to ucu_rbac.audit_logs if available. Silently skip on failure."""
    try:
        rbac_conn = DATA_WAREHOUSE_CONN_STRING.replace('UCU_DataWarehouse', 'ucu_rbac')
        engine = create_engine(rbac_conn)
        with engine.connect() as conn:
            conn.execute(text("""
                INSERT INTO audit_logs (username, role_name, action, resource, status, error_message)
                VALUES (:username, :role_name, 'login', 'auth', :status, :error_message)
            """), {
                'username': username or '',
                'role_name': role_name or '',
                'status': status,
                'error_message': error_message,
            })
            conn.commit()
        engine.dispose()
    except Exception:
        pass

# Database connection for RBAC
RBAC_DB_NAME = "ucu_rbac"
RBAC_CONN_STRING = DATA_WAREHOUSE_CONN_STRING.replace("UCU_DataWarehouse", RBAC_DB_NAME)


def _ensure_ucu_rbac_database():
    """Create ucu_rbac database if it does not exist (PostgreSQL)."""
    try:
        from pg_helpers import ensure_ucu_rbac_database
        ensure_ucu_rbac_database()
    except Exception:
        pass


def _ensure_user_profiles_table(engine):
    """
    Ensure user_profiles table exists in ucu_rbac.
    Stores per-user profile details so they persist across logins/devices.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS user_profiles (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(100) NOT NULL UNIQUE,
                    role VARCHAR(50),
                    first_name VARCHAR(100),
                    last_name VARCHAR(100),
                    email VARCHAR(255),
                    phone VARCHAR(20),
                    profile_picture_url VARCHAR(255),
                    preferences TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_up_username ON user_profiles(username)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_up_role ON user_profiles(role)"))
            conn.commit()
    except Exception:
        pass


def _ensure_user_state_table(engine):
    """
    Ensure user_state table exists in ucu_rbac.
    Stores arbitrary per-user page/workspace state (e.g. NextGen Query).
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS user_state (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(100) NOT NULL,
                    role VARCHAR(50) NOT NULL,
                    state_key VARCHAR(100) NOT NULL,
                    state_json TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (username, role, state_key)
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_us_username ON user_state(username)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_us_role ON user_state(role)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_us_state_key ON user_state(state_key)"))
            conn.commit()
    except Exception:
        pass


def _load_user_profile(username: str, role_name: str) -> dict:
    """
    Load persisted user profile fields (first_name, last_name, email, phone, profile_picture_url)
    from ucu_rbac.user_profiles.
    Returns a dict with any fields that exist, or {} on error/none.
    """
    try:
        username = (username or "").strip()
        if not username:
            return {}
        _ensure_ucu_rbac_database()
        engine = create_engine(RBAC_CONN_STRING)
        _ensure_user_profiles_table(engine)
        df = pd.read_sql_query(
            text(
                "SELECT first_name, last_name, email, phone, profile_picture_url "
                "FROM user_profiles WHERE username = :uname"
            ),
            engine,
            params={"uname": username},
        )
        engine.dispose()
        if df.empty:
            return {}
        row = df.iloc[0]
        profile = {}
        for key in ("first_name", "last_name", "email", "phone", "profile_picture_url"):
            if key in df.columns and pd.notna(row.get(key)):
                profile[key] = str(row[key])
        return profile
    except Exception:
        return {}


def _ensure_app_users_table(engine):
    """Create app_users table if not present (ucu_rbac DB should already exist)."""
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

def validate_access_number(access_number: str) -> bool:
    """Validate Access Number format: A##### or B#####"""
    import re
    pattern = r'^[AB]\d{5}$'
    return bool(re.match(pattern, access_number))

def get_db_session():
    """Get database session"""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    engine = create_engine(RBAC_CONN_STRING)
    Session = sessionmaker(bind=engine)
    return Session()

# Demo users for non-student authentication (replace with database lookup in production)
DEMO_USERS = {
    'admin': {'password': 'admin123', 'role': 'sysadmin', 'full_name': 'System Administrator'},
    'analyst': {'password': 'analyst123', 'role': 'analyst', 'full_name': 'Data Analyst'},
    'senate': {'password': 'senate123', 'role': 'senate', 'full_name': 'Senate Member'},
    'staff': {'password': 'staff123', 'role': 'staff', 'full_name': 'Staff Member'},
    'dean': {'password': 'dean123', 'role': 'dean', 'full_name': 'Faculty Dean'},
    'hod': {'password': 'hod123', 'role': 'hod', 'full_name': 'Head of Department'},
    'hr': {'password': 'hr123', 'role': 'hr', 'full_name': 'HR Manager'},
    'finance': {'password': 'finance123', 'role': 'finance', 'full_name': 'Finance Manager'},
}

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh_token():
    """
    Issue a fresh short-lived access token from a valid refresh token.
    Called silently by the frontend every 10 minutes to keep the session alive.
    Returns 401/422 when the refresh token is expired or invalid, triggering frontend logout.
    """
    try:
        identity = get_jwt_identity()
        claims   = get_jwt()

        # Rebuild additional claims (excluding JWT-standard fields)
        _skip = {'sub', 'iat', 'nbf', 'jti', 'exp', 'type', 'fresh'}
        additional = {k: v for k, v in claims.items() if k not in _skip}

        new_access_token = create_access_token(identity=identity, additional_claims=additional)
        return jsonify({'access_token': new_access_token}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """User login - supports Access Number for students, username/email for others, and all app_users."""
    try:
        data = request.get_json(silent=True)
        if not data and request.get_data():
            try:
                import json
                data = json.loads(request.get_data(as_text=True))
            except Exception:
                data = {}
        data = data or {}
        identifier = str(data.get('identifier') or '').strip()
        password = str(data.get('password') or '').strip()
        
        if not identifier or not password:
            return jsonify({'error': 'Identifier and password required'}), 400
        
        identifier_lower = identifier.lower()
        
        # Demo admin: always allow login (no DB required) so Admin Console is reachable even if DB fails
        if identifier_lower == 'admin' and password == 'admin123':
            claims = {
                'role': 'sysadmin',
                'username': 'admin',
                'full_name': 'System Administrator',
                'first_name': 'System',
                'last_name': 'Administrator',
            }
            access_token = create_access_token(identity='admin', additional_claims=claims)
            refresh_token = create_refresh_token(identity='admin')
            _audit_log_login('admin', 'sysadmin', 'success')
            return jsonify({
                'access_token': access_token,
                'refresh_token': refresh_token,
                'role': 'sysadmin',
                'user': {
                    'id': 'admin',
                    'username': 'admin',
                    'role': 'sysadmin',
                    'full_name': 'System Administrator',
                    'first_name': 'System',
                    'last_name': 'Administrator',
                }
            }), 200

        # Demo users (hr, dean, hod, analyst, etc.): only allow with their fixed demo password
        if identifier_lower in DEMO_USERS:
            demo = DEMO_USERS[identifier_lower]
            if password == demo['password']:
                role_str = demo['role']
                full_name = demo.get('full_name', '')
                first_name = full_name.split()[0] if full_name else ''
                last_name = ' '.join(full_name.split()[1:]) if full_name and len(full_name.split()) > 1 else ''
                claims = {
                    'role': role_str,
                    'username': identifier_lower,
                    'full_name': full_name,
                    'first_name': first_name,
                    'last_name': last_name,
                }
                profile_override = _load_user_profile(identifier_lower, role_str)
                for key in ('first_name', 'last_name', 'email', 'phone'):
                    if key in profile_override:
                        claims[key] = profile_override[key]
                access_token = create_access_token(identity=identifier_lower, additional_claims=claims)
                refresh_token = create_refresh_token(identity=identifier_lower)
                _audit_log_login(identifier_lower, role_str, 'success')
                return jsonify({
                    'access_token': access_token,
                    'refresh_token': refresh_token,
                    'role': role_str,
                    'user': {
                        'id': identifier_lower,
                        'username': identifier_lower,
                        'role': role_str,
                        'full_name': claims.get('full_name'),
                        'first_name': claims.get('first_name', first_name),
                        'last_name': claims.get('last_name', last_name),
                        'email': claims.get('email'),
                        'phone': claims.get('phone'),
                        'profile_picture_url': profile_override.get('profile_picture_url'),
                    }
                }), 200
            _audit_log_login(identifier_lower, demo['role'], 'failure', 'Invalid password')
            return jsonify({'error': 'Invalid credentials. Demo user must use the correct password (e.g. hr123 for hr, dean123 for dean).'}), 401

        # Default app user: always allow login (no DB required) so app-user login works even if DB fails
        if identifier_lower == 'cemputus' and password == 'cen123':
            username_str = 'Cemputus'
            role_str = 'staff'
            claims = {
                'role': role_str,
                'username': username_str,
                'full_name': 'Emmanuel Nsubuga',
                'first_name': 'Emmanuel',
                'last_name': 'Nsubuga',
                'faculty_id': 1,
                'department_id': 1,
            }
            access_token = create_access_token(identity=username_str, additional_claims=claims)
            refresh_token = create_refresh_token(identity=username_str)
            _audit_log_login(username_str, role_str, 'success')
            return jsonify({
                'access_token': access_token,
                'refresh_token': refresh_token,
                'role': role_str,
                'user': {
                    'id': '1',
                    'username': username_str,
                    'role': role_str,
                    'full_name': 'Emmanuel Nsubuga',
                    'first_name': 'Emmanuel',
                    'last_name': 'Nsubuga',
                    'faculty_id': 1,
                    'department_id': 1,
                }
            }), 200
        
        # Check if it's an Access Number (student login)
        if validate_access_number(identifier):
            # Student login with Access Number - check against student table
            engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
            result = pd.read_sql_query(
                text("SELECT student_id, access_number, reg_no, first_name, last_name FROM dim_student WHERE access_number = :access_number"),
                engine,
                params={'access_number': identifier.upper()}
            )
            engine.dispose()
            
            if not result.empty:
                # Password format: {access_number}@ucu
                expected_password = f"{identifier.upper()}@ucu"
                if password != expected_password:
                    return jsonify({'error': 'Invalid credentials'}), 401
                
                user_data = result.iloc[0]

                # Start with claims from warehouse
                claims = {
                    'role': 'student',
                    'username': identifier.upper(),
                    'student_id': user_data['student_id'],
                    'access_number': user_data['access_number'],
                    'reg_number': user_data.get('reg_no', ''),
                    'first_name': user_data.get('first_name', ''),
                    'last_name': user_data.get('last_name', '')
                }

                # Overlay any persisted profile fields so names/email/phone/picture survive across logins
                profile_override = _load_user_profile(identifier.upper(), 'student')
                for key in ('first_name', 'last_name', 'email', 'phone'):
                    if key in profile_override:
                        claims[key] = profile_override[key]

                access_token = create_access_token(
                    identity=user_data['student_id'],
                    additional_claims=claims
                )
                refresh_token = create_refresh_token(identity=user_data['student_id'])
                
                _audit_log_login(identifier.upper(), 'student', 'success')
                return jsonify({
                    'access_token': access_token,
                    'refresh_token': refresh_token,
                    'role': 'student',  # Add role at top level for frontend
                    'user': {
                        'id': user_data['student_id'],
                        'username': identifier.upper(),
                        'role': 'student',
                        'access_number': user_data['access_number'],
                        'reg_number': user_data.get('reg_no', ''),
                        'first_name': claims.get('first_name', user_data.get('first_name', '')),
                        'last_name': claims.get('last_name', user_data.get('last_name', '')),
                        'email': claims.get('email'),
                        'phone': claims.get('phone'),
                        'profile_picture_url': profile_override.get('profile_picture_url')
                    }
                }), 200
        
        # Check app_users (every user admin added or will add) — try twice so DB not ready is retried
        for attempt in (1, 2):
            try:
                _ensure_ucu_rbac_database()
                rbac_engine = create_engine(RBAC_CONN_STRING)
                _ensure_app_users_table(rbac_engine)
                # Match by lowercase trimmed username so stored "Wanja " or "wanja" both match
                result = pd.read_sql_query(
                    text("""
                        SELECT id, username, password_hash, role, full_name, faculty_id, department_id
                        FROM app_users
                        WHERE LOWER(TRIM(username)) = :uname
                    """),
                    rbac_engine,
                    params={'uname': identifier_lower}
                )
                rbac_engine.dispose()
                if result.empty:
                    if attempt == 2:
                        try:
                            _ensure_ucu_rbac_database()
                            diag_engine = create_engine(RBAC_CONN_STRING)
                            _ensure_app_users_table(diag_engine)
                            count_df = pd.read_sql_query(text("SELECT COUNT(*) AS n FROM app_users"), diag_engine)
                            n = int(count_df['n'].iloc[0]) if not count_df.empty else 0
                            if n > 0:
                                names_df = pd.read_sql_query(text("SELECT username FROM app_users ORDER BY username LIMIT 20"), diag_engine)
                                names = list(names_df['username'].astype(str)) if not names_df.empty else []
                                print(f"Login: no app_user matched '{identifier_lower}'. Table has {n} user(s). Sample usernames: {names}")
                            else:
                                print(f"Login: no app_user found for '{identifier_lower}'. Table app_users is empty. Add users in Admin → Users.")
                            diag_engine.dispose()
                        except Exception as diag_err:
                            print(f"Login: no app_user for '{identifier_lower}'. Diagnostic failed: {diag_err}")
                    break
                row = result.iloc[0]
                password_hash = row['password_hash']
                uname = str(row['username']).strip()

                # App users must have a valid stored password (set by Admin). No auto-set or accept-any-password.
                ph_str = str(password_hash or '').strip()
                has_valid_hash = ph_str.startswith('pbkdf2:sha256:')
                if not has_valid_hash:
                    role_for_audit = str(row['role']) if pd.notna(row['role']) else 'staff'
                    _audit_log_login(uname, role_for_audit, 'failure', 'No password set')
                    return jsonify({
                        'error': 'Account not active. Contact your admin to set your password in Admin → Users.'
                    }), 401

                # Strict password check: only allow if stored hash matches. No reset on mismatch.
                try:
                    password_ok = check_password_hash(str(password_hash).strip(), password)
                except Exception:
                    password_ok = False
                if not password_ok:
                    role_for_audit = str(row['role']) if pd.notna(row['role']) else 'staff'
                    _audit_log_login(uname, role_for_audit, 'failure', 'Invalid password')
                    return jsonify({'error': 'Invalid credentials'}), 401

                username_str = str(row['username']).strip()
                role_str = (str(row['role']).strip() if pd.notna(row['role']) else 'staff').lower()

                # Base claims from app_users row
                claims = {
                    'role': role_str,
                    'username': username_str,
                    'full_name': str(row['full_name']).strip() if pd.notna(row['full_name']) else username_str,
                    'first_name': '',
                    'last_name': '',
                }
                if pd.notna(row['faculty_id']):
                    claims['faculty_id'] = int(row['faculty_id'])
                if pd.notna(row['department_id']):
                    claims['department_id'] = int(row['department_id'])
                full = (claims.get('full_name') or '').strip()
                if full:
                    parts = full.split(None, 1)
                    claims['first_name'] = parts[0]
                    claims['last_name'] = parts[1] if len(parts) > 1 else ''

                # Overlay any persisted profile fields so names/email/phone/picture survive across logins
                profile_override = _load_user_profile(username_str, role_str)
                for key in ('first_name', 'last_name', 'email', 'phone'):
                    if key in profile_override:
                        claims[key] = profile_override[key]

                access_token = create_access_token(identity=username_str, additional_claims=claims)
                refresh_token = create_refresh_token(identity=username_str)
                _audit_log_login(username_str, claims['role'], 'success')
                return jsonify({
                    'access_token': access_token,
                    'refresh_token': refresh_token,
                    'role': claims['role'],
                    'user': {
                        'id': str(row['id']),
                        'username': username_str,
                        'role': claims['role'],
                        'full_name': claims.get('full_name'),
                        'first_name': claims.get('first_name', ''),
                        'last_name': claims.get('last_name', ''),
                        'email': claims.get('email'),
                        'phone': claims.get('phone'),
                        'profile_picture_url': profile_override.get('profile_picture_url'),
                        'faculty_id': claims.get('faculty_id'),
                        'department_id': claims.get('department_id'),
                    }
                }), 200
            except Exception as e:
                import traceback
                print(f"App user login attempt {attempt} error (ucu_rbac / app_users): {e}")
                traceback.print_exc()
                if attempt == 2:
                    break
                # Retry once after re-ensuring DB
                continue

        # No auto-create of new users: roles are set by Admin when creating users.
        # Only users already in app_users (created in Admin → Users with correct role) can log in.

        # Fallback: default app user (Cemputus / cen123) — ensure they exist and allow login even if DB failed earlier
        if identifier_lower == 'cemputus' and password == 'cen123':
            try:
                _ensure_ucu_rbac_database()
                rbac_engine = create_engine(RBAC_CONN_STRING)
                _ensure_app_users_table(rbac_engine)
                ph = generate_password_hash('cen123', method='pbkdf2:sha256')
                with rbac_engine.connect() as conn:
                    r = pd.read_sql_query(text("SELECT id, username, role, full_name, faculty_id, department_id FROM app_users WHERE LOWER(username) = 'cemputus'"), conn)
                    if not r.empty:
                        conn.execute(text("UPDATE app_users SET password_hash = :ph, full_name = 'Emmanuel Nsubuga', role = 'staff', faculty_id = 1, department_id = 1 WHERE LOWER(username) = 'cemputus'"), {'ph': ph})
                    else:
                        conn.execute(text("""
                            INSERT INTO app_users (username, password_hash, role, full_name, faculty_id, department_id)
                            VALUES ('Cemputus', :ph, 'staff', 'Emmanuel Nsubuga', 1, 1)
                        """), {'ph': ph})
                    conn.commit()
                    # Re-fetch to get id and any existing values
                    row = pd.read_sql_query(text("SELECT id, username, role, full_name, faculty_id, department_id FROM app_users WHERE LOWER(username) = 'cemputus'"), conn).iloc[0]
                rbac_engine.dispose()
                username_str = 'Cemputus'
                role_str = 'staff'
                claims = {'role': role_str, 'username': username_str, 'full_name': 'Emmanuel Nsubuga', 'first_name': 'Emmanuel', 'last_name': 'Nsubuga', 'faculty_id': 1, 'department_id': 1}
                access_token = create_access_token(identity=username_str, additional_claims=claims)
                refresh_token = create_refresh_token(identity=username_str)
                _audit_log_login(username_str, role_str, 'success')
                return jsonify({
                    'access_token': access_token,
                    'refresh_token': refresh_token,
                    'role': role_str,
                    'user': {
                        'id': str(row['id']),
                        'username': username_str,
                        'role': role_str,
                        'full_name': 'Emmanuel Nsubuga',
                        'first_name': 'Emmanuel',
                        'last_name': 'Nsubuga',
                        'faculty_id': 1,
                        'department_id': 1,
                    }
                }), 200
            except Exception as fallback_err:
                import traceback
                print(f"Default app user (Cemputus) fallback failed: {fallback_err}")
                traceback.print_exc()

        print(f"Login: invalid credentials for '{identifier_lower}' (not in app_users or demo).")
        _audit_log_login(identifier_lower or identifier, '', 'failure', 'Invalid credentials')
        return jsonify({'error': 'Invalid credentials'}), 401
        
    except Exception as e:
        import traceback
        print(f"Login error: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token"""
    try:
        user_id = get_jwt_identity()
        claims = get_jwt()
        
        access_token = create_access_token(
            identity=user_id,
            additional_claims=claims
        )
        
        return jsonify({'access_token': access_token}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Get current user's profile"""
    try:
        claims = get_jwt()
        identity = get_jwt_identity()
        profile_picture_url = '/api/auth/profile/photo' if _has_profile_photo(identity) else None

        username = claims.get('username') or claims.get('access_number') or ''
        role_name = claims.get('role') or ''

        # Start with values from JWT claims
        profile = {
            'id': claims.get('student_id') or claims.get('username'),
            'username': claims.get('username'),
            'role': role_name,
            'access_number': claims.get('access_number'),
            'reg_number': claims.get('reg_number'),
            'first_name': claims.get('first_name'),
            'last_name': claims.get('last_name'),
            'email': claims.get('email'),
            'phone': claims.get('phone'),
            'profile_picture_url': profile_picture_url,
        }

        # Overlay any persisted profile data from ucu_rbac.user_profiles
        try:
            if username:
                _ensure_ucu_rbac_database()
                engine = create_engine(RBAC_CONN_STRING)
                _ensure_user_profiles_table(engine)
                df = pd.read_sql_query(
                    text("SELECT first_name, last_name, email, phone, profile_picture_url FROM user_profiles WHERE username = :uname"),
                    engine,
                    params={'uname': username},
                )
                engine.dispose()
                if not df.empty:
                    row = df.iloc[0]
                    if pd.notna(row.get('first_name')):
                        profile['first_name'] = str(row['first_name'])
                    if pd.notna(row.get('last_name')):
                        profile['last_name'] = str(row['last_name'])
                    if pd.notna(row.get('email')):
                        profile['email'] = str(row['email'])
                    if pd.notna(row.get('phone')):
                        profile['phone'] = str(row['phone'])
                    if pd.notna(row.get('profile_picture_url')):
                        profile['profile_picture_url'] = str(row['profile_picture_url'])
        except Exception:
            # If profile DB is unavailable, fall back to claims only
            pass

        return jsonify(profile), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """Update current user's profile (including optional profile picture as base64 data URL)."""
    try:
        data = request.get_json() or {}
        claims = get_jwt()
        identity = get_jwt_identity()
        username = claims.get('username') or claims.get('access_number') or ''
        role_name = claims.get('role') or ''

        # Optional: remove profile picture
        profile_picture_url = None
        if _has_profile_photo(identity):
            profile_picture_url = '/api/auth/profile/photo'
        if data.get('remove_profile_photo'):
            path = _profile_photo_path(identity)
            if path and path.exists():
                try:
                    path.unlink()
                except Exception:
                    pass
            profile_picture_url = None
        raw = data.get('profile_picture')
        if raw and not data.get('remove_profile_photo'):
            try:
                if isinstance(raw, str) and raw.startswith('data:'):
                    # data:image/jpeg;base64,<payload>
                    raw = raw.split(',', 1)[-1]
                buf = base64.b64decode(raw, validate=True)
                path = _profile_photo_path(identity)
                if path and len(buf) < 5 * 1024 * 1024:  # max 5MB
                    with open(path, 'wb') as f:
                        f.write(buf)
                    profile_picture_url = '/api/auth/profile/photo'
            except Exception:
                pass

        if audit_log:
            audit_log('profile_update', 'profile', username=username, role_name=role_name, status='success')

        # Persist profile fields to ucu_rbac.user_profiles so they survive logout/login and across devices
        try:
            if username:
                _ensure_ucu_rbac_database()
                engine = create_engine(RBAC_CONN_STRING)
                _ensure_user_profiles_table(engine)
                first_name = data.get('first_name', claims.get('first_name'))
                last_name = data.get('last_name', claims.get('last_name'))
                email = data.get('email', claims.get('email'))
                phone = data.get('phone', claims.get('phone'))
                with engine.connect() as conn:
                    conn.execute(
                        text(
                            """
                        INSERT INTO user_profiles (username, role, first_name, last_name, email, phone, profile_picture_url)
                        VALUES (:username, :role, :first_name, :last_name, :email, :phone, :pp)
                        ON CONFLICT (username) DO UPDATE SET
                            first_name = EXCLUDED.first_name,
                            last_name = EXCLUDED.last_name,
                            email = EXCLUDED.email,
                            phone = EXCLUDED.phone,
                            profile_picture_url = EXCLUDED.profile_picture_url
                        """
                        ),
                        {
                            'username': username,
                            'role': role_name,
                            'first_name': first_name,
                            'last_name': last_name,
                            'email': email,
                            'phone': phone,
                            'pp': profile_picture_url,
                        },
                    )
                    conn.commit()
                engine.dispose()
                try:
                    from export_user_snapshot import run_export_user_snapshot_async
                    run_export_user_snapshot_async()
                except Exception:
                    pass
        except Exception:
            # If profile DB is unavailable, still return success with in-memory update
            pass

        user_payload = {
            'id': claims.get('student_id') or claims.get('username'),
            'first_name': data.get('first_name', claims.get('first_name')),
            'last_name': data.get('last_name', claims.get('last_name')),
            'email': data.get('email', claims.get('email')),
            'phone': data.get('phone', claims.get('phone')),
            'profile_picture_url': profile_picture_url,
        }
        return jsonify({'message': 'Profile updated successfully', 'user': user_payload}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/state/<state_key>', methods=['GET', 'PUT'])
@jwt_required()
def user_state(state_key):
    """
    Per-user persistent UI/workspace state (e.g. NextGen Query).
    - GET:  returns {'state': {...}} or {'state': None}
    - PUT:  body {'state': {...}} to upsert
    """
    try:
        # Simple validation to avoid abuse
        state_key = (state_key or '').strip()
        if not state_key or len(state_key) > 100 or not re.match(r'^[\w\-]+$', state_key):
            return jsonify({'error': 'Invalid state key'}), 400

        claims = get_jwt()
        username = claims.get('username') or claims.get('access_number') or ''
        role_name = claims.get('role') or ''
        if not username:
            return jsonify({'state': None}), 200

        _ensure_ucu_rbac_database()
        engine = create_engine(RBAC_CONN_STRING)
        _ensure_user_state_table(engine)

        if request.method == 'GET':
            try:
                df = pd.read_sql_query(
                    text(
                        "SELECT state_json FROM user_state WHERE username = :uname AND role = :role AND state_key = :skey"
                    ),
                    engine,
                    params={'uname': username, 'role': role_name, 'skey': state_key},
                )
                engine.dispose()
                if df.empty:
                    return jsonify({'state': None}), 200
                raw = df.iloc[0]['state_json']
                try:
                    state_obj = json.loads(raw) if isinstance(raw, str) else None
                except Exception:
                    state_obj = None
                return jsonify({'state': state_obj}), 200
            except Exception:
                engine.dispose()
                return jsonify({'state': None}), 200

        # PUT: save state
        body = request.get_json(silent=True) or {}
        state = body.get('state')
        if state is None:
            engine.dispose()
            return jsonify({'error': 'Missing state payload'}), 400
        try:
            state_json = json.dumps(state)
        except Exception:
            engine.dispose()
            return jsonify({'error': 'State must be JSON-serializable'}), 400

        try:
            with engine.connect() as conn:
                conn.execute(
                    text(
                        """
                    INSERT INTO user_state (username, role, state_key, state_json)
                    VALUES (:username, :role, :skey, :state_json)
                    ON CONFLICT (username, role, state_key) DO UPDATE SET state_json = EXCLUDED.state_json
                    """
                    ),
                    {
                        'username': username,
                        'role': role_name,
                        'skey': state_key,
                        'state_json': state_json,
                    },
                )
                conn.commit()
            engine.dispose()
            return jsonify({'ok': True}), 200
        except Exception as e:
            engine.dispose()
            return jsonify({'error': str(e)}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/profile/photo', methods=['GET'])
@jwt_required()
def get_profile_photo():
    """Serve current user's profile photo."""
    try:
        identity = get_jwt_identity()
        path = _profile_photo_path(identity)
        if not path or not path.exists():
            return jsonify({'error': 'No profile photo'}), 404
        return send_file(path, mimetype='image/jpeg', last_modified=path.stat().st_mtime)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/audit-event', methods=['POST'])
@jwt_required()
def audit_event():
    """Record a client-side audit event (page view, filter applied, etc.). Body: { action, resource, resource_id? }."""
    try:
        data = request.get_json() or {}
        action = data.get('action') or 'unknown'
        resource = data.get('resource') or 'app'
        resource_id = data.get('resource_id')
        claims = get_jwt()
        username = claims.get('username') or claims.get('access_number') or ''
        role_name = claims.get('role') or ''
        if audit_log:
            audit_log(action, resource, username=username, role_name=role_name, resource_id=resource_id, status='success')
        return jsonify({'ok': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """Logout user"""
    try:
        claims = get_jwt()
        username = claims.get('username') or claims.get('access_number') or ''
        role_name = claims.get('role') or ''
        if audit_log:
            audit_log('logout', 'auth', username=username, role_name=role_name, status='success')
        return jsonify({'message': 'Logged out successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

