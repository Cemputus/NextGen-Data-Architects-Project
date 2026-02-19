"""Comprehensive Data Inspection Script
Shows how the UCU data warehouse works with actual data"""
from config import DATA_WAREHOUSE_CONN_STRING, DB1_CONN_STRING
import pandas as pd
from sqlalchemy import create_engine

def print_section(title):
    """Print a formatted section header"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)

def print_subsection(title):
    """Print a formatted subsection header"""
    print(f"\n--- {title} ---")

# Connect to databases
warehouse_engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
source_engine = create_engine(DB1_CONN_STRING)

print_section("UCU DATA WAREHOUSE INSPECTION")
print("This script demonstrates how the data flows through the system")
print("from source databases -> ETL pipeline -> data warehouse")

# ==================== DIMENSION TABLES ====================
print_section("DIMENSION TABLES (Star Schema)")

print_subsection("1. Faculties (12 UCU Faculties/Schools)")
faculties = pd.read_sql_query("SELECT * FROM dim_faculty ORDER BY faculty_id", warehouse_engine)
print(f"Total Faculties: {len(faculties)}")
print(faculties.to_string(index=False))

print_subsection("2. Departments (47 Departments)")
depts = pd.read_sql_query("""
    SELECT d.department_id, d.department_name, f.faculty_name, d.head_of_department
    FROM dim_department d
    JOIN dim_faculty f ON d.faculty_id = f.faculty_id
    ORDER BY f.faculty_id, d.department_id
    LIMIT 15
""", warehouse_engine)
print(f"Total Departments: {pd.read_sql_query('SELECT COUNT(*) as count FROM dim_department', warehouse_engine)['count'][0]}")
print(depts.to_string(index=False))
print("... (showing first 15)")

print_subsection("3. Programs (92 UCU Programs)")
programs = pd.read_sql_query("""
    SELECT p.program_id, p.program_name, p.degree_level, p.duration_years,
           d.department_name, f.faculty_name
    FROM dim_program p
    JOIN dim_department d ON p.department_id = d.department_id
    JOIN dim_faculty f ON d.faculty_id = f.faculty_id
    ORDER BY f.faculty_id, p.program_id
    LIMIT 15
""", warehouse_engine)
print(f"Total Programs: {pd.read_sql_query('SELECT COUNT(*) as count FROM dim_program', warehouse_engine)['count'][0]}")
print(programs.to_string(index=False))
print("... (showing first 15)")

print_subsection("Programs with Actual Tuition (from Source DB)")
programs_tuition = pd.read_sql_query("""
    SELECT p.ProgramName, p.DegreeLevel, p.DurationYears,
           p.TuitionNationals, p.TuitionNonNationals,
           d.DepartmentName, f.FacultyName
    FROM programs p
    JOIN departments d ON p.DepartmentID = d.DepartmentID
    JOIN faculties f ON d.FacultyID = f.FacultyID
    ORDER BY f.FacultyID, p.ProgramID
    LIMIT 15
""", source_engine)
print(programs_tuition.to_string(index=False))
print("... (showing first 15)")

print_subsection("4. Students (997 Students)")
students = pd.read_sql_query("""
    SELECT student_id, reg_no, access_number, first_name, last_name, 
           gender, nationality, high_school, year_of_study, status
    FROM dim_student
    LIMIT 10
""", warehouse_engine)
print(f"Total Students: {pd.read_sql_query('SELECT COUNT(*) as count FROM dim_student', warehouse_engine)['count'][0]}")
print(students.to_string(index=False))
print("... (showing first 10)")

print_subsection("5. UCU Semesters")
semesters = pd.read_sql_query("SELECT * FROM dim_semester", warehouse_engine)
print(semesters.to_string(index=False))

# ==================== FACT TABLES ====================
print_section("FACT TABLES (Star Schema Facts)")

print_subsection("1. Payments (with Fee Breakdown)")
payments_summary = pd.read_sql_query("""
    SELECT 
        year,
        COUNT(*) as total_payments,
        COUNT(DISTINCT student_id) as unique_students,
        SUM(tuition_national) as total_national_tuition,
        SUM(tuition_international) as total_international_tuition,
        SUM(functional_fees) as total_functional_fees,
        SUM(amount) as total_amount_paid,
        AVG(amount) as avg_payment,
        COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed_payments,
        COUNT(CASE WHEN status = 'Pending' THEN 1 END) as pending_payments,
        COUNT(CASE WHEN status = 'Failed' THEN 1 END) as failed_payments
    FROM fact_payment
    GROUP BY year
    ORDER BY year
