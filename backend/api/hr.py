from datetime import datetime

import pandas as pd
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, verify_jwt_in_request
from sqlalchemy import create_engine, text

from config.connection import (
    RBAC_DB_NAME,
    DATA_WAREHOUSE_CONN_STRING,
    get_sqlalchemy_conn_string,
)
from db_engines import get_dw_engine

hr_bp = Blueprint('hr', __name__, url_prefix='/api/hr')

RBAC_CONN_STRING = get_sqlalchemy_conn_string(RBAC_DB_NAME)

_LEAVE_DIRECTORY_ROLES = frozenset(
    {'staff', 'hod', 'dean', 'senate', 'finance', 'hr', 'analyst', 'sysadmin', 'admin'}
)

def _ensure_app_users_table(engine):
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

def _ensure_leave_requests_table(engine):
    try:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS leave_requests (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(100) NOT NULL,
                    start_date DATE NOT NULL,
                    end_date DATE NOT NULL,
                    reason TEXT NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    request_type VARCHAR(20) NOT NULL DEFAULT 'new',
                    parent_leave_id INT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    reviewed_at TIMESTAMP NULL,
                    reviewed_by VARCHAR(100) NULL
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_lr_username ON leave_requests(username)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_lr_status_dates ON leave_requests(status, start_date, end_date)"))
            conn.commit()
    except Exception:
        pass

def _leave_can_view_directory() -> bool:
    return (get_jwt().get('role') or '').strip().lower() in _LEAVE_DIRECTORY_ROLES

def _leave_can_review_requests() -> bool:
    return (get_jwt().get('role') or '').strip().lower() in ('hr', 'sysadmin', 'admin')

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

@hr_bp.route('/staff-list', methods=['GET'], strict_slashes=False)
@jwt_required()
def hr_staff_list():
    claims = get_jwt()
    if (claims.get('role') or '').strip().lower() != 'hr':
        return jsonify({'error': 'HR access required'}), 403
    staff = []
    try:
        rbac_engine = create_engine(RBAC_CONN_STRING)
        _ensure_app_users_table(rbac_engine)
        df = pd.read_sql_query(
            text("""
                SELECT id, username, full_name, role, faculty_id, department_id, created_at
                FROM app_users
                WHERE LOWER(role) <> 'student'
                ORDER BY full_name, username
            """),
            rbac_engine,
        )
        rbac_engine.dispose()

        try:
            dw_engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
            fac_df = pd.read_sql_query("SELECT faculty_id, faculty_name FROM dim_faculty", dw_engine)
            dept_df = pd.read_sql_query("SELECT department_id, department_name FROM dim_department", dw_engine)
            dw_engine.dispose()
            fac_map = {int(r['faculty_id']): str(r['faculty_name']) for _, r in fac_df.iterrows() if pd.notna(r.get('faculty_id'))}
            dept_map = {int(r['department_id']): str(r['department_name']) for _, r in dept_df.iterrows() if pd.notna(r.get('department_id'))}
        except Exception:
            fac_map, dept_map = {}, {}

        for _, r in df.iterrows():
            fid = int(r['faculty_id']) if pd.notna(r.get('faculty_id')) else None
            did = int(r['department_id']) if pd.notna(r.get('department_id')) else None
            staff.append({
                'id': int(r['id']) if pd.notna(r.get('id')) else None,
                'username': str(r['username']) if pd.notna(r.get('username')) else '',
                'full_name': str(r['full_name']) if pd.notna(r.get('full_name')) else str(r.get('username') or ''),
                'role': str(r['role']) if pd.notna(r.get('role')) else '',
                'faculty_id': fid,
                'faculty_name': fac_map.get(fid),
                'department_id': did,
                'department_name': dept_map.get(did),
                'source': 'app_user',
                'created_at': r['created_at'].isoformat() if hasattr(r.get('created_at'), 'isoformat') else None,
            })

        demo_usernames = {s['username'].lower() for s in staff if s.get('username')}
        for acc in DEMO_ACCOUNTS:
            uname = (acc.get('username') or '').strip()
            if not uname or uname.lower() in demo_usernames or (acc.get('role') or '').lower() == 'student':
                continue
            staff.append({
                'id': f"demo:{uname}",
                'username': uname,
                'full_name': acc.get('full_name') or uname,
                'role': acc.get('role') or '',
                'faculty_id': None, 'faculty_name': None,
                'department_id': None, 'department_name': None,
                'source': 'demo', 'created_at': None,
            })

        return jsonify({'staff': staff, 'total': len(staff)})
    except Exception as e:
        return jsonify({'error': str(e), 'staff': []}), 500

@hr_bp.route('/my-employment', methods=['GET'])
@jwt_required()
def hr_my_employment():
    claims = get_jwt()
    username = (claims.get('username') or '').strip()
    role = (claims.get('role') or '').strip().lower()
    try:
        rbac_engine = create_engine(RBAC_CONN_STRING)
        _ensure_app_users_table(rbac_engine)
        df = pd.read_sql_query(
            text("SELECT full_name, role, faculty_id, department_id FROM app_users WHERE username = :u"),
            rbac_engine, params={'u': username}
        )
        rbac_engine.dispose()
        if not df.empty:
            r = df.iloc[0]
            fid, did = r.get('faculty_id'), r.get('department_id')
            fac_name = dept_name = None
            try:
                dw = create_engine(DATA_WAREHOUSE_CONN_STRING)
                if pd.notna(fid):
                    fn = pd.read_sql_query(text("SELECT faculty_name FROM dim_faculty WHERE faculty_id = :fid"), dw, params={'fid': int(fid)})
                    fac_name = fn.iloc[0]['faculty_name'] if not fn.empty else None
                if pd.notna(did):
                    dn = pd.read_sql_query(text("SELECT department_name FROM dim_department WHERE department_id = :did"), dw, params={'did': int(did)})
                    dept_name = dn.iloc[0]['department_name'] if not dn.empty else None
                dw.dispose()
            except Exception:
                pass
            return jsonify({'status': 'Active', 'role': role, 'faculty_id': fid, 'faculty_name': fac_name, 'department_id': did, 'department_name': dept_name})
    except Exception:
        pass
    return jsonify({'status': 'Active', 'role': role})

@hr_bp.route('/my-payroll', methods=['GET'])
@jwt_required()
def hr_my_payroll():
    return jsonify({'status': None, 'last_payment_date': None, 'pending': None})

@hr_bp.route('/my-leave-requests', methods=['GET'])
@jwt_required()
def hr_my_leave_requests():
    username = (get_jwt().get('username') or '').strip()
    if not username:
        return jsonify({'requests': []})
    try:
        engine = create_engine(RBAC_CONN_STRING)
        _ensure_leave_requests_table(engine)
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT id, start_date, end_date, reason, status, request_type, parent_leave_id, created_at
                FROM leave_requests WHERE username = :u ORDER BY created_at DESC
            """), {'u': username}).mappings().fetchall()
        engine.dispose()
        requests = [{
            'id': r['id'],
            'start_date': r['start_date'].isoformat() if hasattr(r['start_date'], 'isoformat') else str(r['start_date']),
            'end_date': r['end_date'].isoformat() if hasattr(r['end_date'], 'isoformat') else str(r['end_date']),
            'reason': r['reason'] or '',
            'status': r['status'] or 'pending',
            'request_type': r['request_type'] or 'new',
            'parent_leave_id': r['parent_leave_id'],
            'created_at': r['created_at'].isoformat() if hasattr(r['created_at'], 'isoformat') else str(r['created_at']),
        } for r in rows]
        return jsonify({'requests': requests})
    except Exception:
        return jsonify({'requests': []})

@hr_bp.route('/leave-request', methods=['POST', 'OPTIONS'])
def hr_submit_leave_request():
    if request.method == 'OPTIONS':
        return '', 204
    verify_jwt_in_request()
    claims = get_jwt()
    username = (claims.get('username') or '').strip()
    if not username:
        return jsonify({'error': 'Not authenticated'}), 401
    if (claims.get('role') or '').strip().lower() not in _LEAVE_DIRECTORY_ROLES:
        return jsonify({'error': 'Leave requests are only available for staff and employee roles.'}), 403
    body = request.get_json(silent=True) or {}
    start_date_s = body.get('start_date') or ''
    end_date_s = body.get('end_date') or ''
    reason = (body.get('reason') or '').strip()
    request_type = (body.get('request_type') or 'new').strip().lower() or 'new'
    parent_leave_id = body.get('parent_leave_id')
    if not start_date_s or not end_date_s or not reason:
        return jsonify({'error': 'start_date, end_date, and reason are required'}), 400
    try:
        start_d = datetime.strptime(start_date_s, '%Y-%m-%d').date()
        end_d = datetime.strptime(end_date_s, '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return jsonify({'error': 'start_date and end_date must be in YYYY-MM-DD format'}), 400
    if start_d > end_d:
        return jsonify({'error': 'Start date must be earlier than or equal to end date'}), 400
    try:
        engine = create_engine(RBAC_CONN_STRING)
        _ensure_leave_requests_table(engine)
        with engine.connect() as conn:
            if request_type != 'extension':
                active = conn.execute(text("""
                    SELECT id FROM leave_requests
                    WHERE username = :u AND status = 'approved'
                    AND CURRENT_DATE <= end_date AND start_date <= CURRENT_DATE
                    LIMIT 1
                """), {'u': username}).mappings().fetchone()
                if active:
                    engine.dispose()
                    return jsonify({'error': 'You already have an active leave. To add more time, request a leave extension.'}), 400
            conn.execute(text("""
                INSERT INTO leave_requests (username, start_date, end_date, reason, status, request_type, parent_leave_id)
                VALUES (:u, :start, :end, :reason, 'pending', :req_type, :parent)
            """), {'u': username, 'start': start_d, 'end': end_d, 'reason': reason, 'req_type': request_type, 'parent': parent_leave_id})
            conn.commit()
        engine.dispose()
        return jsonify({'message': 'Leave request submitted. HR will review.'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@hr_bp.route('/leave-requests', methods=['GET'])
@jwt_required()
def hr_list_leave_requests():
    if not _leave_can_view_directory():
        return jsonify({'error': 'Not authorized to view leave directory'}), 403
    try:
        engine = create_engine(RBAC_CONN_STRING)
        _ensure_leave_requests_table(engine)
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT id, username, start_date, end_date, reason, status, request_type, parent_leave_id, created_at
                FROM leave_requests ORDER BY created_at DESC
            """)).mappings().fetchall()
        engine.dispose()
        requests = [{
            'id': r['id'],
            'username': r['username'] or '',
            'start_date': r['start_date'].isoformat() if hasattr(r['start_date'], 'isoformat') else str(r['start_date']),
            'end_date': r['end_date'].isoformat() if hasattr(r['end_date'], 'isoformat') else str(r['end_date']),
            'reason': r['reason'] or '',
            'status': r['status'] or 'pending',
            'request_type': r['request_type'] or 'new',
            'parent_leave_id': r['parent_leave_id'],
            'created_at': r['created_at'].isoformat() if hasattr(r['created_at'], 'isoformat') else str(r['created_at']),
        } for r in rows]
        return jsonify({'requests': requests})
    except Exception as e:
        return jsonify({'requests': [], 'error': str(e)})

