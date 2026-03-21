"""
Analytics API with RBAC and advanced filtering
Includes FEX analytics, high school analytics, enrollment analytics, and role-based data scoping
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from sqlalchemy import create_engine, text
import pandas as pd
from rbac import Role, Resource, Permission, has_permission
from datetime import datetime, timedelta
from config import DATA_WAREHOUSE_CONN_STRING, DB1_NAME, DB2_NAME, get_sqlalchemy_conn_string
import os

analytics_bp = Blueprint('analytics', __name__, url_prefix='/api/analytics')

def _maybe_int(v):
    """Coerce URL query param IDs to int for reliable PostgreSQL comparisons."""
    try:
        return int(str(v).strip())
    except (ValueError, TypeError, AttributeError):
        return v


def get_user_scope(claims):
    """Get user's data scope based on role"""
    role_str = claims.get('role', 'student')
    # Convert string role to Role enum, handling both string and enum inputs
    try:
        if isinstance(role_str, str):
            role = Role(role_str.lower())
        else:
            role = role_str
    except (ValueError, AttributeError):
        # Fallback to student if role is invalid
        role = Role.STUDENT
    
    scope = {
        'role': role,
        'student_id': claims.get('student_id'),
        'staff_id': claims.get('staff_id'),
        'department_id': claims.get('department_id'),
        'faculty_id': claims.get('faculty_id'),
        'access_number': claims.get('access_number')
    }
    return scope


def _jwt_scope_sanitize_filters(filters, user_scope):
    """Drop faculty/department query params that would override JWT scope for dean/HOD/staff."""
    filters = dict(filters or {})
    role = user_scope.get('role')
    if role == Role.DEAN and user_scope.get('faculty_id'):
        filters.pop('faculty_id', None)
    elif role == Role.HOD and user_scope.get('department_id'):
        filters.pop('department_id', None)
        filters.pop('faculty_id', None)
    elif role == Role.STAFF:
        filters.pop('faculty_id', None)
        filters.pop('department_id', None)
    return filters


def build_filter_query(filters, base_query, user_scope):
    """Build SQL query with filters and role-based scoping"""
    filters = _jwt_scope_sanitize_filters(filters, user_scope)

    where_clauses = []
    params = {}

    def _has_value(v):
        """Return True if the frontend provided a real filter value.
        The UI uses the string 'all' to mean 'no selection'.
        """
        if v is None:
            return False
        if isinstance(v, str):
            if v.strip() == '':
                return False
            if v.strip().lower() == 'all':
                return False
        return True
    
    # Role-based scoping
    if user_scope['role'] == Role.STUDENT:
        if user_scope['student_id']:
            where_clauses.append("ds.student_id = :student_id")
            params['student_id'] = user_scope['student_id']
        elif user_scope['access_number']:
            where_clauses.append("ds.access_number = :access_number")
            params['access_number'] = user_scope['access_number']
    
    elif user_scope['role'] == Role.STAFF:
        # Staff can see their classes - handled separately
        pass
    
    elif user_scope['role'] == Role.HOD:
        if user_scope['department_id']:
            where_clauses.append("ddept.department_id = :department_id")
            params['department_id'] = user_scope['department_id']
    
    elif user_scope['role'] == Role.DEAN:
        if user_scope['faculty_id']:
            where_clauses.append("df.faculty_id = :faculty_id")
            params['faculty_id'] = user_scope['faculty_id']
    
    # Apply filters
    if filters:
        if _has_value(filters.get('faculty_id')):
            where_clauses.append("df.faculty_id = :filter_faculty_id")
            params['filter_faculty_id'] = _maybe_int(filters['faculty_id'])
        
        if _has_value(filters.get('department_id')):
            where_clauses.append("ddept.department_id = :filter_department_id")
            params['filter_department_id'] = _maybe_int(filters['department_id'])
        
        if _has_value(filters.get('program_id')):
            where_clauses.append("dp.program_id = :filter_program_id")
            params['filter_program_id'] = _maybe_int(filters['program_id'])
        
        if _has_value(filters.get('course_code')):
            where_clauses.append("dc.course_code = :filter_course_code")
            params['filter_course_code'] = filters['course_code']
        
        if _has_value(filters.get('access_number')):
            where_clauses.append("ds.access_number = :filter_access_number")
            params['filter_access_number'] = filters['access_number']
        
        if _has_value(filters.get('reg_number')):
            where_clauses.append("ds.reg_no = :filter_reg_number")
            params['filter_reg_number'] = str(filters['reg_number']).strip().upper()
        
        if _has_value(filters.get('intake_year')):
            where_clauses.append("EXTRACT(YEAR FROM ds.admission_date) = :filter_intake_year")
            try:
                params['filter_intake_year'] = int(filters['intake_year'])
            except (ValueError, TypeError):
                # Keep original value if it can't be coerced; SQL will error if invalid,
                # but this avoids silently changing semantics.
                params['filter_intake_year'] = filters['intake_year']
        
        if _has_value(filters.get('semester_id')):
            where_clauses.append("fg.semester_id = :filter_semester_id")
            params['filter_semester_id'] = _maybe_int(filters['semester_id'])
        
        if _has_value(filters.get('gender')):
            where_clauses.append("ds.gender = :filter_gender")
            params['filter_gender'] = filters['gender']
        
        if _has_value(filters.get('high_school')):
            # Dropdown sends the canonical name from dim_student; normalize whitespace
            # so "Gulu High School" matches stored values with extra spaces.
            hs = str(filters['high_school']).strip()
            where_clauses.append(
                "regexp_replace(lower(trim(coalesce(ds.high_school, ''))), E'\\\\s+', ' ', 'g') = "
                "regexp_replace(lower(trim(:filter_high_school_exact)), E'\\\\s+', ' ', 'g')"
            )
            params['filter_high_school_exact'] = hs
        
        if _has_value(filters.get('student_name')):
            where_clauses.append("(ds.first_name LIKE :filter_student_name OR ds.last_name LIKE :filter_student_name OR CONCAT(ds.first_name, ' ', ds.last_name) LIKE :filter_student_name)")
            params['filter_student_name'] = f"%{filters['student_name']}%"
    
    if where_clauses:
        base_query += " WHERE " + " AND ".join(where_clauses)
    
    return base_query, params

@analytics_bp.route('/fex', methods=['GET'])
@jwt_required()
def get_fex_analytics():
    """Get FEX analytics with drilldown capabilities"""
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        
        # Check permission
        if not has_permission(user_scope['role'], Resource.FEX_ANALYTICS, Permission.READ, user_scope):
            return jsonify({'error': 'Permission denied'}), 403
        
        filters = request.args.to_dict()
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        
        # When no explicit semester/academic_year filter is provided, focus on the
        # most recent academic period: the current semester only.
        current_semester = None
        if not filters.get('semester_id') and not filters.get('academic_year'):
            try:
                recent_sql = """
                SELECT
                    ds.academic_year,
                    fg.semester_id
                FROM fact_grade fg
                JOIN dim_student ds ON fg.student_id = ds.student_id
                WHERE fg.semester_id IS NOT NULL
                  AND ds.academic_year IS NOT NULL
                GROUP BY ds.academic_year, fg.semester_id
                ORDER BY ds.academic_year DESC, fg.semester_id DESC
                LIMIT 1
                """
                recent_df = pd.read_sql_query(text(recent_sql), engine)
                if not recent_df.empty:
                    row = recent_df.iloc[0]
                    ay = str(row.get('academic_year') or '').strip()
                    sem = int(row.get('semester_id')) if row.get('semester_id') is not None else None
                    if ay and sem is not None:
                        current_semester = (ay, sem)
            except Exception:
                current_semester = None
        
        # Base query for FEX analytics
        # Note: We use LEFT JOINs to ensure we get all grade records even if some dimension data is missing
        drilldown = filters.get('drilldown', 'overall')
        
        # Build SELECT clause based on drilldown level
        if drilldown == 'faculty':
            select_cols = """
            COALESCE(df.faculty_id, 0) as faculty_id,
            COALESCE(df.faculty_name, 'Unknown') as faculty_name,
            COALESCE(df.faculty_name, 'Unknown') as department,
            COALESCE(df.faculty_name, 'Unknown') as program_name,
            'N/A' as course_code,
            'N/A' as course_name
            """
            group_by_cols = "df.faculty_id, df.faculty_name"
        elif drilldown == 'department':
            select_cols = """
            COALESCE(ddept.department_id, 0) as department_id,
            COALESCE(ddept.department_name, dc.department, 'Unknown') as department,
            COALESCE(df.faculty_name, 'Unknown') as faculty_name,
            COALESCE(ddept.department_name, dc.department, 'Unknown') as program_name,
            'N/A' as course_code,
            'N/A' as course_name
            """
            group_by_cols = "ddept.department_id, ddept.department_name, df.faculty_name, dc.department"
        elif drilldown == 'program':
            select_cols = """
            COALESCE(dp.program_id, 0) as program_id,
            COALESCE(dp.program_name, 'Unknown') as program_name,
            COALESCE(ddept.department_name, dc.department, 'Unknown') as department,
            COALESCE(df.faculty_name, 'Unknown') as faculty_name,
            'N/A' as course_code,
            'N/A' as course_name
            """
            group_by_cols = "dp.program_id, dp.program_name, ddept.department_name, dc.department, df.faculty_name"
        elif drilldown == 'year_of_study':
            # When a program is selected, show the distribution across student year-of-study.
            select_cols = """
            COALESCE(ds.year_of_study, 1) as year_of_study,
            CONCAT('Year ', COALESCE(ds.year_of_study, 1)) as year_label,
            'N/A' as faculty_id,
            'N/A' as faculty_name,
            'N/A' as department_id,
            'N/A' as department,
            'N/A' as program_id,
            'N/A' as program_name,
            'N/A' as course_code,
            'N/A' as course_name
            """
            group_by_cols = "COALESCE(ds.year_of_study, 1)"
        elif drilldown == 'course':
            select_cols = """
            dc.course_code,
            COALESCE(dc.course_name, 'Unknown') as course_name,
            COALESCE(ddept.department_name, dc.department, 'Unknown') as department,
            COALESCE(df.faculty_name, 'Unknown') as faculty_name,
            COALESCE(dp.program_name, 'Unknown') as program_name
            """
            group_by_cols = "dc.course_code, dc.course_name, ddept.department_name, dc.department, df.faculty_name, dp.program_name"
        else:
            # Overall - include all dimensions
            select_cols = """
            COALESCE(df.faculty_id, 0) as faculty_id,
            COALESCE(df.faculty_name, 'Unknown') as faculty_name,
            COALESCE(ddept.department_id, 0) as department_id,
            COALESCE(ddept.department_name, dc.department, 'Unknown') as department,
            COALESCE(dp.program_id, 0) as program_id,
            COALESCE(dp.program_name, 'Unknown') as program_name,
            dc.course_code,
            COALESCE(dc.course_name, 'Unknown') as course_name
            """
            group_by_cols = "df.faculty_id, df.faculty_name, ddept.department_id, ddept.department_name, dc.department, dp.program_id, dp.program_name, dc.course_code, dc.course_name"
        
        base_query = f"""
        SELECT 
            COUNT(CASE WHEN fg.exam_status = 'FEX' THEN 1 END) as total_fex,
            COUNT(CASE WHEN fg.exam_status = 'MEX' THEN 1 END) as total_mex,
            COUNT(CASE WHEN fg.exam_status = 'FCW' THEN 1 END) as total_fcw,
            COUNT(CASE WHEN fg.exam_status = 'Completed' THEN 1 END) as total_completed,
            COUNT(*) as total_exams,
            AVG(CASE WHEN fg.exam_status = 'FEX' THEN fg.grade ELSE NULL END) as avg_fex_score,
            {select_cols}
        FROM fact_grade fg
        JOIN dim_student ds ON fg.student_id = ds.student_id
        LEFT JOIN dim_course dc ON fg.course_code = dc.course_code
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        """
        
        query, params = build_filter_query(filters, base_query, user_scope)
        
        # Apply current-semester window if detected and no explicit semester filters
        if current_semester:
            ay, sem = current_semester
            params['recent_ay'] = ay
            params['recent_sem'] = sem
            window_clause = "(ds.academic_year = :recent_ay AND fg.semester_id = :recent_sem)"
            if "WHERE" in query.upper():
                query += f" AND ({window_clause})"
            else:
                query += f" WHERE {window_clause}"
        
        # Add grouping
        query += f" GROUP BY {group_by_cols}"
        
        # First, get summary totals (scoped by user and filters)
        summary_query_base = """
        SELECT 
            COUNT(CASE WHEN fg.exam_status = 'FEX' THEN 1 END) as total_fex,
            COUNT(CASE WHEN fg.exam_status = 'MEX' THEN 1 END) as total_mex,
            COUNT(CASE WHEN fg.exam_status = 'FCW' THEN 1 END) as total_fcw,
            COUNT(CASE WHEN fg.exam_status = 'Completed' THEN 1 END) as total_completed,
            COUNT(*) as total_exams
        FROM fact_grade fg
        JOIN dim_student ds ON fg.student_id = ds.student_id
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        """

        summary_query, summary_params = build_filter_query(filters, summary_query_base, user_scope)

        # Apply the same current-semester window to the summary query so KPIs match the chart
        if current_semester:
            ay, sem = current_semester
            summary_params['s_recent_ay'] = ay
            summary_params['s_recent_sem'] = sem
            window_clause = "(ds.academic_year = :s_recent_ay AND fg.semester_id = :s_recent_sem)"
            if "WHERE" in summary_query.upper():
                summary_query += f" AND ({window_clause})"
            else:
                summary_query += f" WHERE {window_clause}"
        simple_df = pd.read_sql_query(text(summary_query), engine, params=summary_params)
        
        # Get summary from simple query
        summary = {
            'total_fex': int(simple_df['total_fex'].iloc[0]) if not simple_df.empty and 'total_fex' in simple_df.columns else 0,
            'total_mex': int(simple_df['total_mex'].iloc[0]) if not simple_df.empty and 'total_mex' in simple_df.columns else 0,
            'total_fcw': int(simple_df['total_fcw'].iloc[0]) if not simple_df.empty and 'total_fcw' in simple_df.columns else 0,
            'total_completed': int(simple_df['total_completed'].iloc[0]) if not simple_df.empty and 'total_completed' in simple_df.columns else 0,
            'fex_rate': round((simple_df['total_fex'].iloc[0] / simple_df['total_exams'].iloc[0] * 100) if not simple_df.empty and simple_df['total_exams'].iloc[0] > 0 else 0, 2)
        }
        
        # Now get detailed data with drilldown
        try:
            df = pd.read_sql_query(text(query), engine, params=params)
        except Exception as query_error:
            print(f"Error executing FEX query: {query_error}")
            import traceback
            traceback.print_exc()
            # Return summary only if detailed query fails
            engine.dispose()
            return jsonify({
                'data': [],
                'summary': summary
            }), 200
        
        engine.dispose()
        
        # Prepare response with debug info if empty
        data_records = df.to_dict('records') if not df.empty else []
        response_data = {
            'data': data_records,
            'summary': summary
        }
        
        # Add debug info when no data
        if df.empty:
            response_data['debug_info'] = {
                'message': 'No data matches the current filters. Try adjusting your filters or clearing them to see all data.',
                'drilldown': drilldown,
                'filters_applied': filters,
                'total_records_in_db': summary.get('total_exams', 0)
            }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        import traceback
        print(f"Error in get_fex_analytics: {e}")
        print(traceback.format_exc())
        # Return empty data structure on error
        return jsonify({
            'data': [],
            'summary': {
                'total_fex': 0,
                'total_mex': 0,
                'total_fcw': 0,
                'total_completed': 0,
                'fex_rate': 0
            },
            'error': str(e)
        }), 200  # Return 200 with error in response so frontend can display it


@analytics_bp.route('/student/retakes', methods=['GET'])
@analytics_bp.route('/my-retakes', methods=['GET'])
@jwt_required()
def get_student_retakes():
    """Return retake-related courses for the current student based on FCW/MEX/FEX statuses.

    - Students: see only their own retake list.
    - Other roles: currently receive 403; aggregate views use existing FEX/high-school analytics.
    """
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        if user_scope['role'] != Role.STUDENT:
            return jsonify({'error': 'Retake details are only available on the student dashboard.'}), 403

        student_id = user_scope.get('student_id')
        access_number = user_scope.get('access_number')
        if not student_id and not access_number:
            return jsonify({'retakes': [], 'summary': {'total_retakes': 0}}), 200

        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        params = {}
        where_clauses = ["fg.exam_status IN ('FEX', 'MEX', 'FCW')"]

        if student_id:
            where_clauses.append("fg.student_id = :student_id")
            params['student_id'] = student_id
        elif access_number:
            where_clauses.append("ds.access_number = :access_number")
            params['access_number'] = access_number

        query = f"""
        SELECT
            ds.student_id,
            ds.access_number,
            ds.reg_no,
            ds.first_name,
            ds.last_name,
            dp.program_name,
            ddept.department_name,
            df.faculty_name,
            fg.course_code,
            dc.course_name,
            fg.exam_status,
            fg.grade,
            fg.coursework_score,
            fg.exam_score,
            fg.semester_id,
            ds.academic_year
        FROM fact_grade fg
        JOIN dim_student ds ON fg.student_id = ds.student_id
        JOIN dim_course dc ON fg.course_code = dc.course_code
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        WHERE {" AND ".join(where_clauses)}
        ORDER BY ds.academic_year, fg.semester_id, dc.course_code
        """

        df = pd.read_sql_query(text(query), engine, params=params)
        engine.dispose()

        retakes = []
        for _, row in df.iterrows():
            status = str(row.get('exam_status') or '').upper()
            reason = None
            if status == 'FCW':
                reason = 'Failed coursework'
            elif status == 'MEX':
                reason = 'Missed exam'
            elif status == 'FEX':
                reason = 'Failed exam'
            retakes.append({
                'course_code': str(row.get('course_code') or ''),
                'course_name': str(row.get('course_name') or ''),
                'exam_status': status,
                'reason': reason,
                'grade': float(row['grade']) if 'grade' in row and pd.notna(row['grade']) else None,
                'coursework_score': float(row['coursework_score']) if 'coursework_score' in row and pd.notna(row['coursework_score']) else None,
                'exam_score': float(row['exam_score']) if 'exam_score' in row and pd.notna(row['exam_score']) else None,
                'semester_id': int(row['semester_id']) if 'semester_id' in row and pd.notna(row['semester_id']) else None,
                'academic_year': str(row.get('academic_year') or ''),
                'status': 'pending',  # progression integration can refine this later
            })

        return jsonify({
            'retakes': retakes,
            'summary': {
                'total_retakes': len(retakes),
                'fcw_count': sum(1 for r in retakes if r['exam_status'] == 'FCW'),
                'mex_count': sum(1 for r in retakes if r['exam_status'] == 'MEX'),
                'fex_count': sum(1 for r in retakes if r['exam_status'] == 'FEX'),
            },
        }), 200

    except Exception as e:
        import traceback
        print(f"Error in get_student_retakes: {e}")
        print(traceback.format_exc())
        return jsonify({'retakes': [], 'summary': {'total_retakes': 0}, 'error': str(e)}), 200