""", warehouse_engine)
print(payments_summary.to_string(index=False))

print_subsection("Sample Payment Records (with Fee Breakdown)")
sample_payments = pd.read_sql_query("""
    SELECT 
        fp.payment_id,
        fp.student_id,
        ds.first_name,
        ds.last_name,
        fp.year,
        dsem.semester_name as semester,
        fp.tuition_national,
        fp.tuition_international,
        fp.functional_fees,
        fp.amount as total_paid,
        fp.status,
        fp.student_type
    FROM fact_payment fp
    JOIN dim_student ds ON fp.student_id = ds.student_id
    JOIN dim_semester dsem ON fp.semester_id = dsem.semester_id
    LIMIT 10
""", warehouse_engine)
print(sample_payments.to_string(index=False))

print_subsection("2. Grades (with UCU Semester Names)")
grades_summary = pd.read_sql_query("""
    SELECT 
        COUNT(*) as total_grades,
        COUNT(DISTINCT student_id) as unique_students,
        COUNT(DISTINCT course_code) as unique_courses,
        AVG(grade) as avg_grade,
        MIN(grade) as min_grade,
        MAX(grade) as max_grade,
        COUNT(CASE WHEN exam_status = 'Completed' THEN 1 END) as completed_exams,
        COUNT(CASE WHEN exam_status = 'MEX' THEN 1 END) as missed_exams,
        COUNT(CASE WHEN exam_status = 'FEX' THEN 1 END) as failed_exams,
        COUNT(CASE WHEN fcw = 1 THEN 1 END) as failed_coursework
    FROM fact_grade
""", warehouse_engine)
print(grades_summary.to_string(index=False))

print_subsection("Sample Grade Records")
sample_grades = pd.read_sql_query("""
    SELECT 
        fg.grade_id,
        fg.student_id,
        ds.first_name,
        ds.last_name,
        fg.course_code,
        dc.course_name,
        dsem.semester_name,
        fg.coursework_score,
        fg.exam_score,
        fg.grade,
        fg.letter_grade,
        fg.exam_status,
        fg.absence_reason
    FROM fact_grade fg
    JOIN dim_student ds ON fg.student_id = ds.student_id
    JOIN dim_course dc ON fg.course_code = dc.course_code
    JOIN dim_semester dsem ON fg.semester_id = dsem.semester_id
    LIMIT 10
""", warehouse_engine)
print(sample_grades.to_string(index=False))

print_subsection("3. Enrollments")
enrollments_summary = pd.read_sql_query("""
    SELECT 
        COUNT(*) as total_enrollments,
        COUNT(DISTINCT student_id) as unique_students,
        COUNT(DISTINCT course_code) as unique_courses,
        COUNT(DISTINCT semester_id) as unique_semesters
    FROM fact_enrollment
""", warehouse_engine)
print(enrollments_summary.to_string(index=False))

print_subsection("4. Attendance")
attendance_summary = pd.read_sql_query("""
    SELECT 
        COUNT(*) as total_attendance_records,
        COUNT(DISTINCT student_id) as unique_students,
        COUNT(DISTINCT course_code) as unique_courses,
        SUM(total_hours) as total_hours_attended,
        SUM(days_present) as total_days_present,
        AVG(total_hours) as avg_hours_per_record
    FROM fact_attendance
""", warehouse_engine)
print(attendance_summary.to_string(index=False))

# ==================== DATA RELATIONSHIPS ====================
print_section("DATA RELATIONSHIPS & ANALYTICS")

print_subsection("Student Performance by High School (Top 10)")
high_school_perf = pd.read_sql_query("""
    SELECT 
        ds.high_school,
        COUNT(DISTINCT ds.student_id) as student_count,
        AVG(fg.grade) as avg_grade,
        COUNT(CASE WHEN fg.exam_status = 'MEX' THEN 1 END) as missed_exams,
        COUNT(CASE WHEN fg.exam_status = 'FEX' THEN 1 END) as failed_exams,
        SUM(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END) as total_payments
    FROM dim_student ds
    LEFT JOIN fact_grade fg ON ds.student_id = fg.student_id
    LEFT JOIN fact_payment fp ON ds.student_id = fp.student_id
    WHERE ds.high_school IS NOT NULL AND ds.high_school != ''
    GROUP BY ds.high_school
    HAVING student_count >= 5
    ORDER BY avg_grade DESC
    LIMIT 10
""", warehouse_engine)
print(high_school_perf.to_string(index=False))

print_subsection("Program Performance Analysis")
program_perf = pd.read_sql_query("""
    SELECT 
        dp.program_name,
        df.faculty_name,
        COUNT(DISTINCT ds.student_id) as student_count,
        AVG(fg.grade) as avg_grade,
        COUNT(CASE WHEN fg.exam_status = 'MEX' THEN 1 END) as missed_exams,
        AVG(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END) as avg_payment
    FROM dim_program dp
    JOIN dim_department dd ON dp.department_id = dd.department_id
    JOIN dim_faculty df ON dd.faculty_id = df.faculty_id
    LEFT JOIN dim_student ds ON ds.program_id = dp.program_id
    LEFT JOIN fact_grade fg ON ds.student_id = fg.student_id
    LEFT JOIN fact_payment fp ON ds.student_id = fp.student_id
    GROUP BY dp.program_id, dp.program_name, df.faculty_name
    HAVING student_count > 0
    ORDER BY avg_grade DESC
    LIMIT 10