@hr_bp.route('/leave-requests/<int:leave_id>/review', methods=['POST', 'OPTIONS'])
def hr_review_leave_request(leave_id):
    if request.method == 'OPTIONS':
        return '', 204
    verify_jwt_in_request()
    if not _leave_can_review_requests():
        return jsonify({'error': 'Only HR or administrators can approve or reject leave'}), 403
    body = request.get_json(silent=True) or {}
    action = (body.get('action') or '').strip().lower()
    if action not in ('approve', 'reject'):
        return jsonify({'error': 'action must be approve or reject'}), 400
    reviewer = (get_jwt().get('username') or '').strip()
    try:
        engine = create_engine(RBAC_CONN_STRING)
        _ensure_leave_requests_table(engine)
        with engine.connect() as conn:
            conn.execute(text("""
                UPDATE leave_requests SET status = :status, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = :by
                WHERE id = :id
            """), {'status': 'approved' if action == 'approve' else 'rejected', 'by': reviewer, 'id': leave_id})
            conn.commit()
        engine.dispose()
        return jsonify({'message': 'Leave request ' + ('approved' if action == 'approve' else 'rejected') + '.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@hr_bp.route('/employees-on-leave', methods=['GET'])
@jwt_required()
def hr_employees_on_leave():
    if not _leave_can_view_directory():
        return jsonify({'error': 'Not authorized to view leave directory'}), 403
    try:
        engine = create_engine(RBAC_CONN_STRING)
        _ensure_leave_requests_table(engine)
        _ensure_app_users_table(engine)
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT lr.id, lr.username, lr.start_date, lr.end_date, lr.reason, lr.request_type,
                       au.full_name
                FROM leave_requests lr
                LEFT JOIN app_users au ON au.username = lr.username
                WHERE lr.status = 'approved'
                AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
                ORDER BY lr.end_date
            """)).mappings().fetchall()
        engine.dispose()
        on_leave = [{
            'id': r['id'],
            'username': r['username'] or '',
            'full_name': r['full_name'] or r['username'] or '',
            'start_date': r['start_date'].isoformat() if hasattr(r['start_date'], 'isoformat') else str(r['start_date']),
            'end_date': r['end_date'].isoformat() if hasattr(r['end_date'], 'isoformat') else str(r['end_date']),
            'reason': r['reason'] or '',
            'request_type': r['request_type'] or 'new',
        } for r in rows]
        return jsonify({'on_leave': on_leave})
    except Exception as e:
        return jsonify({'on_leave': [], 'error': str(e)})

@hr_bp.route('/payroll-overview', methods=['GET'])
@jwt_required()
def hr_payroll_overview():
    if (get_jwt().get('role') or '').strip().lower() != 'hr':
        return jsonify({'error': 'HR only'}), 403
    try:
        from hr_payroll_overview import build_hr_payroll_overview
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        try:
            payload = build_hr_payroll_overview(engine)
        finally:
            engine.dispose()
        return jsonify(payload), 200
    except Exception as e:
        return jsonify({
            'error': str(e),
            'payroll_by_role': [], 'total_payroll': 0,
            'paid': [], 'pending': [],
            'latest_pay_period': None, 'paid_count': 0, 'pending_count': 0,
        }), 500
