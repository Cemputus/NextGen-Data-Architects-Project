-- Source Database 1: UCU_SourceDB1 (ACADEMICS DATABASE)
-- Contains: Faculties, Departments, Programs, Courses, Lecturers, Students, Enrollments, Grades, Attendance, Student Fees

CREATE DATABASE IF NOT EXISTS UCU_SourceDB1;
USE UCU_SourceDB1;

-- Faculties Table
CREATE TABLE IF NOT EXISTS faculties (
    FacultyID INT PRIMARY KEY AUTO_INCREMENT,
    FacultyName VARCHAR(200),
    DeanName VARCHAR(100),
    INDEX idx_faculty_name (FacultyName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Departments Table
CREATE TABLE IF NOT EXISTS departments (
    DepartmentID INT PRIMARY KEY AUTO_INCREMENT,
    DepartmentName VARCHAR(200),
    FacultyID INT,
    HeadOfDepartment VARCHAR(100),
    FOREIGN KEY (FacultyID) REFERENCES faculties(FacultyID) ON DELETE CASCADE,
    INDEX idx_faculty (FacultyID),
    INDEX idx_dept_name (DepartmentName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Programs Table
CREATE TABLE IF NOT EXISTS programs (
    ProgramID INT PRIMARY KEY AUTO_INCREMENT,
    ProgramName VARCHAR(200),
    DegreeLevel VARCHAR(50),
    DepartmentID INT,
    DurationYears INT,
    TuitionNationals DECIMAL(15,2),  -- Tuition for national students (per semester)
    TuitionNonNationals DECIMAL(15,2),  -- Tuition for non-national students (per semester)
    FOREIGN KEY (DepartmentID) REFERENCES departments(DepartmentID) ON DELETE CASCADE,
    INDEX idx_department (DepartmentID),
    INDEX idx_program_name (ProgramName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Courses Table
CREATE TABLE IF NOT EXISTS courses (
    CourseID INT PRIMARY KEY AUTO_INCREMENT,
    CourseCode VARCHAR(20),
    CourseName VARCHAR(200),
    ProgramID INT,
    CreditUnits INT,
    FOREIGN KEY (ProgramID) REFERENCES programs(ProgramID) ON DELETE CASCADE,
    INDEX idx_program (ProgramID),
    INDEX idx_course_code (CourseCode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lecturers Table
CREATE TABLE IF NOT EXISTS lecturers (
    LecturerID INT PRIMARY KEY AUTO_INCREMENT,
    StaffNumber VARCHAR(50),
    FullName VARCHAR(100),
    DepartmentID INT,
    Rank VARCHAR(100),
    FOREIGN KEY (DepartmentID) REFERENCES departments(DepartmentID) ON DELETE CASCADE,
    INDEX idx_department (DepartmentID),
    INDEX idx_staff_number (StaffNumber)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Students Table
CREATE TABLE IF NOT EXISTS students (
    StudentID INT PRIMARY KEY AUTO_INCREMENT,
    RegNo VARCHAR(50),
    AccessNumber VARCHAR(10) UNIQUE NOT NULL,  -- Format: A##### or B#####
    FullName VARCHAR(100),
    ProgramID INT,
    YearOfStudy INT,
    Status VARCHAR(50),
    HighSchool VARCHAR(200),  -- High school name
    HighSchoolDistrict VARCHAR(100),  -- District where high school is located
    INDEX idx_reg_no (RegNo),
    INDEX idx_access_number (AccessNumber),
    INDEX idx_program (ProgramID),
    INDEX idx_status (Status),
    INDEX idx_high_school (HighSchool),
    FOREIGN KEY (ProgramID) REFERENCES programs(ProgramID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Enrollments Table
CREATE TABLE IF NOT EXISTS enrollments (
    EnrollmentID INT PRIMARY KEY AUTO_INCREMENT,
    StudentID INT,
    CourseID INT,
    AcademicYear VARCHAR(20),
    Semester VARCHAR(20),
    HighSchool VARCHAR(200),  -- High school at time of enrollment (for tracking)
    FOREIGN KEY (StudentID) REFERENCES students(StudentID) ON DELETE CASCADE,
    FOREIGN KEY (CourseID) REFERENCES courses(CourseID) ON DELETE CASCADE,
    INDEX idx_student (StudentID),
    INDEX idx_course (CourseID),
    INDEX idx_academic_year (AcademicYear),
    INDEX idx_high_school (HighSchool)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Grades Table
-- UCU Policy:
--   Most programs: CW = 60%, Exam = 40%, FCW threshold = 35%
--   Law program: CW = 30%, Exam = 70%, FCW threshold = 17.5%
-- TotalScore: Final numeric score (0-100), calculated from CourseworkScore and ExamScore
-- GradeLetter: Letter grade (A, B+, B, C, D, F, MEX, FEX, FCW), calculated from TotalScore and ExamStatus
CREATE TABLE IF NOT EXISTS grades (
    GradeID INT PRIMARY KEY AUTO_INCREMENT,
    StudentID INT,
    CourseID INT,
    CourseworkScore DECIMAL(5,2) NOT NULL,  -- Coursework score (0-100)
    ExamScore DECIMAL(5,2),                  -- Exam score (0-100), NULL if MEX
    TotalScore DECIMAL(5,2) NOT NULL,        -- Final score (calculated: CW% + Exam%)
    GradeLetter VARCHAR(5) NOT NULL,         -- Letter grade (always present, calculated)
    FCW BOOLEAN DEFAULT FALSE,               -- Failed Coursework (true if CW below threshold)
    ExamStatus VARCHAR(10),                  -- Completed, MEX, FEX, FCW
    AbsenceReason VARCHAR(200),
    FOREIGN KEY (StudentID) REFERENCES students(StudentID) ON DELETE CASCADE,
    FOREIGN KEY (CourseID) REFERENCES courses(CourseID) ON DELETE CASCADE,
    INDEX idx_student (StudentID),
    INDEX idx_course (CourseID),
    INDEX idx_grade (GradeLetter),
    INDEX idx_exam_status (ExamStatus)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
    AttendanceID INT PRIMARY KEY AUTO_INCREMENT,
    StudentID INT,
    CourseID INT,
    Date DATE,
    Status VARCHAR(20),
    FOREIGN KEY (StudentID) REFERENCES students(StudentID) ON DELETE CASCADE,
    FOREIGN KEY (CourseID) REFERENCES courses(CourseID) ON DELETE CASCADE,
    INDEX idx_student (StudentID),
    INDEX idx_course (CourseID),
    INDEX idx_date (Date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Student Fees Table
-- Updated to include fees breakdown: tuition (national/international) + functional fees
-- Added payment tracking with timestamps and deadline compliance
CREATE TABLE IF NOT EXISTS student_fees (
    PaymentID INT PRIMARY KEY AUTO_INCREMENT,
    StudentID INT,
    Year INT,  -- Academic year
    Semester VARCHAR(50),  -- UCU semester: Jan (Easter), May (Trinity), September (Advent)
    TuitionNational DECIMAL(15,2),  -- National student tuition
    TuitionInternational DECIMAL(15,2),  -- International student tuition
    FunctionalFees DECIMAL(15,2),  -- Functional fees (same for all)
    AmountPaid DECIMAL(15,2),  -- Total amount paid
    Balance DECIMAL(15,2),  -- Outstanding balance
    StudentType VARCHAR(20) DEFAULT 'national',  -- 'national' or 'international'
    PaymentDate DATETIME DEFAULT CURRENT_TIMESTAMP,  -- When payment was made
    PaymentTimestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,  -- Exact timestamp
    PaymentMethod VARCHAR(50) DEFAULT 'Bank Transfer',  -- Payment method (Bank Transfer, Mobile Money, Cash, etc.)
    Status VARCHAR(20) DEFAULT 'Pending',  -- Payment status: Pending, Completed, Failed, Refunded
    SemesterStartDate DATE,  -- Semester start date for deadline calculation
    DeadlineMet BOOLEAN DEFAULT FALSE,  -- Whether payment met the deadline
    DeadlineType VARCHAR(50),  -- Which deadline: prompt_payment, registration, midterm, full_fees, late_penalty_week1, late_penalty_week2
    WeeksFromDeadline DECIMAL(5,2),  -- Weeks from the relevant deadline (negative if before, positive if after)
    LatePenalty DECIMAL(15,2) DEFAULT 0,  -- Late penalty amount if applicable
    FOREIGN KEY (StudentID) REFERENCES students(StudentID) ON DELETE CASCADE,
    INDEX idx_student (StudentID),
    INDEX idx_semester (Semester),
    INDEX idx_year (Year),
    INDEX idx_payment_date (PaymentDate),
    INDEX idx_status (Status),
    INDEX idx_deadline_met (DeadlineMet)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