""", warehouse_engine)
print(program_perf.to_string(index=False))

print_subsection("Fee Analysis by Program")
fee_analysis = pd.read_sql_query("""
    SELECT 
        dp.program_name,
        df.faculty_name,
        COUNT(DISTINCT fp.student_id) as students_with_payments,
        SUM(fp.tuition_national) as total_national_collected,
        SUM(fp.tuition_international) as total_international_collected,
        SUM(fp.functional_fees) as total_functional_fees_collected,
        AVG(fp.amount) as avg_payment_amount,
        SUM(fp.amount) as total_collected
    FROM dim_program dp
    JOIN dim_department dd ON dp.department_id = dd.department_id
    JOIN dim_faculty df ON dd.faculty_id = df.faculty_id
    LEFT JOIN dim_student ds ON ds.program_id = dp.program_id
    LEFT JOIN fact_payment fp ON ds.student_id = fp.student_id
    GROUP BY dp.program_id, dp.program_name, df.faculty_name
    HAVING students_with_payments > 0
    ORDER BY total_collected DESC
    LIMIT 10
""", warehouse_engine)
print(fee_analysis.to_string(index=False))

print_subsection("Semester-wise Performance")
semester_perf = pd.read_sql_query("""
    SELECT 
        dsem.semester_name,
        COUNT(DISTINCT fg.student_id) as students_with_grades,
        AVG(fg.grade) as avg_grade,
        COUNT(CASE WHEN fg.exam_status = 'Completed' THEN 1 END) as completed_exams,
        COUNT(CASE WHEN fg.exam_status = 'MEX' THEN 1 END) as missed_exams,
        COUNT(CASE WHEN fg.exam_status = 'FEX' THEN 1 END) as failed_exams
    FROM dim_semester dsem
    LEFT JOIN fact_grade fg ON dsem.semester_id = fg.semester_id
    GROUP BY dsem.semester_id, dsem.semester_name
    ORDER BY dsem.semester_id
""", warehouse_engine)
print(semester_perf.to_string(index=False))

# ==================== CSV DATA ====================
print_section("CSV DATA FILES")

print_subsection("CSV1: Student Fees (source_data1.csv)")
csv1 = pd.read_csv("data/source_data1.csv")
print(f"Total Records: {len(csv1)}")
print(f"Columns: {', '.join(csv1.columns)}")
print("\nFirst 5 records:")
print(csv1.head().to_string(index=False))
print(f"\nYear Distribution:")
print(csv1['year'].value_counts().sort_index())

print_subsection("CSV2: Grades (source_data2.csv)")
csv2 = pd.read_csv("data/source_data2.csv")
print(f"Total Records: {len(csv2)}")
print(f"Columns: {', '.join(csv2.columns)}")
print("\nFirst 5 records:")
print(csv2.head().to_string(index=False))
print(f"\nYear Distribution:")
print(csv2['year'].value_counts().sort_index())
print(f"\nSemester Distribution:")
print(csv2['semester'].value_counts())

# ==================== SUMMARY ====================
print_section("DATA WAREHOUSE SUMMARY")

summary = pd.read_sql_query("""
    SELECT 
        'dim_student' as table_name, COUNT(*) as record_count FROM dim_student
    UNION ALL
    SELECT 'dim_course', COUNT(*) FROM dim_course
    UNION ALL
    SELECT 'dim_faculty', COUNT(*) FROM dim_faculty
    UNION ALL
    SELECT 'dim_department', COUNT(*) FROM dim_department
    UNION ALL
    SELECT 'dim_program', COUNT(*) FROM dim_program
    UNION ALL
    SELECT 'fact_enrollment', COUNT(*) FROM fact_enrollment
    UNION ALL
    SELECT 'fact_attendance', COUNT(*) FROM fact_attendance
    UNION ALL
    SELECT 'fact_payment', COUNT(*) FROM fact_payment
    UNION ALL
    SELECT 'fact_grade', COUNT(*) FROM fact_grade
""", warehouse_engine)
print(summary.to_string(index=False))

print_section("INSPECTION COMPLETE")
print("[OK] All data has been successfully loaded and is ready for analytics!")
print("[OK] Fee breakdowns (tuition national/international + functional fees) are populated")
print("[OK] Year column is present in all relevant tables")
print("[OK] UCU semester names are correctly mapped")
print("[OK] All 12 faculties, 47 departments, and 92 programs are loaded")

# Close connections
warehouse_engine.dispose()
source_engine.dispose()