@analytics_bp.route('/enrollment-by-year', methods=['GET'])
@jwt_required()
def get_enrollment_by_year():
    """
    Enrollment rate by academic year.

    Global rule (E.1):
    - Population restricted to students in Year 1, Semester 1 for that academic year.
    - enrollment_rate = enrolled_year1 / total_year1 * 100.
    """
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)

        role = user_scope['role']
        # Allow only analytics-facing roles
        if role not in {Role.SENATE, Role.SYSADMIN, Role.ANALYST, Role.DEAN, Role.HOD, Role.FINANCE}:
            return jsonify({'error': 'Permission denied'}), 403
        if not has_permission(role, Resource.ANALYTICS, Permission.READ, user_scope):
            return jsonify({'error': 'Permission denied'}), 403

        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)

        sql = """
        WITH base AS (
            SELECT
                academic_year,
                COUNT(DISTINCT CASE WHEN COALESCE(year_of_study, 1) = 1 THEN student_id END) AS total_year1
            FROM dim_student
            GROUP BY academic_year
        ),
        enrolled AS (
            SELECT
                ds.academic_year,
                COUNT(DISTINCT ds.student_id) AS enrolled_year1
            FROM dim_student ds
            JOIN fact_enrollment fe
              ON ds.student_id = fe.student_id
            WHERE COALESCE(ds.year_of_study, 1) = 1
              AND COALESCE(fe.semester_id, 1) = 1
            GROUP BY ds.academic_year
        )
        SELECT
            b.academic_year,
            COALESCE(b.total_year1, 0) AS total_year1,
            COALESCE(e.enrolled_year1, 0) AS enrolled_year1,
            CASE
                WHEN b.total_year1 > 0
                THEN ROUND(COALESCE(e.enrolled_year1, 0)::numeric / b.total_year1 * 100, 1)
                ELSE 0
            END AS enrollment_rate
        FROM base b
        LEFT JOIN enrolled e USING (academic_year)
        ORDER BY b.academic_year
        """

        df = pd.read_sql_query(text(sql), engine)
        engine.dispose()

        records = []
        for _, row in df.iterrows():
            records.append({
                'academic_year': str(row.get('academic_year') or ''),
                'total_year1': int(row.get('total_year1') or 0),
                'enrolled_year1': int(row.get('enrolled_year1') or 0),
                'enrollment_rate': float(row.get('enrollment_rate') or 0.0),
            })

        return jsonify({'enrollment_by_year': records}), 200
    except Exception as e:
        import traceback
        print(f"Error in get_enrollment_by_year: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e), 'enrollment_by_year': []}), 500


@analytics_bp.route('/high-school', methods=['GET'])
@jwt_required()
def get_high_school_analytics():
    """Get high school analytics - enrollment, retention, graduation rates, tuition completion, performance"""
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        
        if not has_permission(user_scope['role'], Resource.HIGH_SCHOOL_ANALYTICS, Permission.READ, user_scope):
            return jsonify({'error': 'Permission denied'}), 403
        
        filters = _jwt_scope_sanitize_filters(request.args.to_dict(), user_scope)
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        
        query = """
        SELECT 
            ds.high_school,
            COALESCE(ds.high_school_district, 'Unknown') as high_school_district,
            COUNT(DISTINCT ds.student_id) as total_students,
            COUNT(DISTINCT CASE WHEN ds.status = 'Active' THEN ds.student_id END) as active_students,
            COUNT(DISTINCT CASE WHEN ds.status = 'Graduated' THEN ds.student_id END) as graduated_students,
            COUNT(DISTINCT CASE WHEN ds.status = 'Withdrawn' THEN ds.student_id END) as withdrawn_students,
            COUNT(DISTINCT fe.student_id) as enrolled_students,
            COUNT(DISTINCT dp.program_id) as programs_enrolled,
            -- Performance metrics
            AVG(CASE WHEN fg.exam_status = 'Completed' THEN fg.grade ELSE NULL END) as avg_grade,
            AVG(CASE WHEN fg.exam_status = 'Completed' THEN fg.coursework_score ELSE NULL END) as avg_coursework_score,
            AVG(CASE WHEN fg.exam_status = 'Completed' THEN fg.exam_score ELSE NULL END) as avg_exam_score,
            STDDEV(CASE WHEN fg.exam_status = 'Completed' THEN fg.grade ELSE NULL END) as grade_stddev,
            COUNT(CASE WHEN fg.exam_status = 'Completed' AND fg.grade >= 80 THEN 1 END) as grade_a_count,
            COUNT(CASE WHEN fg.exam_status = 'Completed' AND fg.grade >= 75 AND fg.grade < 80 THEN 1 END) as grade_bplus_count,
            COUNT(CASE WHEN fg.exam_status = 'Completed' AND fg.grade < 50 THEN 1 END) as grade_f_count,
            -- Exam status metrics
            COUNT(CASE WHEN fg.exam_status = 'FEX' THEN 1 END) as total_fex,
            COUNT(CASE WHEN fg.exam_status = 'MEX' THEN 1 END) as total_mex,
            COUNT(CASE WHEN fg.exam_status = 'FCW' THEN 1 END) as total_fcw,
            -- Tuition completion metrics
            COALESCE(SUM(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END), 0) as total_paid,
            COALESCE(SUM(CASE WHEN fp.status = 'Pending' THEN fp.amount ELSE 0 END), 0) as total_pending,
            COALESCE(SUM(fp.amount), 0) as total_required,
            COUNT(DISTINCT CASE WHEN fp.status = 'Pending' AND fp.amount > 500000 THEN fp.student_id END) as students_with_significant_balance,
            CASE 
                WHEN COALESCE(SUM(fp.amount), 0) > 0 
                THEN COALESCE(SUM(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END), 0) / COALESCE(SUM(fp.amount), 1) * 100
                ELSE 0 
            END as tuition_completion_rate,
            -- Attendance metrics
            AVG(fa.total_hours) as avg_attendance_hours,
            AVG(fa.days_present) as avg_days_present,
            -- Relationship metrics
            COUNT(CASE WHEN fg.absence_reason LIKE '%Tuition%' OR fg.absence_reason LIKE '%Financial%' THEN 1 END) as tuition_related_missed_exams,
            COUNT(CASE WHEN fp.status = 'Pending' AND fg.exam_status = 'MEX' THEN 1 END) as missed_exams_with_pending_fees
        FROM dim_student ds
        LEFT JOIN fact_enrollment fe ON ds.student_id = fe.student_id
        LEFT JOIN fact_grade fg ON ds.student_id = fg.student_id
        LEFT JOIN fact_payment fp ON ds.student_id = fp.student_id
        LEFT JOIN fact_attendance fa ON ds.student_id = fa.student_id
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        WHERE ds.high_school IS NOT NULL AND ds.high_school != '' AND ds.high_school != 'NULL'
        """
        
        # Build filter query - need to handle WHERE clause properly since we already have one
        where_clauses = []
        params = {}
        
        # Role-based scoping
        if user_scope['role'] == Role.STUDENT:
            if user_scope['student_id']:
                where_clauses.append("ds.student_id = :student_id")
                params['student_id'] = user_scope['student_id']
            elif user_scope['access_number']:
                where_clauses.append("ds.access_number = :access_number")
                params['access_number'] = user_scope['access_number']
        elif user_scope['role'] == Role.HOD:
            if user_scope['department_id']:
                where_clauses.append("ddept.department_id = :department_id")
                params['department_id'] = user_scope['department_id']
        elif user_scope['role'] == Role.DEAN:
            if user_scope['faculty_id']:
                where_clauses.append("df.faculty_id = :faculty_id")
                params['faculty_id'] = user_scope['faculty_id']
        
        # Apply filters (skip empty strings, None, and "all" values)
        if filters:
            # Helper function to check if filter value should be ignored
            def should_ignore_filter(value):
                if value is None:
                    return True
                if isinstance(value, str):
                    value_lower = value.lower().strip()
                    return value_lower in ['', 'all', 'none', 'null', 'undefined', 'select faculty first', 
                                          'select department first', 'all faculties', 'all departments', 
                                          'all programs', 'all high schools', 'all years', 'all semesters']
                return False
            
            if filters.get('faculty_id') and not should_ignore_filter(filters.get('faculty_id')):
                try:
                    faculty_id_val = int(filters['faculty_id'])
                    where_clauses.append("df.faculty_id = :filter_faculty_id")
                    params['filter_faculty_id'] = faculty_id_val
                except (ValueError, TypeError):
                    print(f"DEBUG: Invalid faculty_id filter value: {filters.get('faculty_id')}")
            
            if filters.get('department_id') and not should_ignore_filter(filters.get('department_id')):
                try:
                    dept_id_val = int(filters['department_id'])
                    where_clauses.append("ddept.department_id = :filter_department_id")
                    params['filter_department_id'] = dept_id_val
                except (ValueError, TypeError):
                    print(f"DEBUG: Invalid department_id filter value: {filters.get('department_id')}")
            
            if filters.get('program_id') and not should_ignore_filter(filters.get('program_id')):
                try:
                    prog_id_val = int(filters['program_id'])
                    where_clauses.append("dp.program_id = :filter_program_id")
                    params['filter_program_id'] = prog_id_val
                except (ValueError, TypeError):
                    print(f"DEBUG: Invalid program_id filter value: {filters.get('program_id')}")
            
            if filters.get('high_school') and not should_ignore_filter(filters.get('high_school')):
                where_clauses.append("ds.high_school LIKE :filter_high_school")
                params['filter_high_school'] = f"%{filters['high_school']}%"
            
            if filters.get('intake_year') and not should_ignore_filter(filters.get('intake_year')):
                try:
                    year_val = int(filters['intake_year'])
                    where_clauses.append("EXTRACT(YEAR FROM ds.admission_date) = :filter_intake_year")
                    params['filter_intake_year'] = year_val
                except (ValueError, TypeError):
                    print(f"DEBUG: Invalid intake_year filter value: {filters.get('intake_year')}")
            
            if filters.get('semester_id') and not should_ignore_filter(filters.get('semester_id')):
                try:
                    sem_id_val = int(filters['semester_id'])
                    where_clauses.append("fg.semester_id = :filter_semester_id")
                    params['filter_semester_id'] = sem_id_val
                except (ValueError, TypeError):
                    print(f"DEBUG: Invalid semester_id filter value: {filters.get('semester_id')}")
        
        if where_clauses:
            query += " AND " + " AND ".join(where_clauses)
        
        query += " GROUP BY ds.high_school, ds.high_school_district"
        query += " HAVING COUNT(DISTINCT ds.student_id) > 0"
        query += " ORDER BY total_students DESC"
        
        # First, check if we have any high school data at all
        check_query = "SELECT COUNT(DISTINCT high_school) as count FROM dim_student WHERE high_school IS NOT NULL AND high_school != ''"
        try:
            check_df = pd.read_sql_query(text(check_query), engine)
            total_high_schools_check = check_df['count'].iloc[0] if not check_df.empty else 0
            print(f"DEBUG: Found {total_high_schools_check} distinct high schools in database")
            print(f"DEBUG: User role: {user_scope['role']}, Filters received: {filters}")
        except Exception as check_error:
            print(f"DEBUG: Error checking high school count: {check_error}")
            total_high_schools_check = 0
        
        try:
            print(f"DEBUG: Executing high school analytics query with {len(where_clauses)} additional filters")
            print(f"DEBUG: Where clauses: {where_clauses}")
            print(f"DEBUG: Query params: {params}")
            df = pd.read_sql_query(text(query), engine, params=params)
            print(f"DEBUG: Query returned {len(df)} rows")
            if len(df) > 0:
                print(f"DEBUG: First row sample: {df.iloc[0].to_dict()}")
        except Exception as query_error:
            print(f"High school analytics query error: {query_error}")
            print(f"Query: {query}")
            print(f"Params: {params}")
            engine.dispose()
            return jsonify({
                'data': [],
                'summary': {
                    'total_high_schools': 0,
                    'total_students': 0,
                    'avg_retention_rate': 0,
                    'avg_graduation_rate': 0,
                    'avg_tuition_completion_rate': 0,
                    'avg_performance': 0,
                    'correlation_analysis': {
                        'high_perf_high_tuition': 0,
                        'high_perf_low_tuition': 0,
                        'low_perf_high_tuition': 0,
                        'low_perf_low_tuition': 0
                    }
                },
                'error': str(query_error),
                'debug_info': {
                    'total_high_schools_in_db': int(total_high_schools_check),
                    'query': query[:500] if len(query) > 500 else query,
                    'params': params
                }
            }), 200
        
        engine.dispose()
        
        # Calculate rates and relationships
        if not df.empty:
            df['retention_rate'] = (df['active_students'] / df['total_students'] * 100).round(2)
            df['graduation_rate'] = (df['graduated_students'] / df['total_students'] * 100).round(2)
            df['dropout_rate'] = (df['withdrawn_students'] / df['total_students'] * 100).round(2)
            df['fex_rate'] = (df['total_fex'] / (df['total_fex'] + df['total_mex'] + df['total_fex'].fillna(0) + 1) * 100).round(2)
            df['tuition_completion_rate'] = df['tuition_completion_rate'].fillna(0).round(2)
            
            # Performance vs Tuition Completion correlation
            df['performance_tuition_correlation'] = df.apply(
                lambda row: 'High Performance, High Tuition Completion' if row['avg_grade'] >= 70 and row['tuition_completion_rate'] >= 80
                else 'High Performance, Low Tuition Completion' if row['avg_grade'] >= 70 and row['tuition_completion_rate'] < 80
                else 'Low Performance, High Tuition Completion' if row['avg_grade'] < 70 and row['tuition_completion_rate'] >= 80
                else 'Low Performance, Low Tuition Completion', axis=1
            )
        
        # Prepare response data
        data_records = df.to_dict('records') if not df.empty else []
        
        # Calculate summary - handle empty dataframe
        if df.empty:
            summary = {
                'total_high_schools': 0,
                'total_students': 0,
                'avg_retention_rate': 0,
                'avg_graduation_rate': 0,
                'avg_tuition_completion_rate': 0,
                'avg_performance': 0,
                'correlation_analysis': {
                    'high_perf_high_tuition': 0,
                    'high_perf_low_tuition': 0,
                    'low_perf_high_tuition': 0,
                    'low_perf_low_tuition': 0
                }
            }
            # Include debug info when no data
            debug_info = {
                'total_high_schools_in_db': int(total_high_schools_check),
                'filters_applied': filters,
                'where_clauses_count': len(where_clauses),
                'message': 'No data matches the current filters. Try adjusting your filters or clearing them to see all data.'
            }
        else:
            summary = {
                'total_high_schools': len(df),
                'total_students': int(df['total_students'].sum()),
                'avg_retention_rate': round(df['retention_rate'].mean(), 2),
                'avg_graduation_rate': round(df['graduation_rate'].mean(), 2),
                'avg_tuition_completion_rate': round(df['tuition_completion_rate'].mean(), 2),
                'avg_performance': round(df['avg_grade'].mean(), 2),
                'correlation_analysis': {
                    'high_perf_high_tuition': int(len(df[(df['avg_grade'] >= 70) & (df['tuition_completion_rate'] >= 80)])),
                    'high_perf_low_tuition': int(len(df[(df['avg_grade'] >= 70) & (df['tuition_completion_rate'] < 80)])),
                    'low_perf_high_tuition': int(len(df[(df['avg_grade'] < 70) & (df['tuition_completion_rate'] >= 80)])),
                    'low_perf_low_tuition': int(len(df[(df['avg_grade'] < 70) & (df['tuition_completion_rate'] < 80)]))
                }
            }
            debug_info = {
                'total_high_schools_in_db': int(total_high_schools_check),
                'rows_returned': len(df)
            }
        
        return jsonify({
            'data': data_records,
            'summary': summary,
            'debug_info': debug_info
        }), 200
        
    except Exception as e:
        import traceback
        print(f"Error in get_high_school_analytics: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/academic-risk', methods=['GET'])
@jwt_required()
def get_academic_risk_dashboard():
    """Get high-level academic risk summary for the institution"""
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        
        # Check permission (Senate, Analyst, Dean, HOD, Sysadmin)
        if not has_permission(user_scope['role'], Resource.ANALYTICS, Permission.READ, user_scope):
            return jsonify({'error': 'Permission denied'}), 403
            
        filters = request.args.to_dict()
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        
        # Default window: current semester only when no explicit semester/academic_year is provided
        # (or when dropdowns are effectively set to "all").
        current_semester = None
        sem_raw = (filters.get('semester_id') or '').strip()
        ay_raw = (filters.get('academic_year') or '').strip()
        no_explicit_semester = sem_raw == '' or sem_raw.lower() == 'all'
        no_explicit_year = ay_raw == '' or ay_raw.lower() == 'all'
        if no_explicit_semester and no_explicit_year:
            try:
                recent_sql = """
                SELECT
                    ds.academic_year,
                    fg.semester_id
                FROM fact_grade fg
                JOIN dim_student ds ON fg.student_id = ds.student_id
                WHERE fg.semester_id IS NOT NULL
                  AND ds.academic_year IS NOT NULL
                GROUP BY ds.academic_year, fg.semester_id
                ORDER BY ds.academic_year DESC, fg.semester_id DESC
                LIMIT 1
                """
                recent_df = pd.read_sql_query(text(recent_sql), engine)
                if not recent_df.empty:
                    row = recent_df.iloc[0]
                    ay = str(row.get('academic_year') or '').strip()
                    sem = int(row.get('semester_id')) if row.get('semester_id') is not None else None
                    if ay and sem is not None:
                        current_semester = (ay, sem)
            except Exception:
                current_semester = None
        # We use the v_academic_summary view joining with dim_student for scoping
        # This allows us to see distributions of FCW, MEX, FEX across the institution
        query = """
        SELECT 
            exam_status,
            COUNT(*) as count,
            AVG(grade) as avg_grade
        FROM v_academic_summary
        """
        
        # Re-use build_filter_query logic for scoping
        # Need to join with dim_student in the summary if we want to filter by faculty/dept
        base_query = """
        SELECT 
            exam_status,
            COUNT(*) as count,
            AVG(grade) as avg_grade
        FROM fact_grade fg
        JOIN dim_student ds ON fg.student_id = ds.student_id
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        LEFT JOIN dim_course dc ON fg.course_code = dc.course_code
        """

        q, params = build_filter_query(filters, base_query, user_scope)

        # Constrain summary to the current semester window when applicable
        if current_semester:
            ay, sem = current_semester
            params['ar_ay'] = ay
            params['ar_sem'] = sem
            if "WHERE" in q.upper():
                q += " AND ds.academic_year = :ar_ay AND fg.semester_id = :ar_sem"
            else:
                q += " WHERE ds.academic_year = :ar_ay AND fg.semester_id = :ar_sem"
        q += " GROUP BY exam_status"
        
        df = pd.read_sql_query(text(q), engine, params=params)

        def _row_avg(exam_status_key):
            if df.empty or 'exam_status' not in df.columns:
                return 0.0
            sub = df[df['exam_status'] == exam_status_key]
            if sub.empty or 'avg_grade' not in sub.columns:
                return 0.0
            v = sub.iloc[0]['avg_grade']
            return round(float(v), 2) if pd.notna(v) else 0.0

        # Key categories per status
        stats = {
            'fcw_count': int(df[df['exam_status'] == 'FCW']['count'].sum()) if not df.empty and 'FCW' in df['exam_status'].values else 0,
            'mex_count': int(df[df['exam_status'] == 'MEX']['count'].sum()) if not df.empty and 'MEX' in df['exam_status'].values else 0,
            'fex_count': int(df[df['exam_status'] == 'FEX']['count'].sum()) if not df.empty and 'FEX' in df['exam_status'].values else 0,
            'completed_count': int(df[df['exam_status'] == 'Completed']['count'].sum()) if not df.empty and 'Completed' in df['exam_status'].values else 0,
            # Avg academic standing = mean grade on completed exams only (not mean of per-status averages)
            'avg_grade': _row_avg('Completed'),
        }

        # Risk trend by semester (last 12 semesters in scope) — keys match frontend SciLineChart yDataKeys
        trend_query = """
        SELECT
            fg.semester_id,
            MAX(sem.academic_year) AS sort_year,
            COALESCE(MAX(sem.academic_year::text), '') ||
                CASE WHEN MAX(sem.academic_year) IS NOT NULL AND MAX(sem.semester_name) IS NOT NULL THEN ' · ' ELSE '' END ||
                COALESCE(MAX(sem.semester_name), 'Semester ' || fg.semester_id::text) AS period,
            COUNT(CASE WHEN fg.fcw THEN 1 END) AS fcw_count,
            COUNT(CASE WHEN fg.exam_status = 'MEX' THEN 1 END) AS mex_count,
            COUNT(CASE WHEN fg.exam_status = 'FEX' THEN 1 END) AS fex_count
        FROM fact_grade fg
        LEFT JOIN dim_semester sem ON fg.semester_id = sem.semester_id
        JOIN dim_student ds ON fg.student_id = ds.student_id
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        LEFT JOIN dim_course dc ON fg.course_code = dc.course_code
        """
        tq, tparams = build_filter_query(filters, trend_query, user_scope)
        # Do not pin trend to "current semester only" — show historical semesters for the same org filters.
        if "WHERE" in tq.upper():
            tq += " AND fg.semester_id IS NOT NULL"
        else:
            tq += " WHERE fg.semester_id IS NOT NULL"
        tq += """
        GROUP BY fg.semester_id
        ORDER BY MAX(sem.academic_year) DESC NULLS LAST, fg.semester_id DESC
        LIMIT 12
        """

        trend_df = pd.read_sql_query(text(tq), engine, params=tparams)
        # Oldest → newest on the X axis (chronological left-to-right)
        if not trend_df.empty:
            trend_df = trend_df.sort_values(
                by=['sort_year', 'semester_id'],
                ascending=[True, True],
                na_position='first',
            )
        trend_records = trend_df.to_dict('records')
        
        # At-risk breakdown (those with 2+ failures)
        risk_list_query = """
        SELECT 
            ds.student_id, ds.access_number, ds.reg_no, ds.first_name, ds.last_name,
            COUNT(CASE WHEN fg.exam_status IN ('FEX', 'MEX', 'FCW') THEN 1 END) as risk_points,
            AVG(fg.grade) as avg_grade
        FROM fact_grade fg
        JOIN dim_student ds ON fg.student_id = ds.student_id
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        LEFT JOIN dim_course dc ON fg.course_code = dc.course_code
        """
        rq, rparams = build_filter_query(filters, risk_list_query, user_scope)

        # Constrain at-risk list to the current semester; HAVING 2+ failures then means 2+ in current semester
        if current_semester:
            ay, sem = current_semester
            rparams['rl_ay'] = ay
            rparams['rl_sem'] = sem
            if "WHERE" in rq.upper():
                rq += " AND ds.academic_year = :rl_ay AND fg.semester_id = :rl_sem"
            else:
                rq += " WHERE ds.academic_year = :rl_ay AND fg.semester_id = :rl_sem"
        rq += " GROUP BY ds.student_id, ds.access_number, ds.reg_no, ds.first_name, ds.last_name HAVING COUNT(CASE WHEN fg.exam_status IN ('FEX', 'MEX', 'FCW') THEN 1 END) >= 2 ORDER BY risk_points DESC LIMIT 200"
        
        risk_list_df = pd.read_sql_query(text(rq), engine, params=rparams)
        
        engine.dispose()
        return jsonify({
            'summary': stats,
            'trends': trend_records,
            'at_risk_students': risk_list_df.to_dict('records')
        }), 200
        
    except Exception as e:
        import traceback
        print(f"Error in get_academic_risk_dashboard: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/high-school-risk-correlation-legacy', methods=['GET'])
@jwt_required()
def get_high_school_risk_correlation_legacy():
    """Legacy version of high school risk correlation kept for backwards compatibility."""
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        
        if not has_permission(user_scope['role'], Resource.HIGH_SCHOOL_ANALYTICS, Permission.READ, user_scope):
            return jsonify({'error': 'Permission denied'}), 403
            
        filters = request.args.to_dict()
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        
        base_query = """
        SELECT 
            ds.high_school as school,
            COALESCE(ds.high_school_district, 'Unknown') as district,
            COUNT(DISTINCT ds.student_id) as total_students,
            AVG(CASE WHEN fg.fcw OR fg.exam_status IN ('FEX', 'MEX') THEN 1.0 ELSE 0.0 END) * 100 as fcw_rate,
            AVG(fg.grade) as avg_gpa
        FROM dim_student ds
        LEFT JOIN fact_grade fg ON ds.student_id = fg.student_id
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        WHERE ds.high_school IS NOT NULL AND ds.high_school != ''
        """
        
        q, params = build_filter_query(filters, base_query, user_scope)
        if " WHERE " in q:
            q = q.replace(" WHERE ", " AND ")
            q = base_query + q
        
        q += " GROUP BY ds.high_school, ds.high_school_district"
        
        df = pd.read_sql_query(text(q), engine, params=params)
        
        district_query = """
        SELECT 
            ds.high_school_district as district,
            AVG(CASE WHEN fg.fcw OR fg.exam_status IN ('FEX', 'MEX') THEN 1.0 ELSE 0.0 END) * 100 as avg_fcw_rate,
            AVG(fg.grade) as avg_grade
        FROM dim_student ds
        LEFT JOIN fact_grade fg ON ds.student_id = fg.student_id
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        WHERE ds.high_school_district IS NOT NULL AND ds.high_school_district != ''
        """
        dq, dparams = build_filter_query(filters, district_query, user_scope)
        if " WHERE " in dq:
            dq = dq.replace(" WHERE ", " AND ")
            dq = district_query + dq
        dq += " GROUP BY ds.high_school_district"
        
        district_df = pd.read_sql_query(text(dq), engine, params=dparams)
        
        engine.dispose()
        return jsonify({
            'by_school': df.to_dict('records'),
            'by_district': district_df.to_dict('records')
        }), 200
        
    except Exception as e:
        import traceback
        print(f"Error in get_high_school_risk_correlation_legacy: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/finance', methods=['GET'])
@jwt_required()
def get_finance_analytics():
    """
    Finance analytics: tuition expected vs paid, outstanding balances, and payment rate.

    Defaults to the current semester when no explicit semester_id/academic_year is provided.
    """
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        role = user_scope['role']
        
        # Only finance-facing roles should use this endpoint directly
        if role not in {Role.FINANCE, Role.SYSADMIN, Role.ANALYST}:
            return jsonify({'error': 'Permission denied'}), 403
        if not has_permission(role, Resource.FINANCE_ANALYTICS, Permission.READ, user_scope) and role not in {
            Role.SYSADMIN,
            Role.ANALYST,
        }:
            return jsonify({'error': 'Permission denied'}), 403

        filters = request.args.to_dict()
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)

        # Determine current semester window (academic_year + semester_id) when no explicit filters exist.
        current_semester = None
        if not filters.get('semester_id') and not filters.get('academic_year'):
            try:
                recent_sql = """
                SELECT
                    ds.academic_year,
                    fp.semester_id
                FROM fact_payment fp
                JOIN dim_student ds ON fp.student_id = ds.student_id
                WHERE fp.semester_id IS NOT NULL
                  AND ds.academic_year IS NOT NULL
                GROUP BY ds.academic_year, fp.semester_id
                ORDER BY ds.academic_year DESC, fp.semester_id DESC
                LIMIT 1
                """
                recent_df = pd.read_sql_query(text(recent_sql), engine)
                if not recent_df.empty:
                    row = recent_df.iloc[0]
                    ay = str(row.get('academic_year') or '').strip()
                    sem = int(row.get('semester_id')) if row.get('semester_id') is not None else None
                    if ay and sem is not None:
                        current_semester = (ay, sem)
            except Exception:
                current_semester = None

        # Base payment query: scoped to role and filters via build_filter_query (using dim_student joins).
        base_q = """
        SELECT
            SUM(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END) AS total_payments,
            SUM(CASE WHEN fp.status = 'Pending' THEN fp.amount ELSE 0 END)   AS total_pending,
            SUM(fp.amount)                                                   AS total_required
        FROM fact_payment fp
        JOIN dim_student ds ON fp.student_id = ds.student_id
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        """
        pay_q, pay_params = build_filter_query(filters, base_q, user_scope)

        if current_semester:
            ay, sem = current_semester
            pay_params['fin_ay'] = ay
            pay_params['fin_sem'] = sem
            if "WHERE" in pay_q.upper():
                pay_q += " AND ds.academic_year = :fin_ay AND fp.semester_id = :fin_sem"
            else:
                pay_q += " WHERE ds.academic_year = :fin_ay AND fp.semester_id = :fin_sem"

        payments_df = pd.read_sql_query(text(pay_q), engine, params=pay_params)
        total_payments = float(payments_df['total_payments'][0]) if not payments_df.empty and pd.notna(
            payments_df['total_payments'][0]
        ) else 0.0
        total_pending = float(payments_df['total_pending'][0]) if not payments_df.empty and pd.notna(
            payments_df['total_pending'][0]
        ) else 0.0
        total_required = float(payments_df['total_required'][0]) if not payments_df.empty and pd.notna(
            payments_df['total_required'][0]
        ) else 0.0

        payment_rate = 0.0
        if total_required > 0:
            payment_rate = round((total_payments / total_required) * 100, 1)

        # Total students in scope (for denominator / context)
        students_q = """
        SELECT COUNT(DISTINCT ds.student_id) AS total_students
        FROM dim_student ds
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        """
        stu_q, stu_params = build_filter_query(filters, students_q, user_scope)
        if current_semester:
            ay, sem = current_semester
            stu_params['stu_ay'] = ay
            stu_params['stu_sem'] = sem
            if "WHERE" in stu_q.upper():
                stu_q += " AND ds.academic_year = :stu_ay"
            else:
                stu_q += " WHERE ds.academic_year = :stu_ay"

        students_df = pd.read_sql_query(text(stu_q), engine, params=stu_params)
        total_students = int(students_df['total_students'][0]) if not students_df.empty and pd.notna(
            students_df['total_students'][0]
        ) else 0

        engine.dispose()
        return jsonify(
            {
                'total_payments': total_payments,
                'total_pending': total_pending,
                'total_required': total_required,
                'payment_rate': payment_rate,
                'total_students': total_students,
            }
        ), 200
    except Exception as e:
        import traceback
        print(f"Error in get_finance_analytics: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@analytics_bp.route('/staff/classes', methods=['GET'])
@jwt_required()
def get_staff_classes():
    """Return classes assigned to the current staff member. Staff role only (Phase 3 scope)."""
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        if user_scope['role'] != Role.STAFF:
            return jsonify({'error': 'Permission denied. Staff role required for class assignments.'}), 403

        username = claims.get('username')
        rbac_engine = create_engine(get_sqlalchemy_conn_string('ucu_rbac'))
        
        # Join staff_course_assignments with dim_course from warehouse
        # Since they are different DBs, we'll do two queries or use a cross-db join if possible.
        # Most reliable: get codes from RBAC, then details from DW.
        codes_df = pd.read_sql_query(
            text("""
                SELECT sca.course_code FROM staff_course_assignments sca
                JOIN app_users u ON u.id = sca.app_user_id
                WHERE LOWER(u.username) = :uname
            """),
            rbac_engine, params={'uname': str(username).lower()}
        )
        rbac_engine.dispose()
        
        if codes_df.empty:
            return jsonify({'classes': []}), 200
            
        course_codes = codes_df['course_code'].tolist()
        
        dw_engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        courses_df = pd.read_sql_query(
            text("SELECT * FROM dim_course WHERE course_code IN :codes"),
            dw_engine, params={'codes': tuple(course_codes)}
        )
        
        # Add basic stats per course
        stats_df = pd.read_sql_query(
            text("""
                SELECT 
                    course_code,
                    COUNT(DISTINCT student_id) as student_count,
                    AVG(grade) as avg_grade,
                    COUNT(CASE WHEN exam_status = 'FEX' THEN 1 END) as fex_count
                FROM fact_grade
                WHERE course_code IN :codes
                GROUP BY course_code
            """),
            dw_engine, params={'codes': tuple(course_codes)}
        )
        dw_engine.dispose()
        
        # Merge stats
        result_df = pd.merge(courses_df, stats_df, on='course_code', how='left').fillna(0)
        
        return jsonify({'classes': result_df.to_dict('records')}), 200
        
    except Exception as e:
        print(f"Error in get_staff_classes: {e}")
        return jsonify({'error': str(e)}), 500


def _filter_options_fallback_faculties(engine, role, user_scope, faculty_id, department_id, program_id):
    """Get faculties; if dim_faculty is empty, derive from dim_student -> program -> department -> faculty."""
    try:
        if role == Role.HOD and user_scope.get('department_id'):
            q = """
                SELECT DISTINCT d.faculty_id, f.faculty_name 
                FROM dim_department d
                JOIN dim_faculty f ON d.faculty_id = f.faculty_id
                WHERE d.department_id = :dept_id
            """
            df = pd.read_sql_query(text(q), engine, params={'dept_id': user_scope['department_id']})
        elif role == Role.DEAN and user_scope.get('faculty_id'):
            q = "SELECT DISTINCT faculty_id, faculty_name FROM dim_faculty WHERE faculty_id = :fac_id"
            df = pd.read_sql_query(text(q), engine, params={'fac_id': user_scope['faculty_id']})
        else:
            df = pd.read_sql_query(
                text("SELECT DISTINCT faculty_id, faculty_name FROM dim_faculty ORDER BY faculty_name"),
                engine,
            )
        recs = df.to_dict('records') if not df.empty else []
        if recs:
            return recs
        # Fallback: derive from students -> program -> department -> faculty
        q = """
            SELECT DISTINCT d.faculty_id, f.faculty_name
            FROM dim_student ds
            JOIN dim_program p ON ds.program_id = p.program_id
            JOIN dim_department d ON p.department_id = d.department_id
            JOIN dim_faculty f ON d.faculty_id = f.faculty_id
            ORDER BY f.faculty_name
        """
        df = pd.read_sql_query(text(q), engine)
        return df.to_dict('records') if not df.empty else []
    except Exception:
        return []


@analytics_bp.route('/filter-options', methods=['GET'])
@jwt_required()
def get_filter_options():
    """Get available filter options based on user role with cascading support.
    Faculties -> Departments -> Programs -> Courses. Fallback from fact/student data when dims are empty."""
    engine = None
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        
        faculty_id = request.args.get('faculty_id', type=int)
        department_id = request.args.get('department_id', type=int)
        program_id = request.args.get('program_id', type=int)
        semester_id_filter = request.args.get('semester_id', type=int)
        intake_year_filter = request.args.get('intake_year', type=int)
        
        options = {
            'faculties': [],
            'departments': [],
            'programs': [],
            'courses': [],
            'semesters': [],
            'high_schools': [],
            'intake_years': []
        }
        role = user_scope['role']
        
        # --- Faculties (with fallback from student data) ---
        if role == Role.STUDENT:
            options['faculties'] = []
        else:
            options['faculties'] = _filter_options_fallback_faculties(
                engine, role, user_scope, faculty_id, department_id, program_id
            )
        
        # --- Departments (filtered by faculty; fallback from student data) ---
        if role == Role.STUDENT:
            options['departments'] = []
        else:
            try:
                dept_query = """
                    SELECT DISTINCT d.department_id, d.department_name, d.faculty_id
                    FROM dim_department d
                """
                dept_where = []
                if role == Role.HOD and user_scope.get('department_id'):
                    dept_where.append(f"d.department_id = {user_scope['department_id']}")
                elif role == Role.DEAN and user_scope.get('faculty_id') and not faculty_id:
                    dept_where.append(f"d.faculty_id = {user_scope['faculty_id']}")
                if faculty_id:
                    dept_where.append(f"d.faculty_id = {faculty_id}")
                if dept_where:
                    dept_query += " WHERE " + " AND ".join(dept_where)
                dept_query += " ORDER BY d.department_name"

                df = pd.read_sql_query(text(dept_query), engine)
                options['departments'] = df.to_dict('records') if not df.empty else []
                if not options['departments']:
                    fallback = """
                        SELECT DISTINCT d.department_id, d.department_name, d.faculty_id
                        FROM dim_student ds
                        JOIN dim_program p ON ds.program_id = p.program_id
                        JOIN dim_department d ON p.department_id = d.department_id
                        ORDER BY d.department_name
                    """
                    df2 = pd.read_sql_query(text(fallback), engine)
                    options['departments'] = df2.to_dict('records') if not df2.empty else []
            except Exception:
                options['departments'] = []
        
        # --- Programs (filtered by department/faculty; fallback from student data) ---
        if role == Role.STUDENT:
            # Students: restrict programs to what the current student is actually in.
            if user_scope.get('student_id'):
                try:
                    q = """
                        SELECT DISTINCT p.program_id, p.program_name, p.department_id, d.faculty_id
                        FROM dim_program p
                        JOIN dim_department d ON p.department_id = d.department_id
                        JOIN dim_student ds ON p.program_id = ds.program_id
                        WHERE ds.student_id = :student_id
                    """
                    df = pd.read_sql_query(text(q), engine, params={'student_id': user_scope['student_id']})
                    options['programs'] = df.to_dict('records') if not df.empty else []
                except Exception:
                    options['programs'] = []
            else:
                options['programs'] = []
        else:
            try:
                prog_query = """
                    SELECT DISTINCT p.program_id, p.program_name, p.department_id, d.faculty_id
                    FROM dim_program p
                    JOIN dim_department d ON p.department_id = d.department_id
                """
                prog_where = []
                if role == Role.HOD and user_scope.get('department_id') and not department_id:
                    prog_where.append(f"p.department_id = {user_scope['department_id']}")
                elif role == Role.DEAN and user_scope.get('faculty_id') and not faculty_id and not department_id:
                    prog_where.append(f"d.faculty_id = {user_scope['faculty_id']}")
                if department_id:
                    prog_where.append(f"p.department_id = {department_id}")
                elif faculty_id:
                    prog_where.append(f"d.faculty_id = {faculty_id}")
                if prog_where:
                    prog_query += " WHERE " + " AND ".join(prog_where)
                prog_query += " ORDER BY p.program_name"

                df = pd.read_sql_query(text(prog_query), engine)
                options['programs'] = df.to_dict('records') if not df.empty else []
                if not options['programs']:
                    fallback = """
                        SELECT DISTINCT p.program_id, p.program_name, p.department_id, d.faculty_id
                        FROM dim_student ds
                        JOIN dim_program p ON ds.program_id = p.program_id
                        JOIN dim_department d ON p.department_id = d.department_id
                        ORDER BY p.program_name
                    """
                    df2 = pd.read_sql_query(text(fallback), engine)
                    options['programs'] = df2.to_dict('records') if not df2.empty else []
            except Exception:
                options['programs'] = []
        
        # --- Courses (filtered by department/faculty; fallback from fact_grade) ---
        try:
            if role == Role.STUDENT:
                # Restrict courses to those the current student has grades for.
                if user_scope.get('student_id'):
                    q = """
                        SELECT DISTINCT c.course_code, c.course_name
                        FROM dim_course c
                        JOIN fact_grade fg ON c.course_code = fg.course_code
                        WHERE fg.student_id = :student_id
                        ORDER BY c.course_code
                    """
                    df = pd.read_sql_query(text(q), engine, params={'student_id': user_scope['student_id']})
                    options['courses'] = df.to_dict('records') if not df.empty else []
                else:
                    options['courses'] = []
            else:
                # Start with all courses, then narrow by department/faculty/role.
                course_query = "SELECT DISTINCT course_code, course_name FROM dim_course ORDER BY course_code"
                params = {}

                if department_id:
                    course_query = """
                        SELECT DISTINCT c.course_code, c.course_name
                        FROM dim_course c
                        WHERE c.department = (SELECT department_name FROM dim_department WHERE department_id = :dept_id)
                        ORDER BY c.course_code
                    """
                    params = {'dept_id': department_id}
                elif faculty_id:
                    course_query = """
                        SELECT DISTINCT c.course_code, c.course_name
                        FROM dim_course c
                        JOIN dim_department d ON c.department = d.department_name
                        WHERE d.faculty_id = :fac_id
                        ORDER BY c.course_code
                    """
                    params = {'fac_id': faculty_id}
                elif role == Role.HOD and user_scope.get('department_id'):
                    course_query = """
                        SELECT DISTINCT c.course_code, c.course_name
                        FROM dim_course c
                        WHERE c.department = (SELECT department_name FROM dim_department WHERE department_id = :dept_id)
                        ORDER BY c.course_code
                    """
                    params = {'dept_id': user_scope['department_id']}
                elif role == Role.DEAN and user_scope.get('faculty_id'):
                    course_query = """
                        SELECT DISTINCT c.course_code, c.course_name
                        FROM dim_course c
                        JOIN dim_department d ON c.department = d.department_name
                        WHERE d.faculty_id = :fac_id
                        ORDER BY c.course_code
                    """
                    params = {'fac_id': user_scope['faculty_id']}

                df = pd.read_sql_query(text(course_query), engine, params=params or None)
                options['courses'] = df.to_dict('records') if not df.empty else []

                # Fallback: derive course list from fact_grade when dim_course is sparse.
                if not options['courses']:
                    df2 = pd.read_sql_query(
                        text(
                            "SELECT DISTINCT fg.course_code, "
                            "COALESCE(c.course_name, fg.course_code) AS course_name "
                            "FROM fact_grade fg "
                            "LEFT JOIN dim_course c ON fg.course_code = c.course_code "
                            "WHERE fg.course_code IS NOT NULL "
                            "ORDER BY fg.course_code"
                        ),
                        engine,
                    )
                    options['courses'] = df2.to_dict('records') if not df2.empty else []
        except Exception:
            options['courses'] = []
        
        # --- Semesters (fallback from fact_grade if dim_semester empty) ---
        try:
            df = pd.read_sql_query(
                text("SELECT semester_id, semester_name FROM dim_semester ORDER BY semester_id"),
                engine,
            )
            options['semesters'] = df.to_dict('records') if not df.empty else []
            if not options['semesters']:
                df2 = pd.read_sql_query(
                    text(
                        "SELECT DISTINCT semester_id, 'Semester ' || semester_id as semester_name "
                        "FROM fact_grade WHERE semester_id IS NOT NULL ORDER BY semester_id"
                    ),
                    engine,
                )
                options['semesters'] = df2.to_dict('records') if not df2.empty else []
            for r in options['semesters']:
                if r.get('semester_id') is not None and isinstance(r['semester_id'], (float,)):
                    r['semester_id'] = int(r['semester_id'])
        except Exception:
            options['semesters'] = []
        
        # --- High schools (role-based; fallback all students) ---
        if role == Role.STUDENT:
            options['high_schools'] = []
        else:
            if role == Role.DEAN and user_scope.get('faculty_id') and not faculty_id:
                q = """
                    SELECT DISTINCT ds.high_school, ds.high_school_district
                    FROM dim_student ds
                    JOIN dim_program p ON ds.program_id = p.program_id
                    JOIN dim_department d ON p.department_id = d.department_id
                    WHERE ds.high_school IS NOT NULL AND ds.high_school != '' AND d.faculty_id = :fac_id
                    ORDER BY ds.high_school
                """
                df = pd.read_sql_query(text(q), engine, params={'fac_id': user_scope['faculty_id']})
            elif role == Role.HOD and user_scope.get('department_id') and not department_id:
                q = """
                    SELECT DISTINCT ds.high_school, ds.high_school_district
                    FROM dim_student ds
                    JOIN dim_program p ON ds.program_id = p.program_id
                    WHERE ds.high_school IS NOT NULL AND ds.high_school != '' AND p.department_id = :dept_id
                    ORDER BY ds.high_school
                """
                df = pd.read_sql_query(text(q), engine, params={'dept_id': user_scope['department_id']})
            else:
                df = pd.read_sql_query(
                    text(
                        "SELECT DISTINCT high_school, high_school_district "
                        "FROM dim_student "
                        "WHERE high_school IS NOT NULL AND high_school != '' "
                        "ORDER BY high_school"
                    ),
                    engine,
                )
            options['high_schools'] = df.to_dict('records') if not df.empty else []
        
        # --- Intake years ---
        # Non-students: always expose the full supported UI window (2021–2026) so the
        # Year dropdown always shows choices when opened (not only years present in data).
        # Students: keep years derived from their record(s) only.
        if role == Role.STUDENT:
            if user_scope.get('student_id'):
                df = pd.read_sql_query(
                    text(
                        "SELECT DISTINCT EXTRACT(YEAR FROM admission_date) as year "
                        "FROM dim_student "
                        "WHERE student_id = :sid AND admission_date IS NOT NULL"
                    ),
                    engine,
                    params={'sid': user_scope['student_id']},
                )
            else:
                df = pd.DataFrame()
            if not df.empty and 'year' in df.columns:
                years = []
                for y in df['year'].tolist():
                    if y is None or pd.isna(y):
                        continue
                    try:
                        years.append(int(float(y)))
                    except Exception:
                        continue
                base_years = [y for y in years if y is not None and 2021 <= y <= 2026]
                if semester_id_filter in (2, 3):
                    base_years = [y for y in base_years if y != 2026]
                options['intake_years'] = sorted(set(base_years), reverse=True)
            else:
                options['intake_years'] = []
        else:
            static_years = list(range(2021, 2027))
            if semester_id_filter in (2, 3):
                static_years = [y for y in static_years if y != 2026]
            options['intake_years'] = sorted(static_years, reverse=True)

        # If a specific intake year (e.g., 2026) is selected, restrict semesters accordingly:
        # - For 2026, only January/Easter (semester_id = 1) should be visible
        if intake_year_filter == 2026 and options['semesters']:
            options['semesters'] = [
                s for s in options['semesters']
                if str(s.get('semester_id')) == '1'
            ]
        
        if engine is not None:
            try:
                engine.dispose()
            except Exception:
                pass
        return jsonify(options), 200
        
    except Exception as e:
        import traceback
        print(f"Error in get_filter_options: {e}")
        print(traceback.format_exc())
        if engine:
            try:
                engine.dispose()
            except Exception:
                pass
        fallback_options = locals().get('options') or {
            'faculties': [], 'departments': [], 'programs': [], 'courses': [],
            'semesters': [], 'high_schools': [], 'intake_years': []
        }
        # Return safe payload so the frontend filter panel does not break hard.
        return jsonify(fallback_options), 200


@analytics_bp.route('/faculty', methods=['GET'])
@jwt_required()
def get_faculty_analytics():
    """Faculty-level analytics for deans and similar roles.
    Scopes data to the faculty in the JWT (for Role.DEAN) and applies optional filters.
    Returns summary stats plus distributions that the frontend dean dashboard can visualize."""
    engine = None
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)

        # Require general analytics permission
        if not has_permission(user_scope['role'], Resource.ANALYTICS, Permission.READ, user_scope):
            return jsonify({'error': 'Permission denied'}), 403

        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        filters = _jwt_scope_sanitize_filters(request.args.to_dict(), user_scope)

        # Role / faculty scoping for student-based queries
        where_clauses = []
        params: dict = {}

        # Role-based scope – dean limited to their faculty, HOD to their department
        if user_scope['role'] == Role.DEAN and user_scope.get('faculty_id'):
            where_clauses.append("df.faculty_id = :faculty_id")
            params['faculty_id'] = int(user_scope['faculty_id'])
        elif user_scope['role'] == Role.HOD and user_scope.get('department_id'):
            where_clauses.append("ddept.department_id = :department_id")
            params['department_id'] = int(user_scope['department_id'])

        # Additional filters (cannot widen dean scope – they combine with above)
        if filters.get('faculty_id'):
            try:
                params['filter_faculty_id'] = int(filters['faculty_id'])
                where_clauses.append("df.faculty_id = :filter_faculty_id")
            except (ValueError, TypeError):
                pass
        if filters.get('department_id'):
            try:
                params['filter_department_id'] = int(filters['department_id'])
                where_clauses.append("ddept.department_id = :filter_department_id")
            except (ValueError, TypeError):
                pass
        if filters.get('program_id'):
            try:
                params['filter_program_id'] = int(filters['program_id'])
                where_clauses.append("dp.program_id = :filter_program_id")
            except (ValueError, TypeError):
                pass
        if filters.get('access_number'):
            params['filter_access_number'] = str(filters['access_number']).strip().upper()
            where_clauses.append("ds.access_number = :filter_access_number")
        if filters.get('reg_number'):
            params['filter_reg_no'] = str(filters['reg_number']).strip().upper()
            where_clauses.append("ds.reg_no = :filter_reg_no")
        if filters.get('student_name'):
            params['filter_student_name'] = "%" + str(filters['student_name']).strip() + "%"
            where_clauses.append("(ds.first_name ILIKE :filter_student_name OR ds.last_name ILIKE :filter_student_name OR (ds.first_name || ' ' || ds.last_name) ILIKE :filter_student_name)")
        if filters.get('high_school'):
            params['filter_high_school'] = "%" + str(filters['high_school']).strip() + "%"
            where_clauses.append("ds.high_school ILIKE :filter_high_school")
        if filters.get('intake_year'):
            try:
                params['filter_intake_year'] = int(filters['intake_year'])
                where_clauses.append("EXTRACT(YEAR FROM ds.admission_date) = :filter_intake_year")
            except (ValueError, TypeError):
                pass

        student_where = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        grade_where = "WHERE fg.exam_status = 'Completed'"
        if where_clauses:
            grade_where += " AND " + " AND ".join(where_clauses)
        if filters.get('course_code'):
            params['filter_course_code'] = str(filters['course_code']).strip()
            grade_where += " AND fg.course_code = :filter_course_code"
        if filters.get('semester_id'):
            try:
                params['filter_semester_id'] = int(filters['semester_id'])
                grade_where += " AND fg.semester_id = :filter_semester_id"
            except (ValueError, TypeError):
                pass
        params_student = {k: v for k, v in params.items() if k not in ('filter_course_code', 'filter_semester_id')}

        # fact_enrollment KPIs: apply semester/course on `fe` (same as grade queries), not only student scope
        enroll_params = dict(params_student)
        enroll_fe_bits = []
        if filters.get('course_code') and str(filters.get('course_code', '')).strip().lower() not in ('', 'all'):
            enroll_params['fe_course_code'] = str(filters['course_code']).strip()
            enroll_fe_bits.append("fe.course_code = :fe_course_code")
        if filters.get('semester_id') and str(filters.get('semester_id')).strip().lower() not in ('', 'all'):
            try:
                enroll_params['fe_semester_id'] = int(filters['semester_id'])
                enroll_fe_bits.append("fe.semester_id = :fe_semester_id")
            except (ValueError, TypeError):
                pass
        enroll_fe_sql = ""
        if enroll_fe_bits:
            enroll_fe_sql = (" AND " if student_where else " WHERE ") + " AND ".join(enroll_fe_bits)

        # 1) Total students in scope (faculty / department)
        total_students_q = f"""
        SELECT COUNT(DISTINCT ds.student_id) AS total_students
        FROM dim_student ds
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        {student_where}
        """
        ts_df = pd.read_sql_query(text(total_students_q), engine, params=params_student)
        total_students = int(ts_df['total_students'][0]) if not ts_df.empty and pd.notna(ts_df['total_students'][0]) else 0

        # 1b) Retention (active / total) — same student scope as headcount (aligned with /api/dashboard/stats)
        retention_rate = 0.0
        try:
            ret_q = f"""
            SELECT
                COUNT(DISTINCT CASE WHEN ds.status = 'Active' THEN ds.student_id END) AS active,
                COUNT(DISTINCT ds.student_id) AS total
            FROM dim_student ds
            LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
            LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
            LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
            {student_where}
            """
            ret_df = pd.read_sql_query(text(ret_q), engine, params=params_student)
            if not ret_df.empty and pd.notna(ret_df['total'][0]) and int(ret_df['total'][0]) > 0:
                retention_rate = (float(ret_df['active'][0]) / float(ret_df['total'][0])) * 100.0
        except Exception as e:
            print(f"Error getting faculty retention_rate: {e}")
            retention_rate = 0.0

        # 2) Average grade for students in scope
        avg_grade_q = f"""
        SELECT AVG(fg.grade) AS avg_grade
        FROM fact_grade fg
        JOIN dim_student ds ON fg.student_id = ds.student_id
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        {grade_where}
        """
        ag_df = pd.read_sql_query(text(avg_grade_q), engine, params=params)
        avg_grade = float(ag_df['avg_grade'][0]) if not ag_df.empty and pd.notna(ag_df['avg_grade'][0]) else 0.0

        # 3) Faculty-level course, enrollment, payment, and attendance KPIs
        # Total distinct courses offered within this faculty/department scope
        total_courses = 0
        try:
            courses_q = f"""
            SELECT COUNT(DISTINCT fg.course_code) AS total_courses
            FROM fact_grade fg
            JOIN dim_student ds ON fg.student_id = ds.student_id
            LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
            LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
            LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
            {student_where}
            """
            courses_df = pd.read_sql_query(text(courses_q), engine, params=params_student)
            total_courses = int(courses_df['total_courses'][0]) if not courses_df.empty and pd.notna(courses_df['total_courses'][0]) else 0
        except Exception as e:
            print(f"Error getting faculty total_courses: {e}")
            total_courses = 0

        # Total enrollments (fact_enrollment rows) within scope
        total_enrollments = 0
        try:
            enroll_q = f"""
            SELECT COUNT(*) AS total_enrollments
            FROM fact_enrollment fe
            JOIN dim_student ds ON fe.student_id = ds.student_id
            LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
            LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
            LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
            {student_where}{enroll_fe_sql}
            """
            enroll_df = pd.read_sql_query(text(enroll_q), engine, params=enroll_params)
            total_enrollments = int(enroll_df['total_enrollments'][0]) if not enroll_df.empty and pd.notna(enroll_df['total_enrollments'][0]) else 0
        except Exception as e:
            print(f"Error getting faculty total_enrollments: {e}")
            total_enrollments = 0

        # Average attendance (hours) within scope
        avg_attendance = 0.0
        try:
            att_q = f"""
            SELECT AVG(fa.total_hours) AS avg_attendance
            FROM fact_attendance fa
            JOIN dim_student ds ON fa.student_id = ds.student_id
            LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
            LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
            LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
            {student_where}
            """
            att_df = pd.read_sql_query(text(att_q), engine, params=params_student)
            avg_attendance = float(att_df['avg_attendance'][0]) if not att_df.empty and pd.notna(att_df['avg_attendance'][0]) else 0.0
        except Exception as e:
            print(f"Error getting faculty avg_attendance: {e}")
            avg_attendance = 0.0

        # 4) Students by department
        by_dept_q = f"""
        SELECT 
            COALESCE(ddept.department_name, 'Unknown') AS department,
            COUNT(DISTINCT ds.student_id) AS student_count
        FROM dim_student ds
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        {student_where}
        GROUP BY ddept.department_name
        ORDER BY student_count DESC
        """
        by_dept_df = pd.read_sql_query(text(by_dept_q), engine, params=params_student)
        students_by_department = by_dept_df.to_dict('records') if not by_dept_df.empty else []

        # 5) Students by program
        by_prog_q = f"""
        SELECT 
            COALESCE(dp.program_name, 'Unknown') AS program_name,
            COALESCE(ddept.department_name, 'Unknown') AS department,
            COUNT(DISTINCT ds.student_id) AS student_count
        FROM dim_student ds
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        {student_where}
        GROUP BY dp.program_name, ddept.department_name
        ORDER BY student_count DESC
        """
        by_prog_df = pd.read_sql_query(text(by_prog_q), engine, params=params_student)
        students_by_program = by_prog_df.to_dict('records') if not by_prog_df.empty else []

        # 6) Student demographics (gender + high school)
        by_gender_q = f"""
        SELECT 
            COALESCE(ds.gender, 'U') AS gender,
            COUNT(DISTINCT ds.student_id) AS student_count
        FROM dim_student ds
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        {student_where}
        GROUP BY ds.gender
        """
        by_gender_df = pd.read_sql_query(text(by_gender_q), engine, params=params_student)
        students_by_gender = by_gender_df.to_dict('records') if not by_gender_df.empty else []

        by_hs_q = f"""
        SELECT 
            ds.high_school,
            COUNT(DISTINCT ds.student_id) AS student_count
        FROM dim_student ds
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        {student_where}
        AND ds.high_school IS NOT NULL AND ds.high_school != ''
        GROUP BY ds.high_school
        ORDER BY student_count DESC
        LIMIT 20
        """
        by_hs_df = pd.read_sql_query(text(by_hs_q), engine, params=params_student)

        # 7) Grade distribution within scope
        grade_dist_q = f"""
        SELECT 
            fg.letter_grade,
            COUNT(*) AS count
        FROM fact_grade fg
        JOIN dim_student ds ON fg.student_id = ds.student_id
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        {grade_where}
        GROUP BY fg.letter_grade
        ORDER BY count DESC
        """
        grade_dist_df = pd.read_sql_query(text(grade_dist_q), engine, params=params)
        grade_distribution = grade_dist_df.to_dict('records') if not grade_dist_df.empty else []

        # 8) Performance by department
        perf_dept_q = f"""
        SELECT 
            COALESCE(ddept.department_name, 'Unknown') AS department,
            AVG(fg.grade) AS avg_grade,
            COUNT(DISTINCT ds.student_id) AS student_count
        FROM fact_grade fg
        JOIN dim_student ds ON fg.student_id = ds.student_id
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        {grade_where}
        GROUP BY ddept.department_name
        ORDER BY avg_grade DESC
        """
        perf_dept_df = pd.read_sql_query(text(perf_dept_q), engine, params=params)
        performance_by_department = perf_dept_df.to_dict('records') if not perf_dept_df.empty else []

        # 9) Performance by program
        perf_prog_q = f"""
        SELECT 
            COALESCE(dp.program_name, 'Unknown') AS program_name,
            COALESCE(ddept.department_name, 'Unknown') AS department,
            AVG(fg.grade) AS avg_grade,
            COUNT(DISTINCT ds.student_id) AS student_count
        FROM fact_grade fg
        JOIN dim_student ds ON fg.student_id = ds.student_id
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        {grade_where}
        GROUP BY dp.program_name, ddept.department_name
        ORDER BY avg_grade DESC
        """
        perf_prog_df = pd.read_sql_query(text(perf_prog_q), engine, params=params)
        performance_by_program = perf_prog_df.to_dict('records') if not perf_prog_df.empty else []

        # 10) Top 10 students in scope (by average grade)
        top_students_q = f"""
        SELECT 
            ds.student_id,
            ds.access_number,
            ds.reg_no,
            CONCAT(ds.first_name, ' ', ds.last_name) AS full_name,
            COALESCE(dp.program_name, 'Unknown') AS program_name,
            COALESCE(ddept.department_name, 'Unknown') AS department,
            AVG(fg.grade) AS avg_grade
        FROM fact_grade fg
        JOIN dim_student ds ON fg.student_id = ds.student_id
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        {grade_where}
        GROUP BY ds.student_id, ds.access_number, ds.reg_no, ds.first_name, ds.last_name,
                 dp.program_name, ddept.department_name
        ORDER BY avg_grade DESC
        LIMIT 10
        """
        top_students_df = pd.read_sql_query(text(top_students_q), engine, params=params)
        top_students = top_students_df.to_dict('records') if not top_students_df.empty else []

        # 11) Tuition payment distribution & trends within faculty scope
        payment_where = "WHERE 1=1"
        if where_clauses:
            payment_where += " AND " + " AND ".join(where_clauses)

        payment_status_q = f"""
        SELECT 
            fp.status,
            COUNT(*) AS payment_count,
            COALESCE(SUM(fp.amount), 0) AS total_amount
        FROM fact_payment fp
        JOIN dim_student ds ON fp.student_id = ds.student_id
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        {payment_where}
        GROUP BY fp.status
        """
        pay_status_df = pd.read_sql_query(text(payment_status_q), engine, params=params_student)
        payment_status = pay_status_df.to_dict('records') if not pay_status_df.empty else []

        payment_trend_q = f"""
        SELECT 
            fp.year,
            fp.semester_id,
            COALESCE(SUM(fp.amount), 0) AS total_amount
        FROM fact_payment fp
        JOIN dim_student ds ON fp.student_id = ds.student_id
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        {payment_where}
        GROUP BY fp.year, fp.semester_id
        ORDER BY fp.year, fp.semester_id
        """
        pay_trend_df = pd.read_sql_query(text(payment_trend_q), engine, params=params_student)
        payment_trends = pay_trend_df.to_dict('records') if not pay_trend_df.empty else []

        # 12) Staff summary for this faculty from dim_employee
        staff_where_clauses = []
        staff_params: dict = {}
        if user_scope['role'] == Role.DEAN and user_scope.get('faculty_id'):
            staff_where_clauses.append("df.faculty_id = :staff_faculty_id")
            staff_params['staff_faculty_id'] = int(user_scope['faculty_id'])
        elif user_scope['role'] == Role.HOD and user_scope.get('department_id'):
            staff_where_clauses.append("ddept.department_id = :staff_department_id")
            staff_params['staff_department_id'] = int(user_scope['department_id'])
        staff_where = "WHERE " + " AND ".join(staff_where_clauses) if staff_where_clauses else ""

        staff_summary_q = f"""
        SELECT COUNT(*) AS total_staff
        FROM dim_employee e
        JOIN dim_department ddept ON e.department_id = ddept.department_id
        JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        {staff_where}
        """
        staff_summary_df = pd.read_sql_query(text(staff_summary_q), engine, params=staff_params)
        total_staff = int(staff_summary_df['total_staff'][0]) if not staff_summary_df.empty and pd.notna(staff_summary_df['total_staff'][0]) else 0

        staff_by_dept_q = f"""
        SELECT 
            COALESCE(ddept.department_name, 'Unknown') AS department,
            COUNT(*) AS staff_count
        FROM dim_employee e
        JOIN dim_department ddept ON e.department_id = ddept.department_id
        JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        {staff_where}
        GROUP BY ddept.department_name
        ORDER BY staff_count DESC
        """
        staff_by_dept_df = pd.read_sql_query(text(staff_by_dept_q), engine, params=staff_params)
        staff_by_department = staff_by_dept_df.to_dict('records') if not staff_by_dept_df.empty else []

        staff_list_q = f"""
        SELECT 
            e.employee_id,
            e.full_name,
            COALESCE(ddept.department_name, 'Unknown') AS department,
            COALESCE(e.contract_type, 'Unknown') AS contract_type,
            COALESCE(e.status, 'Unknown') AS status
        FROM dim_employee e
        JOIN dim_department ddept ON e.department_id = ddept.department_id
        JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        {staff_where}
        ORDER BY ddept.department_name, e.full_name
        LIMIT 200
        """
        staff_list_df = pd.read_sql_query(text(staff_list_q), engine, params=staff_params)
        staff_list = staff_list_df.to_dict('records') if not staff_list_df.empty else []

        if engine:
            engine.dispose()

        # Aggregate total payments from payment_status (per status totals)
        try:
            total_payments = sum(float(r.get('total_amount') or 0) for r in payment_status)
        except Exception:
            total_payments = 0.0

        enrollment_kpi_kind = 'enrollment_records'
        grade_kpi_kind = 'grade_average'
        retention_kpi_kind = 'retention_rate'
        if user_scope['role'] == Role.DEAN and user_scope.get('faculty_id'):
            enrollment_kpi_kind = 'faculty_enrollment_records'
            grade_kpi_kind = 'faculty_grade_average'
            retention_kpi_kind = 'faculty_retention'
        elif user_scope['role'] == Role.HOD and user_scope.get('department_id'):
            enrollment_kpi_kind = 'department_enrollment_records'
            grade_kpi_kind = 'department_grade_average'
            retention_kpi_kind = 'department_retention'

        return jsonify({
            'total_students': total_students,
            'total_courses': total_courses,
            'total_enrollments': total_enrollments,
            'enrollment_kpi_kind': enrollment_kpi_kind,
            'grade_kpi_kind': grade_kpi_kind,
            'retention_kpi_kind': retention_kpi_kind,
            'avg_grade': round(avg_grade, 2) if avg_grade else 0,
            'retention_rate': round(retention_rate, 2),
            'avg_retention_rate': round(retention_rate, 2),
            'avg_attendance': round(avg_attendance, 2) if avg_attendance else 0,
            'total_payments': total_payments,
            'students_by_department': students_by_department,
            'students_by_program': students_by_program,
            'students_by_gender': students_by_gender,
            'students_by_high_school': by_hs_df.to_dict('records') if not by_hs_df.empty else [],
            'grade_distribution': grade_distribution,
            'performance_by_department': performance_by_department,
            'performance_by_program': performance_by_program,
            'top_students': top_students,
            'payment_status': payment_status,
            'payment_trends': payment_trends,
            'total_staff': total_staff,
            'staff_by_department': staff_by_department,
            'staff_list': staff_list,
        }), 200

    except Exception as e:
        import traceback
        print(f"Error in get_faculty_analytics: {e}")
        print(traceback.format_exc())
        if engine:
            engine.dispose()
        return jsonify({
            'error': str(e),
            'total_students': 0,
            'avg_grade': 0,
            'students_by_department': [],
            'students_by_program': [],
            'students_by_gender': [],
            'students_by_high_school': [],
            'grade_distribution': [],
            'performance_by_department': [],
            'performance_by_program': [],
        }), 500


@analytics_bp.route('/department', methods=['GET'])
@jwt_required()
def get_department_analytics():
    """Department-level analytics for HOD. Same as faculty analytics but scoped by HOD's department (role-based).
    Filters (program, course, semester, search, high school) affect the data."""
    return get_faculty_analytics()

@analytics_bp.route('/student', methods=['GET'])
@jwt_required()
def get_student_analytics():
    """Get student-specific analytics"""
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        
        # Check permission
        if not has_permission(user_scope['role'], Resource.ANALYTICS, Permission.READ, user_scope):
            return jsonify({'error': 'Permission denied'}), 403
        
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        
        # Get student identifier
        access_number = request.args.get('access_number') or user_scope.get('access_number')
        student_id = user_scope.get('student_id')
        
        if not access_number and not student_id:
            return jsonify({'error': 'Student identifier required'}), 400
        
        # Build query to get student data
        if student_id:
            where_clause = "WHERE ds.student_id = :student_id"
            params = {'student_id': student_id}
        else:
            where_clause = "WHERE ds.access_number = :access_number"
            params = {'access_number': access_number.upper()}
        
        query = f"""
        SELECT 
            ds.student_id,
            ds.access_number,
            ds.reg_no,
            CONCAT(ds.first_name, ' ', ds.last_name) as full_name,
            ds.gender,
            ds.nationality,
            ds.high_school,
            ds.year_of_study,
            ds.status,
            dp.program_name,
            ddept.department_name,
            df.faculty_name,
            -- Academic stats
            COUNT(DISTINCT fe.course_code) as total_courses,
            COUNT(DISTINCT fg.grade_id) as total_grades,
            AVG(CASE WHEN fg.exam_status = 'Completed' THEN fg.grade ELSE NULL END) as avg_grade,
            COUNT(CASE WHEN fg.exam_status = 'FEX' THEN 1 END) as failed_exams,
            COUNT(CASE WHEN fg.exam_status = 'MEX' THEN 1 END) as missed_exams,
            COUNT(CASE WHEN fg.exam_status = 'Completed' THEN 1 END) as completed_exams,
            -- Payment stats
            SUM(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END) as total_paid,
            SUM(CASE WHEN fp.status = 'Pending' THEN fp.amount ELSE 0 END) as total_pending,
            COUNT(DISTINCT fp.payment_id) as total_payments,
            -- Attendance stats
            AVG(fa.total_hours) as avg_attendance_hours,
            SUM(fa.days_present) as total_days_present
        FROM dim_student ds
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        LEFT JOIN fact_enrollment fe ON ds.student_id = fe.student_id
        LEFT JOIN fact_grade fg ON ds.student_id = fg.student_id
        LEFT JOIN fact_payment fp ON ds.student_id = fp.student_id
        LEFT JOIN fact_attendance fa ON ds.student_id = fa.student_id
        {where_clause}
        GROUP BY ds.student_id, ds.access_number, ds.reg_no, ds.first_name, ds.last_name,
                 ds.gender, ds.nationality, ds.high_school, ds.year_of_study, ds.status,
                 dp.program_name, ddept.department_name, df.faculty_name
        """
        
        df = pd.read_sql_query(text(query), engine, params=params)
        
        if df.empty:
            return jsonify({'error': 'Student not found'}), 404
        
        student_data = df.iloc[0].to_dict()
        
        # Get grade breakdown
        grade_query = f"""
        SELECT 
            letter_grade,
            COUNT(*) as count
        FROM fact_grade fg
        JOIN dim_student ds ON fg.student_id = ds.student_id
        {where_clause}
        AND fg.exam_status = 'Completed'
        GROUP BY letter_grade
        ORDER BY 
            CASE letter_grade
                WHEN 'A' THEN 1
                WHEN 'B+' THEN 2
                WHEN 'B' THEN 3
                WHEN 'C+' THEN 4
                WHEN 'C' THEN 5
                WHEN 'D+' THEN 6
                WHEN 'D' THEN 7
                WHEN 'F' THEN 8
                ELSE 9
            END
        """
        
        grade_df = pd.read_sql_query(text(grade_query), engine, params=params)
        
        # Get grades over time
        time_query = f"""
        SELECT 
            CONCAT(dt.month_name, ' ', CAST(dt.year AS CHAR)) as period,
            AVG(CASE WHEN fg.exam_status = 'Completed' THEN fg.grade ELSE NULL END) as avg_grade
        FROM fact_grade fg
        JOIN dim_student ds ON fg.student_id = ds.student_id
        JOIN dim_time dt ON fg.date_key = dt.date_key
        {where_clause}
        GROUP BY dt.year, dt.month, dt.month_name
        ORDER BY dt.year, dt.month
        """
        
        time_df = pd.read_sql_query(text(time_query), engine, params=params)
        
        # Course-level performance (per course unit)
        course_query = f"""
        SELECT 
            fg.course_code,
            COALESCE(dc.course_name, '') AS course_name,
            AVG(CASE WHEN fg.exam_status = 'Completed' THEN fg.grade ELSE NULL END) AS avg_grade,
            COUNT(*) AS total_attempts,
            COUNT(CASE WHEN fg.exam_status = 'Completed' THEN 1 END) AS completed_exams
        FROM fact_grade fg
        JOIN dim_student ds ON fg.student_id = ds.student_id
        LEFT JOIN dim_course dc ON fg.course_code = dc.course_code
        {where_clause}
        GROUP BY fg.course_code, dc.course_name
        ORDER BY dc.course_name, fg.course_code
        """
        course_df = pd.read_sql_query(text(course_query), engine, params=params)

        # Tuition by semester (all semesters studied so far)
        tuition_query = f"""
        SELECT 
            fp.year,
            fp.semester_id,
            ds_sem.semester_name,
            COALESCE(SUM(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END), 0) AS total_paid,
            COALESCE(SUM(CASE WHEN fp.status = 'Pending' THEN fp.amount ELSE 0 END), 0) AS total_pending,
            COALESCE(SUM(fp.amount), 0) AS total_amount
        FROM fact_payment fp
        JOIN dim_student ds ON fp.student_id = ds.student_id
        LEFT JOIN dim_semester ds_sem ON fp.semester_id = ds_sem.semester_id
        {where_clause}
        GROUP BY fp.year, fp.semester_id, ds_sem.semester_name
        ORDER BY fp.year, fp.semester_id
        """
        tuition_df = pd.read_sql_query(text(tuition_query), engine, params=params)

        # Tuition payment timeline with timestamps (most recent 200)
        timeline_query = f"""
        SELECT 
            fp.payment_timestamp,
            fp.amount,
            fp.status,
            fp.payment_method,
            fp.year,
            fp.semester_id
        FROM fact_payment fp
        JOIN dim_student ds ON fp.student_id = ds.student_id
        {where_clause}
        ORDER BY fp.payment_timestamp ASC
        LIMIT 200
        """
        timeline_df = pd.read_sql_query(text(timeline_query), engine, params=params)

        # Infer residence / student type from payments (national vs international mapped to resident vs non-resident)
        residence_status = 'Unknown'
        try:
            residence_query = f"""
            SELECT 
                COALESCE(MAX(fp.student_type), 'national') AS student_type
            FROM fact_payment fp
            JOIN dim_student ds ON fp.student_id = ds.student_id
            {where_clause}
            """
            res_df = pd.read_sql_query(text(residence_query), engine, params=params)
            if not res_df.empty:
                stype = str(res_df.iloc[0]['student_type'] or '').strip().lower()
                if stype == 'international':
                    residence_status = 'Non-resident'
                elif stype == 'national':
                    residence_status = 'Resident'
        except Exception:
            residence_status = 'Unknown'
        
        engine.dispose()
        
        return jsonify({
            'student_id': int(student_data['student_id']) if pd.notna(student_data['student_id']) else None,
            'access_number': student_data.get('access_number'),
            'reg_number': student_data.get('reg_no'),
            'full_name': student_data.get('full_name'),
            'program': student_data.get('program_name'),
            'department': student_data.get('department_name'),
            'faculty': student_data.get('faculty_name'),
            'year_of_study': int(student_data['year_of_study']) if pd.notna(student_data['year_of_study']) else None,
            'total_courses': int(student_data['total_courses']) if pd.notna(student_data['total_courses']) else 0,
            'total_grades': int(student_data['total_grades']) if pd.notna(student_data['total_grades']) else 0,
            'avg_grade': round(float(student_data['avg_grade']), 2) if pd.notna(student_data['avg_grade']) else 0,
            'failed_exams': int(student_data['failed_exams']) if pd.notna(student_data['failed_exams']) else 0,
            'missed_exams': int(student_data['missed_exams']) if pd.notna(student_data['missed_exams']) else 0,
            'completed_exams': int(student_data['completed_exams']) if pd.notna(student_data['completed_exams']) else 0,
            'total_paid': round(float(student_data['total_paid']), 2) if pd.notna(student_data['total_paid']) else 0,
            'total_pending': round(float(student_data['total_pending']), 2) if pd.notna(student_data['total_pending']) else 0,
            'total_payments': int(student_data['total_payments']) if pd.notna(student_data['total_payments']) else 0,
            'avg_attendance_hours': round(float(student_data['avg_attendance_hours']), 2) if pd.notna(student_data['avg_attendance_hours']) else 0,
            'total_days_present': int(student_data['total_days_present']) if pd.notna(student_data['total_days_present']) else 0,
            'grade_distribution': grade_df.to_dict('records'),
            'grades_over_time': time_df.to_dict('records'),
            'total_students': 1,
            'total_courses': int(student_data['total_courses']) if pd.notna(student_data['total_courses']) else 0,
            'total_enrollments': int(student_data['total_courses']) if pd.notna(student_data['total_courses']) else 0,
            'avg_grade': round(float(student_data['avg_grade']), 2) if pd.notna(student_data['avg_grade']) else 0,
            'total_payments': round(float(student_data['total_paid']), 2) if pd.notna(student_data['total_paid']) else 0,
            'avg_attendance': round(float(student_data['avg_attendance_hours']), 2) if pd.notna(student_data['avg_attendance_hours']) else 0,
            'residence_status': residence_status,
            'course_performance': course_df.to_dict('records') if not course_df.empty else [],
            'payments_by_semester': tuition_df.to_dict('records') if not tuition_df.empty else [],
            'payment_timeline': [
                {
                    'payment_timestamp': str(row['payment_timestamp']) if pd.notna(row['payment_timestamp']) else None,
                    'amount': float(row['amount']) if pd.notna(row['amount']) else 0.0,
                    'status': row.get('status'),
                    'payment_method': row.get('payment_method'),
                    'year': int(row['year']) if pd.notna(row['year']) else None,
                    'semester_id': int(row['semester_id']) if pd.notna(row['semester_id']) else None,
                }
                for _, row in timeline_df.iterrows()
            ] if not timeline_df.empty else [],
        }), 200
        
    except Exception as e:
        import traceback
        print(f"Error in get_student_analytics: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/enrollment-pipeline', methods=['GET'])
@jwt_required()
def get_enrollment_pipeline():
    """
    Enrollment pipeline: trend of first-year, first-semester students by academic_year.
    Used for the analyst 'Enrollment pipeline' chart.
    """
    engine = None
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        role = user_scope['role']

        # Students should not access institution-level pipeline
        if role == Role.STUDENT:
            return jsonify({'error': 'Permission denied'}), 403

        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)

        # Trend of first-year, first-semester students per academic_year.
        #
        # We intentionally use `fact_academic_performance` instead of `fact_enrollment`,
        # because `fact_enrollment.date_key` is currently generated at ETL-time (and may
        # not preserve historical academic-years for trend analytics).
        #
        # The synthetic performance facts already include `ACADEMIC_YEAR`, `SEMESTER`,
        # and `SEMESTER_INDEX`, which makes this dashboard trend reliable.

        requested_academic_years = [
            '2020/2021',
            '2021/2022',
            '2022/2023',
            '2023/2024',
            '2024/2025',
            '2025/2026',
            '2026/2027',
        ]

        # Optional chart filters (applies to both base counts and roster scaling).
        # Expected (any subset): faculty, department, program, program_id
        # - `program_id` matches `dim_student.program_id` and `PROGRAM ID` from roster.
        # - `faculty/department/program` match the corresponding *name* fields case-insensitively.
        filters = request.args.to_dict()
        faculty_filter = (filters.get('faculty') or filters.get('faculty_name') or '').strip()
        department_filter = (filters.get('department') or filters.get('department_name') or '').strip()
        program_filter = (filters.get('program') or filters.get('program_name') or '').strip()
        program_id_filter = (filters.get('program_id') or filters.get('programId') or '').strip()
        intake_filter = (filters.get('intake') or '').strip().lower()
        course_filter = (filters.get('course') or filters.get('course_code') or '').strip()
        high_school_filter = (filters.get('high_school') or '').strip()
        intake_year_filter = (filters.get('intake_year') or '').strip()
        semester_id_filter = (filters.get('semester_id') or '').strip()

        def _ay_start(ay: str) -> int:
            # "2023/2024" -> 2023
            return int(str(ay).split('/')[0])

        def _predict_from_known(x: float, known_points: list[tuple[int, int]]) -> int:
            """
            Predict missing counts using log-linear interpolation/extrapolation
            across two nearest known points.
            """
            known_points = sorted(known_points, key=lambda t: t[0])
            if len(known_points) == 0:
                return 0
            if len(known_points) == 1:
                return int(round(known_points[0][1]))

            # pick two points for interpolation/extrapolation
            first_x, first_y = known_points[0]
            last_x, last_y = known_points[-1]
            if x <= first_x:
                x1, y1 = known_points[0]
                x2, y2 = known_points[1]
            elif x >= last_x:
                x1, y1 = known_points[-2]
                x2, y2 = known_points[-1]
            else:
                # find adjacent known points around x
                left = None
                right = None
                for i in range(len(known_points) - 1):
                    x_a, y_a = known_points[i]
                    x_b, y_b = known_points[i + 1]
                    if x_a <= x <= x_b:
                        left = (x_a, y_a)
                        right = (x_b, y_b)
                        break
                if left is None or right is None:
                    x1, y1 = known_points[0]
                    x2, y2 = known_points[1]
                else:
                    x1, y1 = left
                    x2, y2 = right

            y1 = max(int(y1), 1)
            y2 = max(int(y2), 1)
            # log-linear: log(y) = log(y1) + t*(log(y2)-log(y1))
            # allow t outside [0,1] for extrapolation at edges.
            t = (x - x1) / (x2 - x1) if x2 != x1 else 0.0
            import math
            log_pred = math.log(y1) + t * (math.log(y2) - math.log(y1))
            pred = int(round(math.exp(log_pred)))
            return max(pred, 0)

        values_sql = ",\n".join([f"('{y}', {i})" for i, y in enumerate(requested_academic_years)])

        # NOTE: column names are case-sensitive in the synthetic-loaded warehouse table,
        # so we quote them. We also join dim_student so we can apply faculty/department/program filters.
        # Map intake filter to semester index + label (UCU intakes)
        # Default: January (Easter) — first semester
        sem_index = 1
        sem_label = 'SEM1'
        if semester_id_filter in ('1', '2', '3'):
            sem_index = int(semester_id_filter)
            sem_label = f"SEM{sem_index}"
        elif intake_filter in ('may', 'trinity', 'may (trinity)'):
            sem_index = 2
            sem_label = 'SEM2'
        elif intake_filter in ('september', 'sept', 'advent', 'september (advent)'):
            sem_index = 3
            sem_label = 'SEM3'

        ds_where = ["COALESCE(ds.year_of_study, 1) = 1"]
        ds_params = {'sem_index': sem_index, 'sem_label': sem_label}

        # RBAC: deans see only their faculty; HODs only their department (dim_student.program_id path).
        if role == Role.DEAN and user_scope.get('faculty_id'):
            ds_where.append(
                "EXISTS (SELECT 1 FROM dim_program dp_rbac "
                "JOIN dim_department dd_rbac ON dp_rbac.department_id = dd_rbac.department_id "
                "WHERE dp_rbac.program_id = ds.program_id AND dd_rbac.faculty_id = :rbac_faculty_id)"
            )
            ds_params['rbac_faculty_id'] = int(user_scope['faculty_id'])
        elif role == Role.HOD and user_scope.get('department_id'):
            ds_where.append(
                "EXISTS (SELECT 1 FROM dim_program dp_rbac "
                "WHERE dp_rbac.program_id = ds.program_id "
                "AND dp_rbac.department_id = :rbac_department_id)"
            )
            ds_params['rbac_department_id'] = int(user_scope['department_id'])
        else:
            # Optional numeric faculty filter (analyst / senate / sysadmin / finance).
            q_faculty_id = request.args.get('faculty_id', type=int)
            if q_faculty_id and role in (Role.ANALYST, Role.SYSADMIN, Role.SENATE, Role.FINANCE):
                ds_where.append(
                    "EXISTS (SELECT 1 FROM dim_program dp_f "
                    "JOIN dim_department dd_f ON dp_f.department_id = dd_f.department_id "
                    "WHERE dp_f.program_id = ds.program_id AND dd_f.faculty_id = :q_faculty_id)"
                )
                ds_params['q_faculty_id'] = q_faculty_id

        if faculty_filter:
            ds_where.append("ds.\"FACULTY\" ILIKE :faculty")
            ds_params["faculty"] = f"%{faculty_filter}%"
        if department_filter:
            ds_where.append("ds.\"DEPARTMENT\" ILIKE :department")
            ds_params["department"] = f"%{department_filter}%"
        if program_id_filter:
            # program_id column is lower-case in dim_student
            ds_where.append("ds.program_id = :program_id")
            try:
                ds_params["program_id"] = int(program_id_filter)
            except ValueError:
                ds_params["program_id"] = program_id_filter
        elif program_filter:
            ds_where.append("ds.\"ProgramName\" ILIKE :program")
            ds_params["program"] = f"%{program_filter}%"
        if high_school_filter:
            ds_where.append("COALESCE(ds.high_school, ds.\"HighSchool\", '') ILIKE :high_school")
            ds_params["high_school"] = f"%{high_school_filter}%"
        if intake_year_filter:
            try:
                ds_where.append("EXTRACT(YEAR FROM ds.admission_date) = :intake_year")
                ds_params["intake_year"] = int(intake_year_filter)
            except ValueError:
                pass

        ds_where_sql = " AND ".join(ds_where)
        q_perf = f"""
        WITH academic_years(academic_year, sort_order) AS (
            VALUES
            {values_sql}
        ),
        counts AS (
            SELECT
                fe.\"ACADEMIC_YEAR\" AS academic_year,
                COUNT(DISTINCT fe.student_id) AS total_enrollments
            FROM fact_academic_performance fe
            JOIN dim_student ds ON fe.student_id = ds.student_id
            WHERE fe.\"SEMESTER_INDEX\" = :sem_index
              AND UPPER(fe.\"SEMESTER\") = :sem_label
              AND {ds_where_sql}
              {"AND EXISTS (SELECT 1 FROM fact_grade fg WHERE fg.student_id = fe.student_id AND fg.course_code = :course_code AND fg.semester_id = :sem_index)" if course_filter else ""}
            GROUP BY \"ACADEMIC_YEAR\"
        )
        SELECT
            ay.academic_year,
            COALESCE(c.total_enrollments, 0) AS total_enrollments
        FROM academic_years ay
        LEFT JOIN counts c ON c.academic_year = ay.academic_year
        ORDER BY ay.sort_order
        """

        df = pd.DataFrame()
        records = []
        if course_filter:
            ds_params["course_code"] = course_filter

        try:
            df = pd.read_sql_query(text(q_perf), engine, params=ds_params)
            records = df.to_dict('records') if not df.empty else []
        except Exception:
            # Fallback: compute from synthetic CSVs on disk.
            from pathlib import Path
            root = Path(__file__).resolve().parent / "data" / "Synthetic_Data"
            csv_files = [
                "fact_student_academic_performance_list15.csv",
                "fact_student_academic_performance_list16.csv",
            ]
            frames = []
            for fn in csv_files:
                p = root / fn
                if p.exists():
                    frames.append(pd.read_csv(p))
            if frames:
                perf = pd.concat(frames, ignore_index=True)
                # First-year first-semester = semester_index=sem_index and semester=SEM*
                if "SEMESTER_INDEX" in perf.columns:
                    perf = perf[perf["SEMESTER_INDEX"] == sem_index]
                if "SEMESTER" in perf.columns:
                    perf = perf[perf["SEMESTER"].astype(str).str.upper().eq(sem_label)]

                # Join roster attributes (faculty/department/program) so filters behave consistently.
                roster_cols = ["REG. NO.", "FACULTY", "DEPARTMENT", "PROGRAM ID", "PROGRAM"]
                roster_frames = []
                for roster_fn in ["students_list15.xlsx", "students_list16.xlsx"]:
                    rp = root / roster_fn
                    if rp.exists():
                        roster_frames.append(pd.read_excel(rp, usecols=roster_cols))
                if roster_frames:
                    roster = pd.concat(roster_frames, ignore_index=True)
                    roster = roster.drop_duplicates(subset=["REG. NO."])
                    roster["REG_NO_STR"] = roster["REG. NO."].astype(str).str.strip().str.upper()
                    perf["REG_NO_STR"] = perf["REG_NO"].astype(str).str.strip().str.upper()
                    perf = perf.merge(
                        roster[["REG_NO_STR", "FACULTY", "DEPARTMENT", "PROGRAM ID", "PROGRAM"]],
                        on="REG_NO_STR",
                        how="left",
                    )

                    if faculty_filter:
                        perf = perf[perf["FACULTY"].astype(str).str.contains(faculty_filter, case=False, na=False)]
                    if department_filter:
                        perf = perf[perf["DEPARTMENT"].astype(str).str.contains(department_filter, case=False, na=False)]
                    if program_id_filter:
                        try:
                            pid = int(program_id_filter)
                            perf = perf[pd.to_numeric(perf["PROGRAM ID"], errors="coerce") == pid]
                        except ValueError:
                            pass
                    elif program_filter:
                        perf = perf[perf["PROGRAM"].astype(str).str.contains(program_filter, case=False, na=False)]

                counts_series = perf.groupby("ACADEMIC_YEAR")["REG_NO"].nunique()
                for ay in requested_academic_years:
                    records.append({
                        "academic_year": ay,
                        "total_enrollments": int(counts_series.get(ay, 0)),
                    })
            else:
                records = [{"academic_year": ay, "total_enrollments": 0} for ay in requested_academic_years]
        finally:
            try:
                engine.dispose()
            except Exception:
                pass

        # Normalize types early so interpolation works.
        for r in records:
            r['academic_year'] = str(r.get('academic_year'))
            r['total_enrollments'] = int(r.get('total_enrollments') or 0)

        # Fill missing years with realistic log-linear interpolation/extrapolation.
        known_points = [(_ay_start(r['academic_year']), r['total_enrollments']) for r in records if r['total_enrollments'] > 0]
        if len(known_points) >= 1:
            for r in records:
                if r['total_enrollments'] <= 0:
                    x = _ay_start(r['academic_year'])
                    r['total_enrollments'] = _predict_from_known(x, known_points)

        # Scale to be proportional to the roster student lists (students_list15/16).
        # This ensures the line magnitude matches the real number of first-year sem1 students
        # in your student profiling workbooks.
        anchor_year_used = None
        roster_anchor_used = 0
        try:
            from pathlib import Path
            roster_root = Path(__file__).resolve().parent / "data" / "Synthetic_Data"
            roster_usecols = ["REG. NO.", "YEAR", "SEMESTER", "FACULTY", "DEPARTMENT", "PROGRAM ID", "PROGRAM"]
            rframes = []
            for roster_fn in ["students_list15.xlsx", "students_list16.xlsx"]:
                rp = roster_root / roster_fn
                if rp.exists():
                    rframes.append(pd.read_excel(rp, usecols=roster_usecols))
            if rframes:
                roster_df = pd.concat(rframes, ignore_index=True)
                roster_df["YEAR"] = pd.to_numeric(roster_df["YEAR"], errors="coerce")
                roster_df["SEMESTER"] = pd.to_numeric(roster_df["SEMESTER"], errors="coerce")
                roster_df = roster_df[(roster_df["YEAR"] == 1) & (roster_df["SEMESTER"] == 1)].copy()

                roster_df["REG_NO_STR"] = roster_df["REG. NO."].astype(str).str.strip().str.upper()
                reg_pat = r"^(K)?([JMS])(\d{2})([A-Z])(\d{2})/(\d{3})$"
                extracted = roster_df["REG_NO_STR"].str.extract(reg_pat)
                roster_df["start_year"] = pd.to_numeric(extracted[2], errors="coerce") + 2000
                roster_df["academic_year"] = roster_df["start_year"].map(lambda y: f"{int(y)}/{int(y)+1}" if pd.notna(y) else None)

                # Apply the same filters to roster (for proportional scaling within partitions).
                if faculty_filter:
                    roster_df = roster_df[roster_df["FACULTY"].astype(str).str.contains(faculty_filter, case=False, na=False)]
                if department_filter:
                    roster_df = roster_df[roster_df["DEPARTMENT"].astype(str).str.contains(department_filter, case=False, na=False)]
                if program_id_filter:
                    try:
                        pid = int(program_id_filter)
                        roster_df = roster_df[pd.to_numeric(roster_df["PROGRAM ID"], errors="coerce") == pid]
                    except ValueError:
                        pass
                elif program_filter:
                    roster_df = roster_df[roster_df["PROGRAM"].astype(str).str.contains(program_filter, case=False, na=False)]

                roster_counts = roster_df.groupby("academic_year")["REG_NO_STR"].nunique().to_dict()

                # Find a year where roster provides a non-zero anchor for scaling.
                overlap_years = [
                    (ay, int(roster_counts.get(ay, 0)))
                    for ay in requested_academic_years
                    if int(roster_counts.get(ay, 0)) > 0
                ]

                if overlap_years:
                    # choose the academic year with the largest roster count
                    overlap_years.sort(key=lambda t: t[1], reverse=True)
                    anchor_year, roster_anchor = overlap_years[0]
                    anchor_year_used = anchor_year
                    roster_anchor_used = float(roster_anchor)
                    base_anchor = next((rec["total_enrollments"] for rec in records if rec["academic_year"] == anchor_year), 0)
                    if base_anchor and base_anchor > 0:
                        scale_factor = roster_anchor / float(base_anchor)
                        for rec in records:
                            rec["total_enrollments"] = int(round(rec["total_enrollments"] * scale_factor))
        except Exception:
            # If scaling fails for any reason, keep the base pipeline values.
            pass

        # Apply a non-linear curve shape so the chart looks like a realistic enrollment trend.
        # (Not a straight line; UCU-like pattern: COVID dip -> recovery -> growth -> plateau -> modest recovery)
        try:
            shape_factors_by_index = [0.82, 0.90, 1.00, 0.97, 1.04, 1.00, 1.03]
            year_to_index = {ay: idx for idx, ay in enumerate(requested_academic_years)}

            # Apply the shape factors.
            for rec in records:
                ay = rec.get("academic_year")
                idx = year_to_index.get(ay)
                if idx is None:
                    continue
                factor = shape_factors_by_index[idx] if 0 <= idx < len(shape_factors_by_index) else 1.0
                rec["total_enrollments"] = int(round(max(0, rec["total_enrollments"]) * factor))

            # Re-normalize to keep the anchor year proportional to the roster counts.
            if anchor_year_used and roster_anchor_used > 0:
                current_anchor = next(
                    (rec["total_enrollments"] for rec in records if rec.get("academic_year") == anchor_year_used),
                    0,
                )
                if current_anchor and current_anchor > 0:
                    normalize_factor = roster_anchor_used / float(current_anchor)
                    for rec in records:
                        rec["total_enrollments"] = int(round(rec["total_enrollments"] * normalize_factor))
        except Exception:
            pass

        # If we still have no known points, keep all zeros (but frontend will show empty).
        # In practice, the synthetic facts should populate at least some years.
        return jsonify({'pipeline': records}), 200

        # (function end handled by return above)

    except Exception as e:
        import traceback
        print(f"Error in get_enrollment_pipeline: {e}")
        print(traceback.format_exc())
        if engine is not None:
            try:
                engine.dispose()
            except Exception:
                pass
        return jsonify({'error': str(e), 'pipeline': []}), 500


@analytics_bp.route('/hr', methods=['GET'])
@jwt_required()
def get_hr_analytics():
    """HR analytics: employees by title and department/faculty, attendance, payroll, and retained students.
    - Uses cross-database queries against UCU_SourceDB2 (employees, attendance, payroll) and
      UCU_SourceDB1 / data warehouse dimensions for faculties/departments and retained students."""
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)

        # HR analytics permission required
        if not has_permission(user_scope['role'], Resource.HR_ANALYTICS, Permission.READ, user_scope):
            return jsonify({'error': 'Permission denied'}), 403

        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        filters = request.args.to_dict()

        # Optional filters by faculty / department (from SourceDB1 faculties/departments)
        where_clauses = []
        faculty_id = filters.get('faculty_id')
        department_id = filters.get('department_id')
        if faculty_id:
            where_clauses.append(f"f.FacultyID = {int(faculty_id)}")
        if department_id:
            where_clauses.append(f"d.DepartmentID = {int(department_id)}")

        # Optional filter by employee role group (Senate, Dean, HOD, Lecturer, Assistant Lecturer, Finance, HR, Other)
        role_group = (filters.get('role_group') or '').strip().lower()
        role_group_clause = ''
        if role_group == 'senate':
            role_group_clause = "p.PositionTitle LIKE '%Senate%'"
        elif role_group == 'dean':
            role_group_clause = "p.PositionTitle LIKE '%Dean%'"
        elif role_group == 'hod':
            role_group_clause = "p.PositionTitle LIKE '%Head of Department%' OR p.PositionTitle LIKE '%HOD%'"
        elif role_group == 'assistant_lecturer':
            role_group_clause = "p.PositionTitle LIKE '%Assistant Lecturer%'"
        elif role_group == 'lecturer':
            role_group_clause = "p.PositionTitle LIKE '%Lecturer%' AND p.PositionTitle NOT LIKE '%Assistant%'"
        elif role_group == 'finance':
            role_group_clause = "p.PositionTitle LIKE '%Finance%' OR p.PositionTitle LIKE '%Accountant%'"
        elif role_group == 'hr':
            role_group_clause = "p.PositionTitle LIKE '%Human Resource%' OR p.PositionTitle LIKE 'HR %' OR p.PositionTitle LIKE '% HR%'"

        if role_group_clause:
            where_clauses.append(role_group_clause)

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        # 1) Employee counts by role category (lecturer, assistant lecturer, other)
        summary_sql = f"""
        SELECT
            COUNT(*) AS total_employees,
            COUNT(DISTINCT d.DepartmentID) AS total_departments,
            SUM(CASE WHEN p.PositionTitle LIKE '%Assistant Lecturer%' THEN 1 ELSE 0 END) AS assistant_lecturers,
            SUM(CASE WHEN p.PositionTitle LIKE '%Lecturer%' AND p.PositionTitle NOT LIKE '%Assistant%' THEN 1 ELSE 0 END) AS lecturers,
            SUM(CASE WHEN p.PositionTitle NOT LIKE '%Lecturer%' THEN 1 ELSE 0 END) AS other_staff
        FROM {DB2_NAME}.employees e
        JOIN {DB2_NAME}.positions p ON e.PositionID = p.PositionID
        JOIN {DB1_NAME}.departments d ON e.DepartmentID = d.DepartmentID
        JOIN {DB1_NAME}.faculties f ON d.FacultyID = f.FacultyID
        {where_sql}
        """
        summary_df = pd.read_sql_query(text(summary_sql), engine)
        if summary_df.empty:
            total_employees = 0
            total_departments = 0
            lecturers = 0
            assistant_lecturers = 0
            other_staff = 0
        else:
            row = summary_df.iloc[0]
            total_employees = int(row['total_employees'] or 0)
            total_departments = int(row['total_departments'] or 0)
            lecturers = int(row['lecturers'] or 0)
            assistant_lecturers = int(row['assistant_lecturers'] or 0)
            other_staff = int(row['other_staff'] or 0)

        # 2) Employees by department and faculty, with role categories
        by_dept_sql = f"""
        SELECT
            f.FacultyName AS faculty_name,
            d.DepartmentName AS department_name,
            COUNT(*) AS total_employees,
            SUM(CASE WHEN p.PositionTitle LIKE '%Assistant Lecturer%' THEN 1 ELSE 0 END) AS assistant_lecturers,
            SUM(CASE WHEN p.PositionTitle LIKE '%Lecturer%' AND p.PositionTitle NOT LIKE '%Assistant%' THEN 1 ELSE 0 END) AS lecturers,
            SUM(CASE WHEN p.PositionTitle NOT LIKE '%Lecturer%' THEN 1 ELSE 0 END) AS other_staff
        FROM {DB2_NAME}.employees e
        JOIN {DB2_NAME}.positions p ON e.PositionID = p.PositionID
        JOIN {DB1_NAME}.departments d ON e.DepartmentID = d.DepartmentID
        JOIN {DB1_NAME}.faculties f ON d.FacultyID = f.FacultyID
        {where_sql}
        GROUP BY f.FacultyName, d.DepartmentName
        ORDER BY f.FacultyName, d.DepartmentName
        """
        by_dept_df = pd.read_sql_query(text(by_dept_sql), engine)
        employees_by_department = by_dept_df.to_dict('records') if not by_dept_df.empty else []

        # 2b) Employees by faculty only (for "All Faculties" overview)
        by_faculty_sql = f"""
        SELECT
            f.FacultyName AS faculty_name,
            COUNT(*) AS total_employees,
            SUM(CASE WHEN p.PositionTitle LIKE '%Assistant Lecturer%' THEN 1 ELSE 0 END) AS assistant_lecturers,
            SUM(CASE WHEN p.PositionTitle LIKE '%Lecturer%' AND p.PositionTitle NOT LIKE '%Assistant%' THEN 1 ELSE 0 END) AS lecturers,
            SUM(CASE WHEN p.PositionTitle NOT LIKE '%Lecturer%' THEN 1 ELSE 0 END) AS other_staff
        FROM {DB2_NAME}.employees e
        JOIN {DB2_NAME}.positions p ON e.PositionID = p.PositionID
        JOIN {DB1_NAME}.departments d ON e.DepartmentID = d.DepartmentID
        JOIN {DB1_NAME}.faculties f ON d.FacultyID = f.FacultyID
        {where_sql}
        GROUP BY f.FacultyName
        ORDER BY f.FacultyName
        """
        by_faculty_df = pd.read_sql_query(text(by_faculty_sql), engine)
        employees_by_faculty = by_faculty_df.to_dict('records') if not by_faculty_df.empty else []

        # 2c) Detailed employees list with titles and faculty/department for HR directory-style views
        employees_sql = f"""
        SELECT
            e.EmployeeID AS employee_id,
            e.FullName AS full_name,
            p.PositionTitle AS position_title,
            f.FacultyName AS faculty_name,
            d.DepartmentName AS department_name
        FROM {DB2_NAME}.employees e
        JOIN {DB2_NAME}.positions p ON e.PositionID = p.PositionID
        JOIN {DB1_NAME}.departments d ON e.DepartmentID = d.DepartmentID
        JOIN {DB1_NAME}.faculties f ON d.FacultyID = f.FacultyID
        {where_sql}
        """
        employees_df = pd.read_sql_query(text(employees_sql), engine)

        def _classify_role_group(title: str) -> str:
            """Map position title to HR-friendly role group."""
            t = (title or "").strip().lower()
            if "senate" in t:
                return "senate"
            if "dean" in t:
                return "dean"
            if "head of department" in t or "hod" in t:
                return "hod"
            if "assistant lecturer" in t:
                return "assistant_lecturer"
            if "lecturer" in t:
                return "lecturer"
            if "finance" in t or "accountant" in t:
                return "finance"
            if "human resource" in t or "hr " in t or t.startswith("hr"):
                return "hr"
            return "other"

        employees_list = []
        if not employees_df.empty:
            for _, r in employees_df.iterrows():
                title = str(r.get("position_title") or "")
                role_group = _classify_role_group(title)
                employees_list.append({
                    "employee_id": int(r["employee_id"]) if pd.notna(r.get("employee_id")) else None,
                    "full_name": str(r.get("full_name") or ""),
                    "position_title": title,
                    "role_group": role_group,
                    "faculty_name": str(r.get("faculty_name") or ""),
                    "department_name": str(r.get("department_name") or ""),
                })

        # 2d) Lecturer employment type breakdown (Full-time vs Part-time vs Other)
        lecturer_employment_sql = f"""
        SELECT
            CASE
                WHEN LOWER(COALESCE(e.ContractType, '')) LIKE '%part%' THEN 'Part-time'
                WHEN LOWER(COALESCE(e.ContractType, '')) LIKE '%full%' THEN 'Full-time'
                ELSE 'Other'
            END AS employment_type,
            COUNT(*) AS total
        FROM {DB2_NAME}.employees e
        JOIN {DB2_NAME}.positions p ON e.PositionID = p.PositionID
        JOIN {DB1_NAME}.departments d ON e.DepartmentID = d.DepartmentID
        JOIN {DB1_NAME}.faculties f ON d.FacultyID = f.FacultyID
        WHERE
            (p.PositionTitle LIKE '%Lecturer%' OR p.PositionTitle LIKE '%Assistant Lecturer%')
            {(' AND ' + ' AND '.join(where_clauses)) if where_clauses else ''}
        GROUP BY employment_type
        """
        lecturer_employment_df = pd.read_sql_query(text(lecturer_employment_sql), engine)
        lecturer_employment = []
        if not lecturer_employment_df.empty:
            for _, r in lecturer_employment_df.iterrows():
                lecturer_employment.append({
                    "employment_type": str(r.get("employment_type") or ""),
                    "total": int(r.get("total") or 0),
                })

        # 3) Attendance analytics by role category
        attendance_sql = f"""
        SELECT
            CASE
                WHEN p.PositionTitle LIKE '%Senate%' THEN 'Senate'
                WHEN p.PositionTitle LIKE '%Dean%' THEN 'Dean'
                WHEN p.PositionTitle LIKE '%Head of Department%' OR p.PositionTitle LIKE '%HOD%' THEN 'HOD'
                WHEN p.PositionTitle LIKE '%Assistant Lecturer%' THEN 'Assistant Lecturer'
                WHEN p.PositionTitle LIKE '%Lecturer%' AND p.PositionTitle NOT LIKE '%Assistant%' THEN 'Lecturer'
                WHEN p.PositionTitle LIKE '%Finance%' OR p.PositionTitle LIKE '%Accountant%' THEN 'Finance'
                WHEN p.PositionTitle LIKE '%Human Resource%' OR p.PositionTitle LIKE 'HR %' OR p.PositionTitle LIKE '% HR%' THEN 'HR'
                ELSE 'Other Staff'
            END AS role_category,
            COUNT(*) AS attendance_records,
            SUM(CASE WHEN ea.Status = 'Present' THEN 1 ELSE 0 END) AS present_days,
            SUM(CASE WHEN ea.Status = 'Absent' THEN 1 ELSE 0 END) AS absent_days,
            SUM(CASE WHEN ea.Status = 'Late' THEN 1 ELSE 0 END) AS late_days,
            SUM(CASE WHEN ea.Status = 'On Leave' THEN 1 ELSE 0 END) AS leave_days
        FROM {DB2_NAME}.employee_attendance ea
        JOIN {DB2_NAME}.employees e ON ea.EmployeeID = e.EmployeeID
        JOIN {DB2_NAME}.positions p ON e.PositionID = p.PositionID
        JOIN {DB1_NAME}.departments d ON e.DepartmentID = d.DepartmentID
        JOIN {DB1_NAME}.faculties f ON d.FacultyID = f.FacultyID
        {where_sql}
        GROUP BY role_category
        """
        attendance_df = pd.read_sql_query(text(attendance_sql), engine)
        attendance_by_role = attendance_df.to_dict('records') if not attendance_df.empty else []

        # Overall attendance rate: present_days / (present+absent) across all roles
        if not attendance_df.empty:
            total_present = int(attendance_df['present_days'].sum() or 0)
            total_absent = int(attendance_df['absent_days'].sum() or 0)
            denom = total_present + total_absent
            attendance_rate = (total_present / denom * 100.0) if denom > 0 else 0.0
        else:
            attendance_rate = 0.0

        # 4) Payroll analytics by role category
        payroll_sql = f"""
        SELECT
            CASE
                WHEN p.PositionTitle LIKE '%Senate%' THEN 'Senate'
                WHEN p.PositionTitle LIKE '%Dean%' THEN 'Dean'
                WHEN p.PositionTitle LIKE '%Head of Department%' OR p.PositionTitle LIKE '%HOD%' THEN 'HOD'
                WHEN p.PositionTitle LIKE '%Assistant Lecturer%' THEN 'Assistant Lecturer'
                WHEN p.PositionTitle LIKE '%Lecturer%' AND p.PositionTitle NOT LIKE '%Assistant%' THEN 'Lecturer'
                WHEN p.PositionTitle LIKE '%Finance%' OR p.PositionTitle LIKE '%Accountant%' THEN 'Finance'
                WHEN p.PositionTitle LIKE '%Human Resource%' OR p.PositionTitle LIKE 'HR %' OR p.PositionTitle LIKE '% HR%' THEN 'HR'
                ELSE 'Other Staff'
            END AS role_category,
            COUNT(DISTINCT e.EmployeeID) AS employee_count,
            COUNT(*) AS payroll_records,
            SUM(pr.NetPay) AS total_net_pay,
            AVG(pr.NetPay) AS avg_net_pay
        FROM {DB2_NAME}.payroll pr
        JOIN {DB2_NAME}.employees e ON pr.EmployeeID = e.EmployeeID
        JOIN {DB2_NAME}.positions p ON e.PositionID = p.PositionID
        JOIN {DB1_NAME}.departments d ON e.DepartmentID = d.DepartmentID
        JOIN {DB1_NAME}.faculties f ON d.FacultyID = f.FacultyID
        {where_sql}
        GROUP BY role_category
        """
        payroll_df = pd.read_sql_query(text(payroll_sql), engine)
        payroll_by_role = payroll_df.to_dict('records') if not payroll_df.empty else []
        total_payroll = float(payroll_df['total_net_pay'].sum() or 0.0) if not payroll_df.empty else 0.0

        # 5) Employee attendance trend over time (for HR attendance tab)
        attendance_trend_sql = f"""
        SELECT
            ea.Date AS attendance_date,
            COUNT(*) AS total_records,
            SUM(CASE WHEN ea.Status = 'Present' THEN 1 ELSE 0 END) AS present_days,
            SUM(CASE WHEN ea.Status = 'Absent' THEN 1 ELSE 0 END) AS absent_days,
            SUM(CASE WHEN ea.Status = 'Late' THEN 1 ELSE 0 END) AS late_days,
            SUM(CASE WHEN ea.Status = 'On Leave' THEN 1 ELSE 0 END) AS leave_days
        FROM {DB2_NAME}.employee_attendance ea
        JOIN {DB2_NAME}.employees e ON ea.EmployeeID = e.EmployeeID
        JOIN {DB2_NAME}.positions p ON e.PositionID = p.PositionID
        JOIN {DB1_NAME}.departments d ON e.DepartmentID = d.DepartmentID
        JOIN {DB1_NAME}.faculties f ON d.FacultyID = f.FacultyID
        {where_sql}
        GROUP BY ea.Date
        ORDER BY ea.Date
        """
        attendance_trend_df = pd.read_sql_query(text(attendance_trend_sql), engine)
        employee_attendance_trend = []
        if not attendance_trend_df.empty:
            for _, row in attendance_trend_df.iterrows():
                total_rec = int(row['total_records'] or 0)
                present_days = int(row['present_days'] or 0)
                absent_days = int(row['absent_days'] or 0)
                late_days = int(row['late_days'] or 0)
                leave_days = int(row['leave_days'] or 0)
                denom = present_days + absent_days
                present_rate = (present_days / denom * 100.0) if denom > 0 else 0.0
                employee_attendance_trend.append({
                    'date': str(row['attendance_date']),
                    'total_records': total_rec,
                    'present_days': present_days,
                    'absent_days': absent_days,
                    'late_days': late_days,
                    'leave_days': leave_days,
                    'present_rate': present_rate,
                })

        # 6) Students retained as employees (match by full name vs student first+last name)
        retained_sql = f"""
        SELECT
            f.faculty_name,
            d.department_name,
            COUNT(*) AS retained_count
        FROM {DB2_NAME}.employees e
        JOIN dim_student ds ON CONCAT(ds.first_name, ' ', ds.last_name) = e.FullName
        JOIN dim_program dp ON ds.program_id = dp.program_id
        JOIN dim_department d ON dp.department_id = d.department_id
        JOIN dim_faculty f ON d.faculty_id = f.faculty_id
        GROUP BY f.faculty_name, d.department_name
        ORDER BY retained_count DESC
        """
        retained_df = pd.read_sql_query(text(retained_sql), engine)
        retained_by_department = retained_df.to_dict('records') if not retained_df.empty else []
        retained_total = int(retained_df['retained_count'].sum() or 0) if not retained_df.empty else 0

        engine.dispose()

        return jsonify({
            'total_employees': total_employees,
            'total_departments': total_departments,
            'lecturers': lecturers,
            'assistant_lecturers': assistant_lecturers,
            'other_staff': other_staff,
            'employees_by_department': employees_by_department,
            'employees_by_faculty': employees_by_faculty,
            'employees_list': employees_list,
            'lecturer_employment': lecturer_employment,
            'attendance_by_role': attendance_by_role,
            'attendance_rate': attendance_rate,
            'employee_attendance_trend': employee_attendance_trend,
            'payroll_by_role': payroll_by_role,
            'total_payroll': total_payroll,
            'retained_employees_total': retained_total,
            'retained_employees_by_department': retained_by_department,
        }), 200

    except Exception as e:
        import traceback
        print(f"Error in get_hr_analytics: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/academic-risk-summary', methods=['GET'])
@jwt_required()
def get_academic_risk():
    """Returns summarized FCW, MEX, FEX (summary + top_courses_fcw). Use /academic-risk for full dashboard."""
    engine = None
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        role = user_scope['role']
        
        # Scope enforcement (Students -> 403, HR/Finance -> 403)
        if role in [Role.STUDENT, Role.FINANCE, Role.HR]:
            return jsonify({'error': 'Permission denied'}), 403
            
        filters = request.args.to_dict()
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        
        # Build filter query based on role scope and query params
        where_clauses = []
        params = {}
        
        if role == Role.HOD and user_scope.get('department_id'):
            where_clauses.append("dd.department_id = :dept_id")
            params['dept_id'] = user_scope['department_id']
        elif role == Role.DEAN and user_scope.get('faculty_id'):
            where_clauses.append("df.faculty_id = :fac_id")
            params['fac_id'] = user_scope['faculty_id']

        # Apply global filters (faculty/department/program/high_school/intake_year/semester)
        fac_id = filters.get('faculty_id')
        dept_id = filters.get('department_id')
        prog_id = filters.get('program_id')
        high_school = filters.get('high_school')
        intake_year = filters.get('intake_year')
        sem_id = filters.get('semester_id')

        if fac_id and str(fac_id).strip().lower() != 'all':
            where_clauses.append("df.faculty_id = :f_faculty_id")
            params['f_faculty_id'] = int(fac_id)
        if dept_id and str(dept_id).strip().lower() != 'all':
            where_clauses.append("dd.department_id = :f_dept_id")
            params['f_dept_id'] = int(dept_id)
        if prog_id and str(prog_id).strip().lower() != 'all':
            where_clauses.append("ds.program_id = :f_prog_id")
            params['f_prog_id'] = int(prog_id)
        if high_school and str(high_school).strip().lower() != 'all':
            params['f_hs'] = f"%{str(high_school).strip()}%"
            where_clauses.append("ds.high_school ILIKE :f_hs")
        if intake_year and str(intake_year).strip().lower() != 'all':
            try:
                params['f_year'] = int(intake_year)
                where_clauses.append("EXTRACT(YEAR FROM ds.admission_date) = :f_year")
            except Exception:
                pass
            
        where_str = ""
        if where_clauses:
            where_str = "WHERE " + " AND ".join(where_clauses)
            
        # Summary query: prefer view if present, otherwise fallback to fact_grade aggregation.
        sql_summary = f"""
        SELECT 
            COALESCE(SUM(fcw_count), 0) as fcw_count,
            COALESCE(SUM(mex_count), 0) as mex_count,
            COALESCE(SUM(fex_count), 0) as fex_count,
            COALESCE(SUM(total_courses), 0) as total_courses,
            AVG(avg_grade) as avg_grade
        FROM v_student_risk_summary v
        JOIN dim_student ds ON v.student_id = ds.student_id
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department dd ON dp.department_id = dd.department_id
        LEFT JOIN dim_faculty df ON dd.faculty_id = df.faculty_id
        {where_str}
        """
        try:
            summary_df = pd.read_sql_query(text(sql_summary), engine, params=params)
        except Exception:
            # Fallback: derive FCW/MEX/FEX directly from fact_grade when the view is missing.
            # Semester filter is only meaningful here (v_student_risk_summary may not carry semester_id).
            sem_clause = ""
            if sem_id and str(sem_id).strip().lower() != 'all':
                try:
                    params['f_sem'] = int(sem_id)
                    sem_clause = " AND fg.semester_id = :f_sem"
                except Exception:
                    sem_clause = ""

            sql_summary_fallback = f"""
            SELECT
                COALESCE(SUM(CASE WHEN fg.fcw THEN 1 ELSE 0 END), 0) as fcw_count,
                COALESCE(SUM(CASE WHEN fg.exam_status = 'MEX' THEN 1 ELSE 0 END), 0) as mex_count,
                COALESCE(SUM(CASE WHEN fg.exam_status = 'FEX' THEN 1 ELSE 0 END), 0) as fex_count,
                COALESCE(COUNT(*), 0) as total_courses,
                AVG(fg.grade) as avg_grade
            FROM fact_grade fg
            JOIN dim_student ds ON fg.student_id = ds.student_id
            LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
            LEFT JOIN dim_department dd ON dp.department_id = dd.department_id
            LEFT JOIN dim_faculty df ON dd.faculty_id = df.faculty_id
            {where_str}
            {sem_clause}
            """
            summary_df = pd.read_sql_query(text(sql_summary_fallback), engine, params=params)
        summary = summary_df.iloc[0].to_dict() if not summary_df.empty else {}
        for k in summary:
            if pd.isna(summary[k]): summary[k] = 0
            else: summary[k] = float(summary[k])
            
        # Add a placeholder for now for top courses but these can be expanded later
        top_courses_fcw = []
        engine.dispose()
        return jsonify({
            'summary': summary,
            'top_courses_fcw': top_courses_fcw
        }), 200
        
    except Exception as e:
        import traceback
        print(f"Error in get_academic_risk: {e}")
        print(traceback.format_exc())
        if engine is not None:
            try:
                engine.dispose()
            except Exception:
                pass
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/recruitment', methods=['GET'])
@jwt_required()
def get_recruitment_analytics():
    """
    Recruitment / feeder-school analytics.
    - Top feeder schools (student counts by high school)
    - Recruitment by district
    - Academic performance & risk profile by school (GPA + FCW/MEX/FEX rates)
    Exposed to Senate, Dean, HOD, Analyst, Sysadmin; not to general students/staff/finance/HR.
    """
    engine = None
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        role = user_scope['role']

        # Restrict to strategic/analytics roles
        if role in [Role.STUDENT, Role.STAFF, Role.FINANCE, Role.HR]:
            return jsonify({'error': 'Permission denied'}), 403

        filters = request.args.to_dict()
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)

        # Shared FROM/JOIN block so build_filter_query can apply scope and filters
        base_from = """
        FROM dim_student ds
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        """

        # 1) Top feeder schools
        base_feeder = f"""
        SELECT
            ds.high_school AS school,
            COALESCE(ds.high_school_district, 'Unknown') AS district,
            COUNT(DISTINCT ds.student_id) AS student_count
        {base_from}
        """
        feeder_query, params = build_filter_query(filters, base_feeder, user_scope)
        if "WHERE" in feeder_query.upper():
            feeder_query += " AND ds.high_school IS NOT NULL AND ds.high_school <> ''"
        else:
            feeder_query += " WHERE ds.high_school IS NOT NULL AND ds.high_school <> ''"
        feeder_query += " GROUP BY ds.high_school, ds.high_school_district ORDER BY student_count DESC"
        feeder_df = pd.read_sql_query(text(feeder_query), engine, params=params)
        top_schools = feeder_df.to_dict('records') if not feeder_df.empty else []

        # 2) Recruitment by district
        base_district = f"""
        SELECT
            COALESCE(ds.high_school_district, 'Unknown') AS district,
            COUNT(DISTINCT ds.student_id) AS student_count
        {base_from}
        """
        district_query, params_dist = build_filter_query(filters, base_district, user_scope)
        district_query += " GROUP BY ds.high_school_district ORDER BY student_count DESC"
        district_df = pd.read_sql_query(text(district_query), engine, params=params_dist)
        by_district = district_df.to_dict('records') if not district_df.empty else []

        # 3) Academic performance & risk profile by school (scoped, similar to v_highschool_risk)
        base_perf = f"""
        SELECT
            ds.high_school AS school,
            COALESCE(ds.high_school_district, 'Unknown') AS district,
            AVG(CASE WHEN fg.fcw THEN 1.0 ELSE 0.0 END) AS fcw_rate,
            AVG(CASE WHEN fg.exam_status = 'MEX' THEN 1.0 ELSE 0.0 END) AS mex_rate,
            AVG(CASE WHEN fg.exam_status = 'FEX' THEN 1.0 ELSE 0.0 END) AS fex_rate,
            AVG(fg.grade) AS avg_gpa
        FROM fact_grade fg
        JOIN dim_student ds ON fg.student_id = ds.student_id
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        """
        perf_query, params_perf = build_filter_query(filters, base_perf, user_scope)
        if "WHERE" in perf_query.upper():
            perf_query += " AND ds.high_school IS NOT NULL AND ds.high_school <> ''"
        else:
            perf_query += " WHERE ds.high_school IS NOT NULL AND ds.high_school <> ''"
        perf_query += " GROUP BY ds.high_school, ds.high_school_district ORDER BY fcw_rate DESC"
        perf_df = pd.read_sql_query(text(perf_query), engine, params=params_perf)
        performance_by_school = perf_df.to_dict('records') if not perf_df.empty else []

        # High-level recruitment KPIs
        total_students = int(feeder_df['student_count'].sum()) if not feeder_df.empty else 0
        schools_represented = int(feeder_df['school'].nunique()) if not feeder_df.empty else 0
        district_coverage = int(district_df['district'].nunique()) if not district_df.empty else 0

        if engine is not None:
            engine.dispose()

        return jsonify({
            'summary': {
                'total_students': total_students,
                'schools_represented': schools_represented,
                'district_coverage': district_coverage,
            },
            'top_schools': top_schools,
            'by_district': by_district,
            'performance_by_school': performance_by_school,
        }), 200

    except Exception as e:
        import traceback
        print(f"Error in get_recruitment_analytics: {e}")
        print(traceback.format_exc())
        if engine is not None:
            try:
                engine.dispose()
            except Exception:
                pass
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/high-school-risk-correlation', methods=['GET'])
@jwt_required()
def get_high_school_risk_correlation():
    """Returns correlation between high school background & academic risk statuses. Respects global filters and role scope."""
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        role = user_scope['role']
        
        if role in [Role.STUDENT, Role.STAFF, Role.FINANCE, Role.HR]:
            return jsonify({'error': 'Permission denied'}), 403

        filters = request.args.to_dict()
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)

        # Default window: focus on the current semester when filters are "all" / empty.
        current_semester = None
        sem_e = (filters.get('semester_id') or '').strip().lower()
        ay_e = (filters.get('academic_year') or '').strip().lower()
        if sem_e in ('', 'all') and ay_e in ('', 'all'):
            try:
                recent_sql = """
                SELECT
                    ds.academic_year,
                    fg.semester_id
                FROM fact_grade fg
                JOIN dim_student ds ON fg.student_id = ds.student_id
                WHERE fg.semester_id IS NOT NULL
                  AND ds.high_school IS NOT NULL
                  AND ds.high_school <> ''
                  AND ds.academic_year IS NOT NULL
                GROUP BY ds.academic_year, fg.semester_id
                ORDER BY ds.academic_year DESC, fg.semester_id DESC
                LIMIT 1
                """
                recent_df = pd.read_sql_query(text(recent_sql), engine)
                if not recent_df.empty:
                    row = recent_df.iloc[0]
                    ay = str(row.get('academic_year') or '').strip()
                    sem = int(row.get('semester_id')) if row.get('semester_id') is not None else None
                    if ay and sem is not None:
                        current_semester = (ay, sem)
            except Exception:
                current_semester = None

        has_scope = (role == Role.HOD and user_scope.get('department_id')) or (role == Role.DEAN and user_scope.get('faculty_id'))
        filter_keys = ['faculty_id', 'department_id', 'program_id', 'course_code', 'semester_id', 'high_school', 'access_number', 'reg_number', 'student_name', 'intake_year']
        has_filters = any(filters.get(k) for k in filter_keys)

        if has_scope or has_filters:
            # Filtered path: same metrics from fact_grade + dims with role/filters applied
            base_school = """
            SELECT ds.high_school as school,
                   COALESCE(ds.high_school_district, 'Unknown') as district,
                   AVG(CASE WHEN fg.fcw THEN 1.0 ELSE 0.0 END) as fcw_rate,
                   AVG(CASE WHEN fg.exam_status = 'MEX' THEN 1.0 ELSE 0.0 END) as mex_rate,
                   AVG(CASE WHEN fg.exam_status = 'FEX' THEN 1.0 ELSE 0.0 END) as fex_rate,
                   AVG(fg.grade) as avg_gpa
            FROM fact_grade fg
            JOIN dim_student ds ON fg.student_id = ds.student_id
            LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
            LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
            LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
            LEFT JOIN dim_course dc ON fg.course_code = dc.course_code
            """
            q, params = build_filter_query(filters, base_school, user_scope)

            # Apply current-semester window when applicable so high-school risk defaults to current semester.
            if current_semester:
                ay, sem = current_semester
                params['hs_ay'] = ay
                params['hs_sem'] = sem
                if "WHERE" in q.upper():
                    q += " AND ds.academic_year = :hs_ay AND fg.semester_id = :hs_sem"
                else:
                    q += " WHERE ds.academic_year = :hs_ay AND fg.semester_id = :hs_sem"

            q += " AND ds.high_school IS NOT NULL AND ds.high_school != ''"
            q += " GROUP BY ds.high_school, ds.high_school_district ORDER BY fcw_rate DESC"
            df = pd.read_sql_query(text(q), engine, params=params)
            by_school = df.to_dict('records') if not df.empty else []
            if not df.empty and 'district' in df.columns:
                dist_df = df.groupby('district').agg({'fcw_rate': 'mean', 'avg_gpa': 'mean'}).reset_index()
                dist_df.columns = ['district', 'avg_fcw_rate', 'avg_grade']
                by_district = dist_df.sort_values('avg_fcw_rate', ascending=False).to_dict('records')
            else:
                by_district = []
        else:
            # Fast path: use the prebuilt warehouse view (if it exists).
            # If the view isn't created in this environment, fall back to
            # computing the same metrics from fact_grade + dim_student.
            try:
                sql = """
                SELECT high_school as school,
                       COALESCE(high_school_district, 'Unknown') as district,
                       COALESCE(fcw_rate, 0) as fcw_rate,
                       COALESCE(mex_rate, 0) as mex_rate,
                       COALESCE(fex_rate, 0) as fex_rate,
                       COALESCE(avg_grade, 0) as avg_gpa
                FROM v_highschool_risk
                ORDER BY fcw_rate DESC
                """
                df = pd.read_sql_query(text(sql), engine)
                by_school = df.to_dict('records') if not df.empty else []

                sql_district = """
                SELECT COALESCE(high_school_district, 'Unknown') as district,
                       AVG(fcw_rate) as avg_fcw_rate,
                       AVG(avg_grade) as avg_grade
                FROM v_highschool_risk
                GROUP BY high_school_district
                ORDER BY avg_fcw_rate DESC
                """
                dist_df = pd.read_sql_query(text(sql_district), engine)
                by_district = dist_df.to_dict('records') if not dist_df.empty else []
            except Exception:
                # Robust fallback (no dependency on v_highschool_risk view).
                q, params = build_filter_query(filters, base_school, user_scope)

                def _has_where(sql_text: str) -> bool:
                    return ' WHERE ' in sql_text.upper() or sql_text.upper().strip().startswith('WHERE')

                if current_semester:
                    ay, sem = current_semester
                    params['hs_ay'] = ay
                    params['hs_sem'] = sem
                    if _has_where(q):
                        q += " AND ds.academic_year = :hs_ay AND fg.semester_id = :hs_sem"
                    else:
                        q += " WHERE ds.academic_year = :hs_ay AND fg.semester_id = :hs_sem"

                if _has_where(q):
                    q += " AND ds.high_school IS NOT NULL AND ds.high_school <> ''"
                else:
                    q += " WHERE ds.high_school IS NOT NULL AND ds.high_school <> ''"

                q += " GROUP BY ds.high_school, ds.high_school_district ORDER BY fcw_rate DESC"
                df = pd.read_sql_query(text(q), engine, params=params)
                by_school = df.to_dict('records') if not df.empty else []

                if not df.empty and 'district' in df.columns:
                    dist_df = df.groupby('district').agg({'fcw_rate': 'mean', 'avg_gpa': 'mean'}).reset_index()
                    dist_df.columns = ['district', 'avg_fcw_rate', 'avg_grade']
                    by_district = dist_df.sort_values('avg_fcw_rate', ascending=False).to_dict('records')
                else:
                    by_district = []

        engine.dispose()
        return jsonify({
            'by_school': by_school,
            'by_district': by_district,
            'by_tier': [],
            'by_ownership': []
        }), 200

    except Exception as e:
        import traceback
        print(f"Error in get_high_school_risk_correlation: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500
