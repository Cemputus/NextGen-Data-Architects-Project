-- Academic performance summary view
CREATE OR REPLACE VIEW v_academic_summary AS
SELECT ds.student_id, ds.program_id, dd.department_name, df.faculty_name,
       fg.coursework_score, fg.exam_score, fg.grade, fg.letter_grade,
       fg.fcw, fg.exam_status,
       dp.program_name
FROM fact_grade fg
JOIN dim_student ds ON fg.student_id = ds.student_id
JOIN dim_program dp ON ds.program_id = dp.program_id
JOIN dim_department dd ON dp.department_id = dd.department_id
JOIN dim_faculty df ON dd.faculty_id = df.faculty_id;

-- FCW/MEX/FEX summary by student
CREATE OR REPLACE VIEW v_student_risk_summary AS
SELECT student_id,
       SUM(CASE WHEN fcw THEN 1 ELSE 0 END) AS fcw_count,
       SUM(CASE WHEN exam_status = 'MEX' THEN 1 ELSE 0 END) AS mex_count,
       SUM(CASE WHEN exam_status = 'FEX' THEN 1 ELSE 0 END) AS fex_count,
       COUNT(*) AS total_courses,
       AVG(grade) AS avg_grade
FROM fact_grade
GROUP BY student_id;

-- High school risk correlation view
CREATE OR REPLACE VIEW v_highschool_risk AS
SELECT ds.high_school, ds.high_school_district,
       AVG(CASE WHEN fg.fcw THEN 1.0 ELSE 0.0 END) AS fcw_rate,
       AVG(CASE WHEN fg.exam_status = 'MEX' THEN 1.0 ELSE 0.0 END) AS mex_rate,
       AVG(CASE WHEN fg.exam_status = 'FEX' THEN 1.0 ELSE 0.0 END) AS fex_rate,
       AVG(fg.grade) AS avg_grade
FROM fact_grade fg
JOIN dim_student ds ON fg.student_id = ds.student_id
WHERE ds.high_school IS NOT NULL AND ds.high_school != ''
GROUP BY ds.high_school, ds.high_school_district;
