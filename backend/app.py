"""
Flask Backend API for NextGen-Data-Architects System
Enhanced with RBAC, Multi-role Support, and Advanced Analytics
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required
import pandas as pd
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
from config import DATA_WAREHOUSE_CONN_STRING, SECRET_KEY, JWT_SECRET_KEY
from ml_models import MultiModelPredictor

# Import blueprints
from api.auth import auth_bp
from api.analytics import analytics_bp

# Import predictions blueprint
try:
    from api.predictions import predictions_bp
except ImportError:
    predictions_bp = None

# Import export blueprint
try:
    from api.export import export_bp
except ImportError:
    export_bp = None

# Admin API (system status, ETL, audit logs)
try:
    from api.admin import admin_bp
except ImportError:
    admin_bp = None

app = Flask(__name__)
app.config['SECRET_KEY'] = SECRET_KEY
app.config['JWT_SECRET_KEY'] = JWT_SECRET_KEY
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)

CORS(app, supports_credentials=True)
jwt = JWTManager(app)

# Register blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(analytics_bp)
if predictions_bp:
    app.register_blueprint(predictions_bp)
if export_bp:
    app.register_blueprint(export_bp)
if admin_bp:
    app.register_blueprint(admin_bp)

# Initialize ML model
predictor = MultiModelPredictor()
try:
    predictor.load_models()
except:
    print("Models not loaded. Train models first.")

@app.route('/api/status', methods=['GET'])
def get_status():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'message': 'Backend server is running',
        'timestamp': datetime.now().isoformat()
    }), 200

@app.route('/api/dashboard/stats', methods=['GET'])
@jwt_required()
def get_dashboard_stats():
    """Get dashboard statistics"""
    engine = None
    try:
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        
        # Total students - with error handling
        try:
            total_students_result = pd.read_sql_query("SELECT COUNT(DISTINCT student_id) as count FROM dim_student", engine)
            total_students = int(total_students_result['count'][0]) if not total_students_result.empty and pd.notna(total_students_result['count'][0]) else 0
        except Exception as e:
            print(f"Error getting total_students: {e}")
            total_students = 0
        
        # Total courses
        try:
            total_courses_result = pd.read_sql_query("SELECT COUNT(*) as count FROM dim_course", engine)
            total_courses = int(total_courses_result['count'][0]) if not total_courses_result.empty and pd.notna(total_courses_result['count'][0]) else 0
        except Exception as e:
            print(f"Error getting total_courses: {e}")
            total_courses = 0
        
        # Total enrollments
        try:
            total_enrollments_result = pd.read_sql_query("SELECT COUNT(*) as count FROM fact_enrollment", engine)
            total_enrollments = int(total_enrollments_result['count'][0]) if not total_enrollments_result.empty and pd.notna(total_enrollments_result['count'][0]) else 0
        except Exception as e:
            print(f"Error getting total_enrollments: {e}")
            total_enrollments = 0
        
        # Average grade (only completed exams)
        try:
            avg_grade_result = pd.read_sql_query(
                "SELECT AVG(grade) as avg FROM fact_grade WHERE exam_status = 'Completed'", engine
            )
            avg_grade = float(avg_grade_result['avg'][0]) if not avg_grade_result.empty and pd.notna(avg_grade_result['avg'][0]) else 0.0
        except Exception as e:
            print(f"Error getting avg_grade: {e}")
            avg_grade = 0.0
        
        # MEX/FEX statistics
        try:
            mex_count_result = pd.read_sql_query(
                "SELECT COUNT(*) as count FROM fact_grade WHERE exam_status = 'MEX'", engine
            )
            mex_count = int(mex_count_result['count'][0]) if not mex_count_result.empty and pd.notna(mex_count_result['count'][0]) else 0
        except Exception as e:
            print(f"Error getting mex_count: {e}")
            mex_count = 0
        
        try:
            fex_count_result = pd.read_sql_query(
                "SELECT COUNT(*) as count FROM fact_grade WHERE exam_status = 'FEX'", engine
            )
            fex_count = int(fex_count_result['count'][0]) if not fex_count_result.empty and pd.notna(fex_count_result['count'][0]) else 0
        except Exception as e:
            print(f"Error getting fex_count: {e}")
            fex_count = 0
        
        # Tuition-related missed exams
        try:
            tuition_mex_result = pd.read_sql_query(
                "SELECT COUNT(*) as count FROM fact_grade WHERE exam_status = 'MEX' AND (absence_reason LIKE '%%Tuition%%' OR absence_reason LIKE '%%Financial%%')", engine
            )
            tuition_mex_count = int(tuition_mex_result['count'][0]) if not tuition_mex_result.empty and pd.notna(tuition_mex_result['count'][0]) else 0
        except Exception as e:
            print(f"Error getting tuition_mex_count: {e}")
            tuition_mex_count = 0
        
        # Total payments
        try:
            total_payments_result = pd.read_sql_query(
                "SELECT SUM(amount) as total FROM fact_payment WHERE status = 'Completed'", engine
            )
            total_payments = float(total_payments_result['total'][0]) if not total_payments_result.empty and pd.notna(total_payments_result['total'][0]) else 0.0
        except Exception as e:
            print(f"Error getting total_payments: {e}")
            total_payments = 0.0
        
        # Average attendance
        try:
            avg_attendance_result = pd.read_sql_query(
                "SELECT AVG(total_hours) as avg FROM fact_attendance", engine
            )
            avg_attendance = float(avg_attendance_result['avg'][0]) if not avg_attendance_result.empty and pd.notna(avg_attendance_result['avg'][0]) else 0.0
        except Exception as e:
            print(f"Error getting avg_attendance: {e}")
            avg_attendance = 0.0
        
        # Total High Schools
        try:
            high_schools_result = pd.read_sql_query(
                "SELECT COUNT(DISTINCT high_school) as count FROM dim_student WHERE high_school IS NOT NULL AND high_school != ''", engine
            )
            total_high_schools = int(high_schools_result['count'][0]) if not high_schools_result.empty and pd.notna(high_schools_result['count'][0]) else 0
        except Exception as e:
            print(f"Error getting total_high_schools: {e}")
            total_high_schools = 0
        
        # Average Retention Rate (Active students / Total students)
        try:
            retention_result = pd.read_sql_query(
                """
                SELECT 
                    COUNT(DISTINCT CASE WHEN status = 'Active' THEN student_id END) as active,
                    COUNT(DISTINCT student_id) as total
                FROM dim_student
                """, engine
            )
            if not retention_result.empty and pd.notna(retention_result['total'][0]) and retention_result['total'][0] > 0:
                avg_retention_rate = (retention_result['active'][0] / retention_result['total'][0]) * 100
            else:
                avg_retention_rate = 0.0
        except Exception as e:
            print(f"Error getting avg_retention_rate: {e}")
            avg_retention_rate = 0.0
        
        # Average Graduation Rate (Graduated students / Total students)
        try:
            graduation_result = pd.read_sql_query(
                """
                SELECT 
                    COUNT(DISTINCT CASE WHEN status = 'Graduated' THEN student_id END) as graduated,
                    COUNT(DISTINCT student_id) as total
                FROM dim_student
                """, engine
            )
            if not graduation_result.empty and pd.notna(graduation_result['total'][0]) and graduation_result['total'][0] > 0:
                avg_graduation_rate = (graduation_result['graduated'][0] / graduation_result['total'][0]) * 100
            else:
                avg_graduation_rate = 0.0
        except Exception as e:
            print(f"Error getting avg_graduation_rate: {e}")
            avg_graduation_rate = 0.0
        
        # Outstanding Payments (Pending payments total)
        try:
            outstanding_result = pd.read_sql_query(
                "SELECT SUM(amount) as total FROM fact_payment WHERE status = 'Pending'", engine
            )
            outstanding_payments = float(outstanding_result['total'][0]) if not outstanding_result.empty and pd.notna(outstanding_result['total'][0]) else 0.0
        except Exception as e:
            print(f"Error getting outstanding_payments: {e}")
            outstanding_payments = 0.0
        
        return jsonify({
            'total_students': total_students,
            'total_courses': total_courses,
            'total_enrollments': total_enrollments,
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
            'graduation_rate': round(avg_graduation_rate, 2)
        })
    except Exception as e:
        import traceback
        print(f"Error in get_dashboard_stats: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500
    finally:
        if engine:
            engine.dispose()


@app.route('/api/dashboard/students-by-department', methods=['GET'])
@jwt_required()
def get_students_by_department():
    """Get student count by department with role-based filtering"""
    try:
        from flask_jwt_extended import get_jwt
        from rbac import Role
        
        claims = get_jwt()
        role_str = claims.get('role', 'student')
        try:
            role = Role(role_str.lower())
        except:
            role = Role.STUDENT
        
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        filters = request.args.to_dict()
        
        # Build WHERE clause based on role and filters
        where_clauses = []
        
        # Role-based scoping
        if role == Role.DEAN and claims.get('faculty_id'):
            where_clauses.append(f"df.faculty_id = {claims['faculty_id']}")
        elif role == Role.HOD and claims.get('department_id'):
            where_clauses.append(f"ddept.department_id = {claims['department_id']}")
        elif role == Role.STAFF:
            # Staff sees their classes - filter by program/courses they teach
            # This would need staff-course mapping in production
            pass
        
        # Apply user filters
        if filters.get('faculty_id'):
            where_clauses.append(f"df.faculty_id = {filters['faculty_id']}")
        if filters.get('department_id'):
            where_clauses.append(f"ddept.department_id = {filters['department_id']}")
        if filters.get('program_id'):
            where_clauses.append(f"ds.program_id = {filters['program_id']}")
        if filters.get('semester_id'):
            where_clauses.append(f"fe.semester_id = {filters['semester_id']}")
        
        where_clause = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        
        query = f"""
        SELECT 
            ddept.department_name as department,
            df.faculty_name as faculty,
            COUNT(DISTINCT ds.student_id) as student_count
        FROM dim_student ds
        JOIN dim_program dp ON ds.program_id = dp.program_id
        JOIN dim_department ddept ON dp.department_id = ddept.department_id
        JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        LEFT JOIN fact_enrollment fe ON ds.student_id = fe.student_id
        {where_clause}
        GROUP BY ddept.department_name, df.faculty_name
        ORDER BY student_count DESC
        """
        
        df = pd.read_sql_query(text(query), engine)
        engine.dispose()
        
        return jsonify({
            'departments': df['department'].tolist(),
            'faculties': df['faculty'].tolist(),
            'counts': df['student_count'].tolist()
        })
    except Exception as e:
        print(f"Error in get_students_by_department: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/grades-over-time', methods=['GET'])
@jwt_required()
def get_grades_over_time():
    """Get average grades over time with role-based filtering"""
    try:
        from flask_jwt_extended import get_jwt
        from rbac import Role
        
        claims = get_jwt()
        role_str = claims.get('role', 'student')
        try:
            role = Role(role_str.lower())
        except:
            role = Role.STUDENT
        
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        filters = request.args.to_dict()
        
        # Build WHERE clause based on role
        where_clauses = []
        
        # Role-based scoping
        if role == Role.STAFF:
            # Staff sees their courses - would need staff-course mapping
            # For now, show all courses (can be filtered by program_id)
            if filters.get('program_id'):
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
        
        # Apply user filters (ignore empty strings and "all" values)
        if filters.get('faculty_id') and str(filters['faculty_id']).strip() and str(filters['faculty_id']).lower() != 'all':
            where_clauses.append(f"df.faculty_id = {filters['faculty_id']}")
        if filters.get('department_id') and str(filters['department_id']).strip() and str(filters['department_id']).lower() != 'all':
            where_clauses.append(f"ddept.department_id = {filters['department_id']}")
        if filters.get('program_id') and str(filters['program_id']).strip() and str(filters['program_id']).lower() != 'all':
            where_clauses.append(f"ds.program_id = {filters['program_id']}")
        if filters.get('semester_id') and str(filters['semester_id']).strip() and str(filters['semester_id']).lower() != 'all':
            where_clauses.append(f"fg.semester_id = {filters['semester_id']}")
        
        where_clause = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        
        # Join with department and faculty for role-based filtering or when filters are used
        # For SENATE role, we don't need joins unless filters are applied
        join_clause = ""
        needs_join = (role in [Role.HOD, Role.DEAN] or 
                     (filters.get('faculty_id') and str(filters['faculty_id']).strip() and str(filters['faculty_id']).lower() != 'all') or
                     (filters.get('department_id') and str(filters['department_id']).strip() and str(filters['department_id']).lower() != 'all'))
        if needs_join:
            join_clause = """
            LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
            LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
            LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
            """
        
        query = f"""
        SELECT 
            CONCAT('Q', CAST(dt.quarter AS CHAR), ' ', CAST(dt.year AS CHAR)) as period,
            dt.year,
            dt.quarter,
            AVG(CASE WHEN fg.exam_status = 'Completed' THEN fg.grade ELSE NULL END) as avg_grade,
            COUNT(CASE WHEN fg.exam_status = 'Completed' THEN 1 END) as completed_exams,
            COUNT(CASE WHEN fg.exam_status = 'MEX' THEN 1 END) as missed_exams,
            COUNT(CASE WHEN fg.exam_status = 'FEX' THEN 1 END) as failed_exams,
            COUNT(DISTINCT fg.student_id) as total_students,
            COUNT(DISTINCT fg.course_code) as total_courses
        FROM fact_grade fg
        INNER JOIN dim_time dt ON fg.date_key = dt.date_key
        INNER JOIN dim_student ds ON fg.student_id = ds.student_id
        {join_clause}
        {where_clause}
        GROUP BY dt.year, dt.quarter
        HAVING COUNT(CASE WHEN fg.exam_status = 'Completed' THEN 1 END) > 0
        ORDER BY dt.year ASC, dt.quarter ASC
        """
        
        print(f"DEBUG: Executing grades-over-time query for role: {role}")
        print(f"DEBUG: WHERE clause: {where_clause}")
        print(f"DEBUG: JOIN clause present: {bool(join_clause)}")
        
        df = pd.read_sql_query(text(query), engine)
        engine.dispose()
        
        print(f"DEBUG: Query returned {len(df)} rows")
        
        # Calculate pass rate and other metrics
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
            print(f"DEBUG: Returning {len(result['periods'])} periods")
            return jsonify(result)
        else:
            print("DEBUG: No data returned from query")
            return jsonify({
                'periods': [],
                'grades': [],
                'missed_exams': [],
                'failed_exams': [],
                'completed_exams': [],
                'total_students': [],
                'total_courses': [],
                'pass_rate': []
            })
    except Exception as e:
        print(f"Error in get_grades_over_time: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/payment-status', methods=['GET'])
@jwt_required()
def get_payment_status():
    """Get payment status distribution with role-based filtering"""
    try:
        from flask_jwt_extended import get_jwt
        from rbac import Role
        
        claims = get_jwt()
        role_str = claims.get('role', 'student')
        try:
            role = Role(role_str.lower())
        except:
            role = Role.STUDENT
        
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        filters = request.args.to_dict()
        
        # Build WHERE clause based on role
        where_clauses = []
        
        # Role-based scoping
        if role == Role.DEAN and claims.get('faculty_id'):
            where_clauses.append(f"df.faculty_id = {claims['faculty_id']}")
        elif role == Role.HOD and claims.get('department_id'):
            where_clauses.append(f"ddept.department_id = {claims['department_id']}")
        elif role == Role.STUDENT:
            if claims.get('student_id'):
                where_clauses.append(f"fp.student_id = '{claims['student_id']}'")
            elif claims.get('access_number'):
                where_clauses.append(f"ds.access_number = '{claims['access_number']}'")
        
        # Apply user filters
        if filters.get('faculty_id'):
            where_clauses.append(f"df.faculty_id = {filters['faculty_id']}")
        if filters.get('department_id'):
            where_clauses.append(f"ddept.department_id = {filters['department_id']}")
        if filters.get('program_id'):
            where_clauses.append(f"ds.program_id = {filters['program_id']}")
        if filters.get('semester_id'):
            where_clauses.append(f"fp.semester_id = {filters['semester_id']}")
        
        where_clause = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        
        # Join with student, program, department, faculty for role-based filtering
        join_clause = ""
        if role in [Role.DEAN, Role.HOD] or filters.get('faculty_id') or filters.get('department_id') or role == Role.STUDENT:
            join_clause = """
            JOIN dim_student ds ON fp.student_id = ds.student_id
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
        engine.dispose()
        
        return jsonify({
            'statuses': df['status'].tolist(),
            'counts': df['count'].tolist()
        })
    except Exception as e:
        print(f"Error in get_payment_status: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/attendance-by-course', methods=['GET'])
@jwt_required()
def get_attendance_by_course():
    """Get attendance statistics by course"""
    try:
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        
        query = """
        SELECT 
            dc.course_name,
            AVG(fa.total_hours) as avg_hours,
            SUM(fa.days_present) as total_days
        FROM fact_attendance fa
        JOIN dim_course dc ON fa.course_code = dc.course_code
        GROUP BY dc.course_name
        ORDER BY avg_hours DESC
        LIMIT 10
        """
        
        df = pd.read_sql_query(query, engine)
        engine.dispose()
        
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
    """Get grade distribution"""
    try:
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        filters = request.args.to_dict()
        
        # Build WHERE clause based on filters
        where_clauses = []
        if filters.get('faculty_id'):
            where_clauses.append(f"ds.program_id IN (SELECT program_id FROM dim_program WHERE department_id IN (SELECT department_id FROM dim_department WHERE faculty_id = {filters['faculty_id']}))")
        if filters.get('department_id'):
            where_clauses.append(f"ds.program_id IN (SELECT program_id FROM dim_program WHERE department_id = {filters['department_id']})")
        if filters.get('program_id'):
            where_clauses.append(f"ds.program_id = {filters['program_id']}")
        if filters.get('semester_id'):
            where_clauses.append(f"fg.semester_id = {filters['semester_id']}")
        
        where_clause = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        
        query = f"""
        SELECT 
            fg.letter_grade,
            COUNT(*) as count
        FROM fact_grade fg
        JOIN dim_student ds ON fg.student_id = ds.student_id
        {where_clause}
        GROUP BY fg.letter_grade
        ORDER BY 
            CASE fg.letter_grade
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
        
        df = pd.read_sql_query(text(query), engine)
        engine.dispose()
        
        return jsonify({
            'grades': df['letter_grade'].tolist(),
            'counts': df['count'].tolist()
        })
    except Exception as e:
        print(f"Error in get_grade_distribution: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/top-students', methods=['GET'])
@jwt_required()
def get_top_students_filtered():
    """Get top performing students with role-based filtering"""
    try:
        from flask_jwt_extended import get_jwt
        from rbac import Role
        
        claims = get_jwt()
        role_str = claims.get('role', 'student')
        try:
            role = Role(role_str.lower())
        except:
            role = Role.STUDENT
        
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        filters = request.args.to_dict()
        limit = int(filters.get('limit', 10))
        
        # Build WHERE clause based on role
        where_clauses = []
        
        # Role-based scoping
        if role == Role.DEAN and claims.get('faculty_id'):
            where_clauses.append(f"df.faculty_id = {claims['faculty_id']}")
        elif role == Role.HOD and claims.get('department_id'):
            where_clauses.append(f"ddept.department_id = {claims['department_id']}")
        elif role == Role.STAFF:
            # Staff sees top students in their program/class
            if filters.get('program_id'):
                where_clauses.append(f"ds.program_id = {filters['program_id']}")
            # In production, would filter by staff-course mapping
        
        # Apply user filters
        if filters.get('faculty_id'):
            where_clauses.append(f"df.faculty_id = {filters['faculty_id']}")
        if filters.get('department_id'):
            where_clauses.append(f"ddept.department_id = {filters['department_id']}")
        if filters.get('program_id'):
            where_clauses.append(f"ds.program_id = {filters['program_id']}")
        
        where_clause = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        
        # Join with program, department, faculty for role-based filtering
        join_clause = ""
        if role in [Role.DEAN, Role.HOD] or filters.get('faculty_id') or filters.get('department_id'):
            join_clause = """
            LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
            LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
            LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
            """
        
        query = f"""
        SELECT 
            CONCAT(ds.first_name, ' ', ds.last_name) as student_name,
            AVG(CASE WHEN fg.exam_status = 'Completed' THEN fg.grade ELSE NULL END) as avg_grade
        FROM fact_grade fg
        JOIN dim_student ds ON fg.student_id = ds.student_id
        {join_clause}
        {where_clause}
        GROUP BY ds.student_id, ds.first_name, ds.last_name
        HAVING AVG(CASE WHEN fg.exam_status = 'Completed' THEN fg.grade ELSE NULL END) IS NOT NULL
        ORDER BY avg_grade DESC
        LIMIT {limit}
        """
        
        df = pd.read_sql_query(text(query), engine)
        engine.dispose()
        
        return jsonify({
            'students': df['student_name'].tolist(),
            'grades': df['avg_grade'].round(2).tolist()
        })
    except Exception as e:
        print(f"Error in get_top_students_filtered: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/attendance-trends', methods=['GET'])
@jwt_required()
def get_attendance_trends():
    """Get attendance trends over time with role-based filtering"""
    try:
        from flask_jwt_extended import get_jwt
        from rbac import Role
        
        claims = get_jwt()
        role_str = claims.get('role', 'student')
        try:
            role = Role(role_str.lower())
        except:
            role = Role.STUDENT
        
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        filters = request.args.to_dict()
        
        # Build WHERE clause based on role
        where_clauses = []
        
        # Role-based scoping
        if role == Role.STAFF:
            # Staff sees attendance in their courses
            if filters.get('program_id'):
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
        
        # Apply user filters (ignore empty strings and "all" values)
        if filters.get('faculty_id') and str(filters['faculty_id']).strip() and str(filters['faculty_id']).lower() != 'all':
            where_clauses.append(f"df.faculty_id = {filters['faculty_id']}")
        if filters.get('department_id') and str(filters['department_id']).strip() and str(filters['department_id']).lower() != 'all':
            where_clauses.append(f"ddept.department_id = {filters['department_id']}")
        if filters.get('program_id') and str(filters['program_id']).strip() and str(filters['program_id']).lower() != 'all':
            where_clauses.append(f"ds.program_id = {filters['program_id']}")
        
        where_clause = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        
        # Join with student, program, department, faculty for role-based filtering or when filters are used
        # For SENATE role without filters, we only need the student join
        join_clause = ""
        needs_join = (role in [Role.DEAN, Role.HOD, Role.STUDENT] or 
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
            # For SENATE role, we still need student join for basic query
            join_clause = """
            INNER JOIN dim_student ds ON fa.student_id = ds.student_id
            """
        
        query = f"""
        SELECT 
            CONCAT('Q', CAST(dt.quarter AS CHAR), ' ', CAST(dt.year AS CHAR)) as period,
            dt.year,
            dt.quarter,
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
        GROUP BY dt.year, dt.quarter
        HAVING COUNT(DISTINCT fa.student_id) > 0
        ORDER BY dt.year ASC, dt.quarter ASC
        """
        
        print(f"DEBUG: Executing attendance-trends query for role: {role}")
        print(f"DEBUG: WHERE clause: {where_clause}")
        print(f"DEBUG: JOIN clause: {join_clause[:100] if join_clause else 'None'}...")
        
        df = pd.read_sql_query(text(query), engine)
        engine.dispose()
        
        print(f"DEBUG: Query returned {len(df)} rows")
        
        # Calculate attendance rate
        if not df.empty:
            df['attendance_rate'] = (df['avg_days_present'] / 30 * 100).round(2)  # Assuming ~30 days per month
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
            print(f"DEBUG: Returning {len(result['periods'])} periods")
            return jsonify(result)
        else:
            print("DEBUG: No data returned from query")
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
    """Get payment trends over time with role-based filtering - grouped by quarters for longer periods"""
    try:
        from flask_jwt_extended import get_jwt
        from rbac import Role
        
        claims = get_jwt()
        role_str = claims.get('role', 'finance')
        try:
            role = Role(role_str.lower())
        except:
            role = Role.FINANCE
        
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        filters = request.args.to_dict()
        
        # Build WHERE clause based on role
        where_clauses = []
        
        # Role-based scoping - Senate and Finance can see all, others are scoped
        if role == Role.DEAN and claims.get('faculty_id'):
            where_clauses.append(f"df.faculty_id = {claims['faculty_id']}")
        elif role == Role.HOD and claims.get('department_id'):
            where_clauses.append(f"ddept.department_id = {claims['department_id']}")
        elif role == Role.STUDENT:
            if claims.get('student_id'):
                where_clauses.append(f"fp.student_id = '{claims['student_id']}'")
            elif claims.get('access_number'):
                where_clauses.append(f"ds.access_number = '{claims['access_number']}'")
        
        # Apply user filters (ignore empty strings and "all" values)
        if filters.get('faculty_id') and str(filters['faculty_id']).strip() and str(filters['faculty_id']).lower() != 'all':
            where_clauses.append(f"df.faculty_id = {filters['faculty_id']}")
        if filters.get('department_id') and str(filters['department_id']).strip() and str(filters['department_id']).lower() != 'all':
            where_clauses.append(f"ddept.department_id = {filters['department_id']}")
        if filters.get('program_id') and str(filters['program_id']).strip() and str(filters['program_id']).lower() != 'all':
            where_clauses.append(f"ds.program_id = {filters['program_id']}")
        if filters.get('semester_id') and str(filters['semester_id']).strip() and str(filters['semester_id']).lower() != 'all':
            where_clauses.append(f"fp.semester_id = {filters['semester_id']}")
        
        where_clause = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        
        # Join with student, program, department, faculty for role-based filtering or when filters are used
        join_clause = ""
        needs_join = (role in [Role.DEAN, Role.HOD, Role.STUDENT] or 
                     (filters.get('faculty_id') and str(filters['faculty_id']).strip() and str(filters['faculty_id']).lower() != 'all') or
                     (filters.get('department_id') and str(filters['department_id']).strip() and str(filters['department_id']).lower() != 'all'))
        if needs_join:
            join_clause = """
            JOIN dim_student ds ON fp.student_id = ds.student_id
            LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
            LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
            LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
            """
        else:
            # Still need to join with student for basic query
            join_clause = """
            JOIN dim_student ds ON fp.student_id = ds.student_id
            """
        
        query = f"""
        SELECT 
            CONCAT('Q', CAST(dt.quarter AS CHAR), ' ', CAST(dt.year AS CHAR)) as period,
            SUM(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END) as total_amount,
            COUNT(CASE WHEN fp.status = 'Completed' THEN 1 END) as completed_count,
            COUNT(CASE WHEN fp.status = 'Pending' THEN 1 END) as pending_count
        FROM fact_payment fp
        JOIN dim_time dt ON fp.date_key = dt.date_key
        {join_clause}
        {where_clause}
        GROUP BY dt.year, dt.quarter
        ORDER BY dt.year, dt.quarter
        """
        
        df = pd.read_sql_query(text(query), engine)
        engine.dispose()
        
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

@app.route('/api/dashboard/predict-performance', methods=['POST'])
@jwt_required()
def predict_performance():
    """Predict student performance"""
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
    """Get MEX/FEX analysis with reasons"""
    try:
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        
        # Overall statistics
        overall_query = """
        SELECT 
            COUNT(CASE WHEN exam_status = 'MEX' THEN 1 END) as total_mex,
            COUNT(CASE WHEN exam_status = 'FEX' THEN 1 END) as total_fex,
            COUNT(CASE WHEN exam_status = 'Completed' THEN 1 END) as total_completed,
            COUNT(*) as total_exams
        FROM fact_grade
        """
        overall_df = pd.read_sql_query(overall_query, engine)
        
        # Reasons breakdown for MEX
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
        reasons_df = pd.read_sql_query(reasons_query, engine)
        
        # Impact on performance (students with MEX vs without)
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
        performance_df = pd.read_sql_query(performance_query, engine)
        
        engine.dispose()
        
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
    """Generate PDF report"""
    from pdf_generator import PDFReportGenerator
    from flask import send_file
    import os
    
    try:
        # Generate PDF
        generator = PDFReportGenerator(
            api_base_url=f"http://localhost:5000",
            token=request.headers.get('Authorization', '').replace('Bearer ', '')
        )
        
        output_path = generator.generate_report()
        
        # Return PDF file
        if os.path.exists(output_path):
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
        # Fallback: return JSON data
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        
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
        
        engine.dispose()
        
        return jsonify({
            'stats': stats,
            'departments': departments,
            'grades': grades,
            'generated_at': datetime.now().isoformat()
        })

if __name__ == '__main__':
    # ML models are already initialized above
    print("Starting Flask server...")
    print("Backend API: http://localhost:5000")
    print("API Documentation:")
    print("  - Auth: /api/auth/login, /api/auth/profile")
    print("  - Analytics: /api/analytics/fex, /api/analytics/high-school")
    print("  - Predictions: /api/predictions/predict, /api/predictions/scenario")
    print("  - Dashboard: /api/dashboard/stats")
    app.run(debug=True, host='0.0.0.0', port=5000)

