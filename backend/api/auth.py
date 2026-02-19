"""
Authentication API with RBAC support
Handles login, registration, profile management, and Access Number authentication
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity, get_jwt
from sqlalchemy import create_engine, text
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

from config import DATA_WAREHOUSE_CONN_STRING

try:
    from audit_log import log as audit_log
except ImportError:
    audit_log = None

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


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

@auth_bp.route('/login', methods=['POST'])
def login():
    """User login - supports Access Number for students, username/email for others"""
    try:
        data = request.get_json()
        identifier = data.get('identifier')  # Can be username, email, or Access Number
        password = data.get('password')
        
        if not identifier or not password:
            return jsonify({'error': 'Identifier and password required'}), 400
        
        identifier_lower = identifier.lower().strip()
        
        # Check if it's an Access Number (student login)
        if validate_access_number(identifier):
            # Student login with Access Number - check against student table
            engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
            import pandas as pd
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
                access_token = create_access_token(
                    identity=user_data['student_id'],
                    additional_claims={
                        'role': 'student',
                        'username': identifier.upper(),
                        'student_id': user_data['student_id'],
                        'access_number': user_data['access_number'],
                        'first_name': user_data.get('first_name', ''),
                        'last_name': user_data.get('last_name', '')
                    }
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
                        'first_name': user_data.get('first_name', ''),
                        'last_name': user_data.get('last_name', '')
                    }
                }), 200
        
        # Check if it's a username (non-student login)
        elif identifier_lower in DEMO_USERS:
            user_info = DEMO_USERS[identifier_lower]
            if user_info['password'] == password:
                # Create token for non-student user
                access_token = create_access_token(
                    identity=identifier_lower,
                    additional_claims={
                        'role': user_info['role'],
                        'username': identifier_lower,
                        'full_name': user_info['full_name']
                    }
                )
                refresh_token = create_refresh_token(identity=identifier_lower)
                _audit_log_login(identifier_lower, user_info['role'], 'success')
                return jsonify({
                    'access_token': access_token,
                    'refresh_token': refresh_token,
                    'role': user_info['role'],  # Add role at top level for frontend
                    'user': {
                        'id': identifier_lower,
                        'username': identifier_lower,
                        'role': user_info['role'],
                        'full_name': user_info['full_name']
                    }
                }), 200
        
        _audit_log_login(identifier_lower or identifier, None, 'failure', 'Invalid credentials')
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
        
        return jsonify({
            'id': claims.get('student_id') or claims.get('username'),
            'username': claims.get('username'),
            'role': claims.get('role'),
            'access_number': claims.get('access_number'),
            'reg_number': claims.get('reg_number'),
            'first_name': claims.get('first_name'),
            'last_name': claims.get('last_name'),
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """Update current user's profile"""
    try:
        data = request.get_json()
        claims = get_jwt()
        username = claims.get('username') or claims.get('access_number') or ''
        role_name = claims.get('role') or ''

        # In production, update database
        # For now, just return success
        if audit_log:
            audit_log('profile_update', 'profile', username=username, role_name=role_name, status='success')
        return jsonify({
            'message': 'Profile updated successfully',
            'user': {
                'id': claims.get('student_id') or claims.get('username'),
                'first_name': data.get('first_name', claims.get('first_name')),
                'last_name': data.get('last_name', claims.get('last_name')),
                'email': data.get('email', claims.get('email')),
                'phone': data.get('phone', claims.get('phone'))
            }
        }), 200
        
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

