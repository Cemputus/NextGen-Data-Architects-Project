"""
Analytics API with RBAC and advanced filtering
Includes FEX analytics, high school analytics, and role-based data scoping
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from sqlalchemy import create_engine, text
import pandas as pd
from rbac import Role, Resource, Permission, has_permission
from datetime import datetime, timedelta
from config import DATA_WAREHOUSE_CONN_STRING

analytics_bp = Blueprint('analytics', __name__, url_prefix='/api/analytics')

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

def build_filter_query(filters, base_query, user_scope):
    """Build SQL query with filters and role-based scoping"""
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
        if filters.get('faculty_id'):
            where_clauses.append("df.faculty_id = :filter_faculty_id")
            params['filter_faculty_id'] = filters['faculty_id']
        
        if filters.get('department_id'):
            where_clauses.append("ddept.department_id = :filter_department_id")
            params['filter_department_id'] = filters['department_id']
        
        if filters.get('program_id'):
            where_clauses.append("dp.program_id = :filter_program_id")
            params['filter_program_id'] = filters['program_id']
        
        if filters.get('course_code'):
            where_clauses.append("dc.course_code = :filter_course_code")
            params['filter_course_code'] = filters['course_code']
        
        if filters.get('access_number'):
            where_clauses.append("ds.access_number = :filter_access_number")
            params['filter_access_number'] = filters['access_number']
        
        if filters.get('reg_number'):
            where_clauses.append("ds.student_id = :filter_reg_number")
            params['filter_reg_number'] = filters['reg_number']
        
        if filters.get('intake_year'):
            where_clauses.append("YEAR(ds.admission_date) = :filter_intake_year")
            params['filter_intake_year'] = filters['intake_year']
        
        if filters.get('semester_id'):
            where_clauses.append("fg.semester_id = :filter_semester_id")
            params['filter_semester_id'] = filters['semester_id']
        
        if filters.get('gender'):
            where_clauses.append("ds.gender = :filter_gender")
            params['filter_gender'] = filters['gender']
        
        if filters.get('high_school'):
            where_clauses.append("ds.high_school LIKE :filter_high_school")
            params['filter_high_school'] = f"%{filters['high_school']}%"
        
        if filters.get('student_name'):
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
        JOIN dim_course dc ON fg.course_code = dc.course_code
        LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
        LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
        LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        """
        
        query, params = build_filter_query(filters, base_query, user_scope)
        
        # Add grouping
        query += f" GROUP BY {group_by_cols}"
        
        # First, get summary totals (simple query without complex joins)
        simple_check_query = """
        SELECT 
            COUNT(CASE WHEN exam_status = 'FEX' THEN 1 END) as total_fex,
            COUNT(CASE WHEN exam_status = 'MEX' THEN 1 END) as total_mex,
            COUNT(CASE WHEN exam_status = 'FCW' THEN 1 END) as total_fcw,
            COUNT(CASE WHEN exam_status = 'Completed' THEN 1 END) as total_completed,
            COUNT(*) as total_exams
        FROM fact_grade
        """
        simple_df = pd.read_sql_query(text(simple_check_query), engine)
        
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

@analytics_bp.route('/high-school', methods=['GET'])
@jwt_required()
def get_high_school_analytics():
    """Get high school analytics - enrollment, retention, graduation rates, tuition completion, performance"""
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        
        if not has_permission(user_scope['role'], Resource.HIGH_SCHOOL_ANALYTICS, Permission.READ, user_scope):
            return jsonify({'error': 'Permission denied'}), 403
        
        filters = request.args.to_dict()
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
                    where_clauses.append("YEAR(ds.admission_date) = :filter_intake_year")
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
        return jsonify({'error': str(e)}), 500

