"""
Export API for Excel and PDF generation
"""
from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt
from sqlalchemy import create_engine, text
import pandas as pd
import io
from datetime import datetime
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from config import DATA_WAREHOUSE_CONN_STRING
from rbac import Role, Resource, Permission, has_permission

def get_user_scope(claims):
    """Get user's data scope based on role"""
    role_str = claims.get('role', 'student')
    try:
        if isinstance(role_str, str):
            role = Role(role_str.lower())
        else:
            role = role_str
    except (ValueError, AttributeError):
        role = Role.STUDENT
    
    return {
        'role': role,
        'student_id': claims.get('student_id'),
        'staff_id': claims.get('staff_id'),
        'department_id': claims.get('department_id'),
        'faculty_id': claims.get('faculty_id'),
        'access_number': claims.get('access_number')
    }

export_bp = Blueprint('export', __name__, url_prefix='/api/export')

@export_bp.route('/excel', methods=['GET', 'POST'])
@jwt_required()
def export_excel():
    """Export data to Excel format"""
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        
        # Check export permission
        if not has_permission(user_scope['role'], Resource.ANALYTICS, Permission.EXPORT, user_scope):
            return jsonify({'error': 'Permission denied'}), 403
        
        filters = request.args.to_dict() if request.method == 'GET' else request.get_json().get('filters', {})
        export_type = request.args.get('type', 'dashboard') if request.method == 'GET' else request.get_json().get('type', 'dashboard')
        
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        
        # Build query based on export type
        if export_type == 'dashboard':
            # Export dashboard stats
            query = """
            SELECT 
                'Total Students' as Metric,
                COUNT(DISTINCT student_id) as Value
            FROM dim_student
            UNION ALL
            SELECT 
                'Total Courses' as Metric,
                COUNT(*) as Value
            FROM dim_course
            UNION ALL
            SELECT 
                'Total Enrollments' as Metric,
                COUNT(*) as Value
            FROM fact_enrollment
            UNION ALL
            SELECT 
                'Average Grade' as Metric,
                ROUND(AVG(grade), 2) as Value
            FROM fact_grade
            WHERE exam_status = 'Completed'
            """
            
            df = pd.read_sql_query(text(query), engine)
            
            # Create Excel in memory
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name='Dashboard Stats', index=False)
                
                # Add department breakdown
                dept_query = """
                SELECT 
                    dc.department,
                    COUNT(DISTINCT fe.student_id) as student_count
                FROM fact_enrollment fe
                JOIN dim_course dc ON fe.course_code = dc.course_code
                GROUP BY dc.department
                ORDER BY student_count DESC
                """
                dept_df = pd.read_sql_query(text(dept_query), engine)
                dept_df.to_excel(writer, sheet_name='By Department', index=False)
                
                # Add grade distribution
                grade_query = """
                SELECT 
                    letter_grade,
                    COUNT(*) as count
                FROM fact_grade
                GROUP BY letter_grade
                ORDER BY letter_grade
                """
                grade_df = pd.read_sql_query(text(grade_query), engine)
                grade_df.to_excel(writer, sheet_name='Grade Distribution', index=False)
            
            output.seek(0)
            engine.dispose()
            
            return send_file(
                output,
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                as_attachment=True,
                download_name=f'dashboard_export_{datetime.now().strftime("%Y%m%d")}.xlsx'
            )
        
        elif export_type == 'fex':
            # Export FEX analytics
            query = """
            SELECT 
                df.faculty_name,
                dc.department,
                dp.program_name,
                dc.course_name,
                COUNT(CASE WHEN fg.exam_status = 'FEX' THEN 1 END) as total_fex,
                COUNT(CASE WHEN fg.exam_status = 'MEX' THEN 1 END) as total_mex,
                COUNT(CASE WHEN fg.exam_status = 'FCW' THEN 1 END) as total_fcw,
                COUNT(CASE WHEN fg.exam_status = 'Completed' THEN 1 END) as total_completed,
                COUNT(*) as total_exams
            FROM fact_grade fg
            JOIN dim_student ds ON fg.student_id = ds.student_id
            JOIN dim_course dc ON fg.course_code = dc.course_code
            LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
            LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
            LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
            GROUP BY df.faculty_name, dc.department, dp.program_name, dc.course_name
            """
            
            df = pd.read_sql_query(text(query), engine)
            
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name='FEX Analytics', index=False)
            
            output.seek(0)
            engine.dispose()
            
            return send_file(
                output,
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                as_attachment=True,
                download_name=f'fex_analytics_{datetime.now().strftime("%Y%m%d")}.xlsx'
            )
        
        else:
            return jsonify({'error': 'Invalid export type'}), 400
            
    except Exception as e:
        import traceback
        print(f"Error exporting to Excel: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@export_bp.route('/pdf', methods=['GET', 'POST'])
@jwt_required()
def export_pdf():
    """Export data to PDF format"""
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        
        # Check export permission
        if not has_permission(user_scope['role'], Resource.ANALYTICS, Permission.EXPORT, user_scope):
            return jsonify({'error': 'Permission denied'}), 403
        
        # Redirect to existing PDF generator
        from flask import redirect
        return redirect('/api/report/generate')
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

