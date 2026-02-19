-- Data Warehouse: UCU_DataWarehouse
-- Star Schema with Dimension and Fact Tables

CREATE DATABASE IF NOT EXISTS UCU_DataWarehouse;
USE UCU_DataWarehouse;

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
    status VARCHAR(50),
    INDEX idx_name (last_name, first_name),
    INDEX idx_email (email),
    INDEX idx_access_number (access_number),
    INDEX idx_reg_no (reg_no),
    INDEX idx_high_school (high_school),
    INDEX idx_program (program_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dimension: Course
CREATE TABLE IF NOT EXISTS dim_course (
    course_code VARCHAR(20) PRIMARY KEY,
    course_name VARCHAR(100),
    credits INT,
    department VARCHAR(50),
    INDEX idx_department (department)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    is_weekend BOOLEAN,
    INDEX idx_date (date),
    INDEX idx_year_month (year, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dimension: Semester
CREATE TABLE IF NOT EXISTS dim_semester (
    semester_id INT PRIMARY KEY,
    semester_name VARCHAR(50),
    academic_year VARCHAR(20),
    INDEX idx_academic_year (academic_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dimension: Faculty
CREATE TABLE IF NOT EXISTS dim_faculty (
    faculty_id INT PRIMARY KEY,
    faculty_name VARCHAR(200),
    dean_name VARCHAR(100),
    INDEX idx_faculty_name (faculty_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dimension: Department
CREATE TABLE IF NOT EXISTS dim_department (
    department_id INT PRIMARY KEY,
    department_name VARCHAR(200),
    faculty_id INT,
    head_of_department VARCHAR(100),
    FOREIGN KEY (faculty_id) REFERENCES dim_faculty(faculty_id) ON DELETE CASCADE,
    INDEX idx_faculty (faculty_id),
    INDEX idx_dept_name (department_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dimension: Program
CREATE TABLE IF NOT EXISTS dim_program (
    program_id INT PRIMARY KEY,
    program_name VARCHAR(200),
    degree_level VARCHAR(50),
    department_id INT,
    duration_years INT,
    FOREIGN KEY (department_id) REFERENCES dim_department(department_id) ON DELETE CASCADE,
    INDEX idx_department (department_id),
    INDEX idx_program_name (program_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    FOREIGN KEY (semester_id) REFERENCES dim_semester(semester_id) ON DELETE CASCADE,
    INDEX idx_student (student_id),
    INDEX idx_course (course_code),
    INDEX idx_date (date_key),
    INDEX idx_semester (semester_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fact: Attendance
CREATE TABLE IF NOT EXISTS fact_attendance (
    attendance_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(20),
    course_code VARCHAR(20),
    date_key VARCHAR(8),
    total_hours DECIMAL(10,2),
    days_present INT,
    FOREIGN KEY (student_id) REFERENCES dim_student(student_id) ON DELETE CASCADE,
    FOREIGN KEY (course_code) REFERENCES dim_course(course_code) ON DELETE CASCADE,
    FOREIGN KEY (date_key) REFERENCES dim_time(date_key) ON DELETE CASCADE,
    INDEX idx_student (student_id),
    INDEX idx_course (course_code),
    INDEX idx_date (date_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fact: Payment
-- Updated to include fees breakdown: tuition (national/international) + functional fees
CREATE TABLE IF NOT EXISTS fact_payment (
    payment_id VARCHAR(20) PRIMARY KEY,
    student_id VARCHAR(20),
    date_key VARCHAR(8),
    semester_id INT,
    year INT,  -- Academic year
    tuition_national DECIMAL(15,2),  -- National student tuition
    tuition_international DECIMAL(15,2),  -- International student tuition
    functional_fees DECIMAL(15,2),  -- Functional fees
    amount DECIMAL(15,2),  -- Total amount (tuition + functional fees)
    payment_method VARCHAR(50),
    status VARCHAR(20),
    student_type VARCHAR(20) DEFAULT 'national',  -- 'national' or 'international'
    payment_timestamp DATETIME,  -- Exact payment timestamp
    semester_start_date DATE,  -- Semester start date for deadline calculation
    deadline_met BOOLEAN DEFAULT FALSE,  -- Whether payment met the deadline
    deadline_type VARCHAR(50),  -- Which deadline: prompt_payment, registration, midterm, full_fees, late_penalty_week1, late_penalty_week2
    weeks_from_deadline DECIMAL(5,2),  -- Weeks from the relevant deadline (negative if before, positive if after)
    late_penalty DECIMAL(15,2) DEFAULT 0,  -- Late penalty amount if applicable
    FOREIGN KEY (student_id) REFERENCES dim_student(student_id) ON DELETE CASCADE,
    FOREIGN KEY (date_key) REFERENCES dim_time(date_key) ON DELETE CASCADE,
    FOREIGN KEY (semester_id) REFERENCES dim_semester(semester_id) ON DELETE CASCADE,
    INDEX idx_student (student_id),
    INDEX idx_date (date_key),
    INDEX idx_semester (semester_id),
    INDEX idx_year (year),
    INDEX idx_status (status),
    INDEX idx_payment_timestamp (payment_timestamp),
    INDEX idx_deadline_met (deadline_met),
    INDEX idx_deadline_type (deadline_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fact: Grade
-- UCU Policy: CW = 60% (Law: 30%), Exam = 40% (Law: 70%), FCW threshold = 35% (Law: 17.5%)
-- grade: Total numeric score (0-100), calculated from coursework_score and exam_score
-- letter_grade: Letter grade (A, B+, B, C, D, F, MEX, FEX, FCW), calculated from grade and exam_status
CREATE TABLE IF NOT EXISTS fact_grade (
    grade_id VARCHAR(20) PRIMARY KEY,
    student_id VARCHAR(20),
    course_code VARCHAR(20),
    date_key VARCHAR(8),
    semester_id INT,
    coursework_score DECIMAL(5,2) NOT NULL,  -- Coursework score (0-100)
    exam_score DECIMAL(5,2),                  -- Exam score (0-100), NULL if MEX
    grade DECIMAL(5,2) NOT NULL,              -- Total numeric score (always present)
    letter_grade VARCHAR(5) NOT NULL,          -- Letter grade (always present, calculated)
    fcw BOOLEAN DEFAULT FALSE,                -- Failed Coursework flag
    exam_status VARCHAR(10),                  -- Completed, MEX, FEX, FCW
    absence_reason VARCHAR(200),
    FOREIGN KEY (student_id) REFERENCES dim_student(student_id) ON DELETE CASCADE,
    FOREIGN KEY (course_code) REFERENCES dim_course(course_code) ON DELETE CASCADE,
    FOREIGN KEY (date_key) REFERENCES dim_time(date_key) ON DELETE CASCADE,
    FOREIGN KEY (semester_id) REFERENCES dim_semester(semester_id) ON DELETE CASCADE,
    INDEX idx_student (student_id),
    INDEX idx_course (course_code),
    INDEX idx_date (date_key),
    INDEX idx_semester (semester_id),
    INDEX idx_grade (grade)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default semester data
INSERT INTO dim_semester (semester_id, semester_name, academic_year) VALUES
(1, 'Fall 2023', '2023-2024'),
(2, 'Spring 2024', '2023-2024'),
(3, 'Fall 2024', '2024-2025'),
(4, 'Spring 2025', '2024-2025')
ON DUPLICATE KEY UPDATE 
    semester_name = VALUES(semester_name),
    academic_year = VALUES(academic_year);

-- Populate time dimension (2023-01-01 to 2025-12-31)
-- This is a simplified version - you may want to use a stored procedure
-- For now, we'll populate it via Python script