@analytics_bp.route('/filter-options', methods=['GET'])
@jwt_required()
def get_filter_options():
    """Get available filter options based on user role with cascading support"""
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        
        # Get filter parameters for cascading
        faculty_id = request.args.get('faculty_id', type=int)
        department_id = request.args.get('department_id', type=int)
        program_id = request.args.get('program_id', type=int)
        
        options = {}
        role = user_scope['role']
        
        # Get faculties - role-based access
        if role == Role.STUDENT:
            # Students don't need faculty filter (they see their own data)
            options['faculties'] = []
        elif role == Role.HOD and user_scope.get('department_id'):
            # HOD sees their department's faculty
            faculty_query = """
                SELECT DISTINCT d.faculty_id, f.faculty_name 
                FROM dim_department d
                JOIN dim_faculty f ON d.faculty_id = f.faculty_id
                WHERE d.department_id = :dept_id
            """
            faculties = pd.read_sql_query(text(faculty_query), engine, params={'dept_id': user_scope['department_id']})
            options['faculties'] = faculties.to_dict('records')
        elif role == Role.DEAN and user_scope.get('faculty_id'):
            # Dean sees only their faculty
            faculty_query = """
                SELECT DISTINCT faculty_id, faculty_name 
                FROM dim_faculty
                WHERE faculty_id = :fac_id
            """
            faculties = pd.read_sql_query(text(faculty_query), engine, params={'fac_id': user_scope['faculty_id']})
            options['faculties'] = faculties.to_dict('records')
        else:
            # Staff, Senate, Analyst, Finance, HR, SYSADMIN - see all faculties
            faculty_query = "SELECT DISTINCT faculty_id, faculty_name FROM dim_faculty ORDER BY faculty_name"
            faculties = pd.read_sql_query(text(faculty_query), engine)
            options['faculties'] = faculties.to_dict('records')
        
        # Get departments - filtered by faculty if provided, with role-based scoping
        dept_query = """
            SELECT DISTINCT d.department_id, d.department_name, d.faculty_id
            FROM dim_department d
        """
        dept_where = []
        
        # Role-based scoping for departments
        if role == Role.HOD and user_scope.get('department_id'):
            dept_where.append(f"d.department_id = {user_scope['department_id']}")
        elif role == Role.DEAN and user_scope.get('faculty_id'):
            # Dean sees departments in their faculty
            if not faculty_id:  # If no filter selected, use dean's faculty
                dept_where.append(f"d.faculty_id = {user_scope['faculty_id']}")
        elif role == Role.STUDENT:
            # Students don't need department filter
            options['departments'] = []
        elif role == Role.STAFF:
            # Staff may have department scope - for now allow all (can be restricted)
            pass
        
        # Apply user-selected faculty filter
        if faculty_id:
            dept_where.append(f"d.faculty_id = {faculty_id}")
        
        if dept_where:
            dept_query += " WHERE " + " AND ".join(dept_where)
        dept_query += " ORDER BY d.department_name"
        
        if role != Role.STUDENT:
            departments = pd.read_sql_query(text(dept_query), engine)
            options['departments'] = departments.to_dict('records')
        else:
            options['departments'] = []
        
        # Get programs - filtered by department if provided, or by faculty if department not provided
        prog_query = """
            SELECT DISTINCT p.program_id, p.program_name, p.department_id, d.faculty_id
            FROM dim_program p
            JOIN dim_department d ON p.department_id = d.department_id
        """
        prog_where = []
        
        # Role-based scoping for programs
        if role == Role.HOD and user_scope.get('department_id'):
            if not department_id:  # If no filter selected, use HOD's department
                prog_where.append(f"p.department_id = {user_scope['department_id']}")
        elif role == Role.DEAN and user_scope.get('faculty_id'):
            if not faculty_id and not department_id:  # If no filters, use dean's faculty
                prog_where.append(f"d.faculty_id = {user_scope['faculty_id']}")
        elif role == Role.STUDENT:
            # Students see their own program
            if user_scope.get('student_id'):
                # Get student's program from dim_student
                student_prog_query = """
                    SELECT DISTINCT p.program_id, p.program_name, p.department_id, d.faculty_id
                    FROM dim_program p
                    JOIN dim_department d ON p.department_id = d.department_id
                    JOIN dim_student ds ON p.program_id = ds.program_id
                    WHERE ds.student_id = :student_id
                """
                programs = pd.read_sql_query(text(student_prog_query), engine, params={'student_id': user_scope['student_id']})
                options['programs'] = programs.to_dict('records')
            else:
                options['programs'] = []
        
        # Apply user-selected filters
        if role != Role.STUDENT:
            if department_id:
                prog_where.append(f"p.department_id = {department_id}")
            elif faculty_id:
                prog_where.append(f"d.faculty_id = {faculty_id}")
            
            if prog_where:
                prog_query += " WHERE " + " AND ".join(prog_where)
            prog_query += " ORDER BY p.program_name"
            
            programs = pd.read_sql_query(text(prog_query), engine)
            options['programs'] = programs.to_dict('records')
        
        # Get courses - filtered by department if provided, or by faculty if department not provided
        # Role-based scoping for courses
        if role == Role.STUDENT:
            # Students see courses they're enrolled in
            course_query = """
                SELECT DISTINCT c.course_code, c.course_name
                FROM dim_course c
                JOIN fact_enrollment fe ON c.course_code = fe.course_code
                JOIN dim_student ds ON fe.student_id = ds.student_id
                WHERE ds.student_id = :student_id
                ORDER BY c.course_code
            """
            if user_scope.get('student_id'):
                courses = pd.read_sql_query(text(course_query), engine, params={'student_id': user_scope['student_id']})
                options['courses'] = courses.to_dict('records')
            else:
                options['courses'] = []
        elif role == Role.STAFF:
            # Staff see courses they teach (can be enhanced with staff-course mapping)
            # For now, show all courses (can be filtered by department/faculty)
            if department_id:
                course_query = """
                    SELECT DISTINCT c.course_code, c.course_name
                    FROM dim_course c
                    WHERE c.department = (SELECT department_name FROM dim_department WHERE department_id = :dept_id)
                    ORDER BY c.course_code
                """
                courses = pd.read_sql_query(text(course_query), engine, params={'dept_id': department_id})
            elif faculty_id:
                course_query = """
                    SELECT DISTINCT c.course_code, c.course_name
                    FROM dim_course c
                    JOIN dim_department d ON c.department = d.department_name
                    WHERE d.faculty_id = :fac_id
                    ORDER BY c.course_code
                """
                courses = pd.read_sql_query(text(course_query), engine, params={'fac_id': faculty_id})
            else:
                course_query = "SELECT DISTINCT course_code, course_name FROM dim_course ORDER BY course_code"
                courses = pd.read_sql_query(text(course_query), engine)
            options['courses'] = courses.to_dict('records')
        else:
            # Other roles (Dean, HOD, Senate, Analyst, Finance, HR) - filtered by selection
            if department_id:
                course_query = """
                    SELECT DISTINCT c.course_code, c.course_name
                    FROM dim_course c
                    WHERE c.department = (SELECT department_name FROM dim_department WHERE department_id = :dept_id)
                    ORDER BY c.course_code
                """
                courses = pd.read_sql_query(text(course_query), engine, params={'dept_id': department_id})
            elif faculty_id:
                course_query = """
                    SELECT DISTINCT c.course_code, c.course_name
                    FROM dim_course c
                    JOIN dim_department d ON c.department = d.department_name
                    WHERE d.faculty_id = :fac_id
                    ORDER BY c.course_code
                """
                courses = pd.read_sql_query(text(course_query), engine, params={'fac_id': faculty_id})
            else:
                # Apply role-based scoping if no filters
                if role == Role.HOD and user_scope.get('department_id'):
                    course_query = """
                        SELECT DISTINCT c.course_code, c.course_name
                        FROM dim_course c
                        WHERE c.department = (SELECT department_name FROM dim_department WHERE department_id = :dept_id)
                        ORDER BY c.course_code
                    """
                    courses = pd.read_sql_query(text(course_query), engine, params={'dept_id': user_scope['department_id']})
                elif role == Role.DEAN and user_scope.get('faculty_id'):
                    course_query = """
                        SELECT DISTINCT c.course_code, c.course_name
                        FROM dim_course c
                        JOIN dim_department d ON c.department = d.department_name
                        WHERE d.faculty_id = :fac_id
                        ORDER BY c.course_code
                    """
                    courses = pd.read_sql_query(text(course_query), engine, params={'fac_id': user_scope['faculty_id']})
                else:
                    course_query = "SELECT DISTINCT course_code, course_name FROM dim_course ORDER BY course_code"
                    courses = pd.read_sql_query(text(course_query), engine)
            options['courses'] = courses.to_dict('records')
        
        # Get semesters
        semesters = pd.read_sql_query(
            "SELECT semester_id, semester_name FROM dim_semester ORDER BY semester_id",
            engine
        )
        options['semesters'] = semesters.to_dict('records')
        
        # Get high schools - role-based scoping
        if role == Role.STUDENT:
            # Students don't need high school filter
            options['high_schools'] = []
        else:
            high_school_query = "SELECT DISTINCT high_school, high_school_district FROM dim_student WHERE high_school IS NOT NULL"
            hs_where = []
            
            # Apply role-based scoping
            if role == Role.DEAN and user_scope.get('faculty_id') and not faculty_id:
                # Filter by dean's faculty
                high_school_query = """
                    SELECT DISTINCT ds.high_school, ds.high_school_district
                    FROM dim_student ds
                    JOIN dim_program p ON ds.program_id = p.program_id
                    JOIN dim_department d ON p.department_id = d.department_id
                    WHERE ds.high_school IS NOT NULL AND d.faculty_id = :fac_id
                """
                high_schools = pd.read_sql_query(text(high_school_query), engine, params={'fac_id': user_scope['faculty_id']})
                options['high_schools'] = high_schools.to_dict('records')
            elif role == Role.HOD and user_scope.get('department_id') and not department_id:
                high_school_query = """
                    SELECT DISTINCT ds.high_school, ds.high_school_district
                    FROM dim_student ds
                    JOIN dim_program p ON ds.program_id = p.program_id
                    WHERE ds.high_school IS NOT NULL AND p.department_id = :dept_id
                """
                high_schools = pd.read_sql_query(text(high_school_query), engine, params={'dept_id': user_scope['department_id']})
                options['high_schools'] = high_schools.to_dict('records')
            else:
                high_school_query += " ORDER BY high_school"
                high_schools = pd.read_sql_query(text(high_school_query), engine)
                options['high_schools'] = high_schools.to_dict('records')
        
        # Get intake years - role-based scoping
        if role == Role.STUDENT:
            # Students see their own intake year
            if user_scope.get('student_id'):
                intake_query = """
                    SELECT DISTINCT YEAR(admission_date) as year 
                    FROM dim_student 
                    WHERE student_id = :student_id AND admission_date IS NOT NULL
                """
                intake_years = pd.read_sql_query(text(intake_query), engine, params={'student_id': user_scope['student_id']})
                options['intake_years'] = intake_years['year'].tolist() if not intake_years.empty else []
            else:
                options['intake_years'] = []
        else:
            intake_query = "SELECT DISTINCT YEAR(admission_date) as year FROM dim_student WHERE admission_date IS NOT NULL"
            
            # Apply role-based scoping
            if role == Role.DEAN and user_scope.get('faculty_id') and not faculty_id:
                intake_query = """
                    SELECT DISTINCT YEAR(ds.admission_date) as year
                    FROM dim_student ds
                    JOIN dim_program p ON ds.program_id = p.program_id
                    JOIN dim_department d ON p.department_id = d.department_id
                    WHERE ds.admission_date IS NOT NULL AND d.faculty_id = :fac_id
                """
                intake_years = pd.read_sql_query(text(intake_query), engine, params={'fac_id': user_scope['faculty_id']})
                options['intake_years'] = intake_years['year'].tolist() if not intake_years.empty else []
            elif role == Role.HOD and user_scope.get('department_id') and not department_id:
                intake_query = """
                    SELECT DISTINCT YEAR(ds.admission_date) as year
                    FROM dim_student ds
                    JOIN dim_program p ON ds.program_id = p.program_id
                    WHERE ds.admission_date IS NOT NULL AND p.department_id = :dept_id
                """
                intake_years = pd.read_sql_query(text(intake_query), engine, params={'dept_id': user_scope['department_id']})
                options['intake_years'] = intake_years['year'].tolist() if not intake_years.empty else []
            else:
                intake_query += " ORDER BY year DESC"
                intake_years = pd.read_sql_query(text(intake_query), engine)
                options['intake_years'] = intake_years['year'].tolist() if not intake_years.empty else []
        
        engine.dispose()
        
        return jsonify(options), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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
        engine.dispose()
        
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
        }), 200
        
    except Exception as e:
        import traceback
        print(f"Error in get_student_analytics: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500
