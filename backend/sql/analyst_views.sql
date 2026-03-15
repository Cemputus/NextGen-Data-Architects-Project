-- Phase 2: Analyst-safe views (expose only allowed columns and join logic for role-scoped analytics)
-- Run after create_data_warehouse.sql and ETL load. Safe to run multiple times (CREATE OR REPLACE).

-- Grades with student and program/department/faculty for scoped dashboards (HOD/Dean/Analyst)
CREATE OR REPLACE VIEW view_analyst_grade AS
SELECT
    g.grade_id,
    g.student_id,
    s.reg_no,
    s.access_number,
    s.first_name,
    s.last_name,
    s.program_id,
    p.program_name,
    p.department_id,
    d.department_name,
    d.faculty_id,
    f.faculty_name,
    g.course_code,
    c.course_name,
    g.semester_id,
    sem.semester_name,
    sem.academic_year,
    g.date_key,
    g.coursework_score,
    g.exam_score,
    g.grade,
    g.letter_grade,
    g.grade_points,
    g.fcw,
    g.exam_status,
    g.absence_reason
FROM fact_grade g
JOIN dim_student s ON s.student_id = g.student_id
LEFT JOIN dim_program p ON p.program_id = s.program_id
LEFT JOIN dim_department d ON d.department_id = p.department_id
LEFT JOIN dim_faculty f ON f.faculty_id = d.faculty_id
LEFT JOIN dim_course c ON c.course_code = g.course_code
LEFT JOIN dim_semester sem ON sem.semester_id = g.semester_id;

COMMENT ON VIEW view_analyst_grade IS 'Analyst-safe: grades joined to student, program, department, faculty, semester. Use WHERE faculty_id/department_id/program_id/student_id for scope.';

-- FCW/MEX/FEX summary by semester and academic year (for risk dashboards)
CREATE OR REPLACE VIEW view_fcw_mex_fex_summary AS
SELECT
    g.semester_id,
    sem.semester_name,
    sem.academic_year,
    g.exam_status,
    COUNT(*) AS record_count,
    COUNT(DISTINCT g.student_id) AS student_count
FROM fact_grade g
LEFT JOIN dim_semester sem ON sem.semester_id = g.semester_id
WHERE g.exam_status IN ('FCW', 'MEX', 'FEX', 'Completed')
GROUP BY g.semester_id, sem.semester_name, sem.academic_year, g.exam_status;

COMMENT ON VIEW view_fcw_mex_fex_summary IS 'Phase 2: Counts of FCW/MEX/FEX/Completed by semester for risk analytics.';

-- Same summary by faculty (via student -> program -> department -> faculty)
CREATE OR REPLACE VIEW view_fcw_mex_fex_by_faculty AS
SELECT
    d.faculty_id,
    f.faculty_name,
    g.semester_id,
    sem.semester_name,
    sem.academic_year,
    g.exam_status,
    COUNT(*) AS record_count,
    COUNT(DISTINCT g.student_id) AS student_count
FROM fact_grade g
JOIN dim_student s ON s.student_id = g.student_id
LEFT JOIN dim_program p ON p.program_id = s.program_id
LEFT JOIN dim_department d ON d.department_id = p.department_id
LEFT JOIN dim_faculty f ON f.faculty_id = d.faculty_id
LEFT JOIN dim_semester sem ON sem.semester_id = g.semester_id
WHERE g.exam_status IN ('FCW', 'MEX', 'FEX', 'Completed')
GROUP BY d.faculty_id, f.faculty_name, g.semester_id, sem.semester_name, sem.academic_year, g.exam_status;

COMMENT ON VIEW view_fcw_mex_fex_by_faculty IS 'Phase 2: FCW/MEX/FEX counts by faculty and semester for Dean/Analyst dashboards.';
