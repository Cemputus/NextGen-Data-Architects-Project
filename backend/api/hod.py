"""
HOD API - handling staff assignments and departmental oversight
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from sqlalchemy import create_engine, text
import pandas as pd
from rbac import Role, has_permission, Resource, Permission
from config import DATA_WAREHOUSE_CONN_STRING, get_sqlalchemy_conn_string

hod_bp = Blueprint('hod', __name__, url_prefix='/api/hod')

def _get_rbac_engine():
    return create_engine(get_sqlalchemy_conn_string('ucu_rbac'))

def _get_dw_engine():
    return create_engine(DATA_WAREHOUSE_CONN_STRING)

@hod_bp.route('/staff-in-department', methods=['GET'])
@jwt_required()
def get_staff_in_department():
    """List all staff members in the HOD's department"""
    try:
        claims = get_jwt()
        role = claims.get('role')
        if role != Role.HOD.value and role != 'hod':
            return jsonify({'error': 'HOD access required'}), 403
            
        dept_id = claims.get('department_id')
        if not dept_id:
            return jsonify({'error': 'No department assigned to this HOD'}), 400
            
        rbac_engine = _get_rbac_engine()
        df = pd.read_sql_query(
            text("SELECT id, username, full_name, role FROM app_users WHERE department_id = :did AND role = 'staff'"),
            rbac_engine, params={'did': dept_id}
        )
        rbac_engine.dispose()
        
        return jsonify({'staff': df.to_dict('records')}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@hod_bp.route('/department-courses', methods=['GET'])
@jwt_required()
def get_department_courses():
    """List all courses in the HOD's department"""
    try:
        claims = get_jwt()
        dept_id = claims.get('department_id')
        if not dept_id:
            return jsonify({'error': 'No department assigned'}), 400
            
        dw_engine = _get_dw_engine()
        df = pd.read_sql_query(
            text("SELECT course_code, course_name FROM dim_course WHERE department_id = :did"),
            dw_engine, params={'did': dept_id}
        )
        dw_engine.dispose()
        
        return jsonify({'courses': df.to_dict('records')}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@hod_bp.route('/staff-assignments/<int:staff_id>', methods=['GET'])
@jwt_required()
def get_staff_assignments(staff_id):
    """Get course assignments for a specific staff member"""
    try:
        rbac_engine = _get_rbac_engine()
        df = pd.read_sql_query(
            text("SELECT course_code FROM staff_course_assignments WHERE app_user_id = :sid"),
            rbac_engine, params={'sid': staff_id}
        )
        rbac_engine.dispose()
        
        return jsonify({'course_codes': df['course_code'].tolist()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@hod_bp.route('/staff-assignments/<int:staff_id>', methods=['PUT', 'POST'])
@jwt_required()
def update_staff_assignments(staff_id):
    """Update course assignments for a specific staff member"""
    try:
        data = request.get_json()
        course_codes = data.get('course_codes', [])
        
        rbac_engine = _get_rbac_engine()
        with rbac_engine.connect() as conn:
            # Clear existing
            conn.execute(text("DELETE FROM staff_course_assignments WHERE app_user_id = :sid"), {'sid': staff_id})
            
            # Add new
            for code in course_codes:
                if code:
                    conn.execute(
                        text("INSERT INTO staff_course_assignments (app_user_id, course_code) VALUES (:sid, :code)"),
                        {'sid': staff_id, 'code': code}
                    )
            conn.commit()
        rbac_engine.dispose()
        
        return jsonify({'message': 'Assignments updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
