-- Data Warehouse: ucu_datawarehouse
-- Star Schema with Dimension and Fact Tables
-- PostgreSQL version

-- Dimension: Student
CREATE TABLE IF NOT EXISTS dim_student (
    student_id VARCHAR(20) PRIMARY KEY,
    reg_no VARCHAR(50),
    access_number VARCHAR(10) UNIQUE,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    email VARCHAR(100),
    gender CHAR(1),
    nationality VARCHAR(50),
    admission_date DATE,
    high_school VARCHAR(200),
    high_school_district VARCHAR(100),
    program_id INT,
    year_of_study INT,
    status VARCHAR(50)
);
CREATE INDEX IF NOT EXISTS idx_dim_student_name ON dim_student(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_dim_student_email ON dim_student(email);
CREATE INDEX IF NOT EXISTS idx_dim_student_access_number ON dim_student(access_number);
CREATE INDEX IF NOT EXISTS idx_dim_student_reg_no ON dim_student(reg_no);
CREATE INDEX IF NOT EXISTS idx_dim_student_high_school ON dim_student(high_school);
CREATE INDEX IF NOT EXISTS idx_dim_student_program ON dim_student(program_id);
CREATE INDEX IF NOT EXISTS idx_dim_student_status ON dim_student(status);

-- Dimension: Course
CREATE TABLE IF NOT EXISTS dim_course (
    course_code VARCHAR(20) PRIMARY KEY,
    course_name VARCHAR(100),
    credits INT,
    department VARCHAR(50)
);
CREATE INDEX IF NOT EXISTS idx_dim_course_department ON dim_course(department);

-- Dimension: Time
CREATE TABLE IF NOT EXISTS dim_time (
    date_key VARCHAR(8) PRIMARY KEY,
    date DATE,
    year INT,
    quarter INT,
    month INT,
    month_name VARCHAR(20),
    day INT,
    day_of_week INT,
    day_name VARCHAR(20),
    is_weekend BOOLEAN
);
CREATE INDEX IF NOT EXISTS idx_dim_time_date ON dim_time(date);
CREATE INDEX IF NOT EXISTS idx_dim_time_year_month ON dim_time(year, month);

-- Dimension: Semester
CREATE TABLE IF NOT EXISTS dim_semester (
    semester_id INT PRIMARY KEY,
    semester_name VARCHAR(50),
    academic_year VARCHAR(20)
);
CREATE INDEX IF NOT EXISTS idx_dim_semester_academic_year ON dim_semester(academic_year);

-- Dimension: Faculty
CREATE TABLE IF NOT EXISTS dim_faculty (
    faculty_id INT PRIMARY KEY,
    faculty_name VARCHAR(200),
    dean_name VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS idx_dim_faculty_name ON dim_faculty(faculty_name);

-- Dimension: Department
CREATE TABLE IF NOT EXISTS dim_department (
    department_id INT PRIMARY KEY,
    department_name VARCHAR(200),
    faculty_id INT,
    head_of_department VARCHAR(100),
    FOREIGN KEY (faculty_id) REFERENCES dim_faculty(faculty_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_dim_department_faculty ON dim_department(faculty_id);
CREATE INDEX IF NOT EXISTS idx_dim_department_name ON dim_department(department_name);

-- Dimension: Program
CREATE TABLE IF NOT EXISTS dim_program (
    program_id INT PRIMARY KEY,
    program_name VARCHAR(200),
    degree_level VARCHAR(50),
    department_id INT,
    duration_years INT,
    FOREIGN KEY (department_id) REFERENCES dim_department(department_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_dim_program_department ON dim_program(department_id);
CREATE INDEX IF NOT EXISTS idx_dim_program_name ON dim_program(program_name);

-- Fact: Enrollment
CREATE TABLE IF NOT EXISTS fact_enrollment (
    enrollment_id VARCHAR(20) PRIMARY KEY,
    student_id VARCHAR(20),
    course_code VARCHAR(20),
    date_key VARCHAR(8),
    semester_id INT,
    status VARCHAR(20),
    FOREIGN KEY (student_id) REFERENCES dim_student(student_id) ON DELETE CASCADE,
    FOREIGN KEY (course_code) REFERENCES dim_course(course_code) ON DELETE CASCADE,
    FOREIGN KEY (date_key) REFERENCES dim_time(date_key) ON DELETE CASCADE,
    FOREIGN KEY (semester_id) REFERENCES dim_semester(semester_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fact_enrollment_student ON fact_enrollment(student_id);
CREATE INDEX IF NOT EXISTS idx_fact_enrollment_course ON fact_enrollment(course_code);
CREATE INDEX IF NOT EXISTS idx_fact_enrollment_date ON fact_enrollment(date_key);
CREATE INDEX IF NOT EXISTS idx_fact_enrollment_semester ON fact_enrollment(semester_id);

-- Fact: Attendance
CREATE TABLE IF NOT EXISTS fact_attendance (
    attendance_id SERIAL PRIMARY KEY,
    student_id VARCHAR(20),
    course_code VARCHAR(20),
    date_key VARCHAR(8),
    total_hours DECIMAL(10,2),
    days_present INT,
    FOREIGN KEY (student_id) REFERENCES dim_student(student_id) ON DELETE CASCADE,
    FOREIGN KEY (course_code) REFERENCES dim_course(course_code) ON DELETE CASCADE,
    FOREIGN KEY (date_key) REFERENCES dim_time(date_key) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fact_attendance_student ON fact_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_fact_attendance_course ON fact_attendance(course_code);
CREATE INDEX IF NOT EXISTS idx_fact_attendance_date ON fact_attendance(date_key);

-- Fact: Payment
CREATE TABLE IF NOT EXISTS fact_payment (
    payment_id VARCHAR(20) PRIMARY KEY,
    student_id VARCHAR(20),
    date_key VARCHAR(8),
    semester_id INT,
    year INT,
    tuition_national DECIMAL(15,2),
    tuition_international DECIMAL(15,2),
    functional_fees DECIMAL(15,2),
    amount DECIMAL(15,2),
    payment_method VARCHAR(50),
    status VARCHAR(20),
    student_type VARCHAR(20) DEFAULT 'national',
    payment_timestamp TIMESTAMP,
    semester_start_date DATE,
    deadline_met BOOLEAN DEFAULT FALSE,
    deadline_type VARCHAR(50),
    weeks_from_deadline DECIMAL(5,2),
    late_penalty DECIMAL(15,2) DEFAULT 0,
    FOREIGN KEY (student_id) REFERENCES dim_student(student_id) ON DELETE CASCADE,
    FOREIGN KEY (date_key) REFERENCES dim_time(date_key) ON DELETE CASCADE,
    FOREIGN KEY (semester_id) REFERENCES dim_semester(semester_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fact_payment_student ON fact_payment(student_id);
CREATE INDEX IF NOT EXISTS idx_fact_payment_date ON fact_payment(date_key);
CREATE INDEX IF NOT EXISTS idx_fact_payment_semester ON fact_payment(semester_id);
CREATE INDEX IF NOT EXISTS idx_fact_payment_year ON fact_payment(year);
CREATE INDEX IF NOT EXISTS idx_fact_payment_status ON fact_payment(status);
CREATE INDEX IF NOT EXISTS idx_fact_payment_timestamp ON fact_payment(payment_timestamp);
CREATE INDEX IF NOT EXISTS idx_fact_payment_deadline_met ON fact_payment(deadline_met);
CREATE INDEX IF NOT EXISTS idx_fact_payment_deadline_type ON fact_payment(deadline_type);

-- Fact: Grade
CREATE TABLE IF NOT EXISTS fact_grade (
    grade_id VARCHAR(20) PRIMARY KEY,
    student_id VARCHAR(20),
    course_code VARCHAR(20),
    date_key VARCHAR(8),
    semester_id INT,
    coursework_score DECIMAL(5,2) NOT NULL,
    exam_score DECIMAL(5,2),
    grade DECIMAL(5,2) NOT NULL,
    letter_grade VARCHAR(5) NOT NULL,
    fcw BOOLEAN DEFAULT FALSE,
    exam_status VARCHAR(10),
    absence_reason VARCHAR(200),
    FOREIGN KEY (student_id) REFERENCES dim_student(student_id) ON DELETE CASCADE,
    FOREIGN KEY (course_code) REFERENCES dim_course(course_code) ON DELETE CASCADE,
    FOREIGN KEY (date_key) REFERENCES dim_time(date_key) ON DELETE CASCADE,
    FOREIGN KEY (semester_id) REFERENCES dim_semester(semester_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fact_grade_student ON fact_grade(student_id);
CREATE INDEX IF NOT EXISTS idx_fact_grade_course ON fact_grade(course_code);
CREATE INDEX IF NOT EXISTS idx_fact_grade_date ON fact_grade(date_key);
CREATE INDEX IF NOT EXISTS idx_fact_grade_semester ON fact_grade(semester_id);
CREATE INDEX IF NOT EXISTS idx_fact_grade_grade ON fact_grade(grade);

-- Insert default semester data
INSERT INTO dim_semester (semester_id, semester_name, academic_year) VALUES
(1, 'Fall 2023', '2023-2024'),
(2, 'Spring 2024', '2023-2024'),
(3, 'Fall 2024', '2024-2025'),
(4, 'Spring 2025', '2024-2025')
ON CONFLICT (semester_id) DO UPDATE SET
    semester_name = EXCLUDED.semester_name,
    academic_year = EXCLUDED.academic_year;
