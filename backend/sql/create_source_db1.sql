-- Source Database 1: ucu_sourcedb1 (ACADEMICS DATABASE)
-- PostgreSQL version

CREATE TABLE IF NOT EXISTS faculties (
    FacultyID SERIAL PRIMARY KEY,
    FacultyName VARCHAR(200),
    DeanName VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS idx_faculties_name ON faculties(FacultyName);

CREATE TABLE IF NOT EXISTS departments (
    DepartmentID SERIAL PRIMARY KEY,
    DepartmentName VARCHAR(200),
    FacultyID INT,
    HeadOfDepartment VARCHAR(100),
    FOREIGN KEY (FacultyID) REFERENCES faculties(FacultyID) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_departments_faculty ON departments(FacultyID);
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(DepartmentName);

CREATE TABLE IF NOT EXISTS programs (
    ProgramID SERIAL PRIMARY KEY,
    ProgramName VARCHAR(200),
    DegreeLevel VARCHAR(50),
    DepartmentID INT,
    DurationYears INT,
    TuitionNationals DECIMAL(15,2),
    TuitionNonNationals DECIMAL(15,2),
    FOREIGN KEY (DepartmentID) REFERENCES departments(DepartmentID) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_programs_department ON programs(DepartmentID);
CREATE INDEX IF NOT EXISTS idx_programs_name ON programs(ProgramName);

CREATE TABLE IF NOT EXISTS courses (
    CourseID SERIAL PRIMARY KEY,
    CourseCode VARCHAR(20),
    CourseName VARCHAR(200),
    ProgramID INT,
    CreditUnits INT,
    FOREIGN KEY (ProgramID) REFERENCES programs(ProgramID) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_courses_program ON courses(ProgramID);
CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(CourseCode);

CREATE TABLE IF NOT EXISTS lecturers (
    LecturerID SERIAL PRIMARY KEY,
    StaffNumber VARCHAR(50),
    FullName VARCHAR(100),
    DepartmentID INT,
    Rank VARCHAR(100),
    FOREIGN KEY (DepartmentID) REFERENCES departments(DepartmentID) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_lecturers_department ON lecturers(DepartmentID);
CREATE INDEX IF NOT EXISTS idx_lecturers_staff_number ON lecturers(StaffNumber);

CREATE TABLE IF NOT EXISTS students (
    StudentID SERIAL PRIMARY KEY,
    RegNo VARCHAR(50),
    AccessNumber VARCHAR(10) UNIQUE NOT NULL,
    FullName VARCHAR(100),
    ProgramID INT,
    YearOfStudy INT,
    Status VARCHAR(50),
    HighSchool VARCHAR(200),
    HighSchoolDistrict VARCHAR(100),
    FOREIGN KEY (ProgramID) REFERENCES programs(ProgramID) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_students_reg_no ON students(RegNo);
CREATE INDEX IF NOT EXISTS idx_students_access_number ON students(AccessNumber);
CREATE INDEX IF NOT EXISTS idx_students_program ON students(ProgramID);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(Status);
CREATE INDEX IF NOT EXISTS idx_students_high_school ON students(HighSchool);

CREATE TABLE IF NOT EXISTS enrollments (
    EnrollmentID SERIAL PRIMARY KEY,
    StudentID INT,
    CourseID INT,
    AcademicYear VARCHAR(20),
    Semester VARCHAR(20),
    HighSchool VARCHAR(200),
    FOREIGN KEY (StudentID) REFERENCES students(StudentID) ON DELETE CASCADE,
    FOREIGN KEY (CourseID) REFERENCES courses(CourseID) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(StudentID);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(CourseID);
CREATE INDEX IF NOT EXISTS idx_enrollments_academic_year ON enrollments(AcademicYear);
CREATE INDEX IF NOT EXISTS idx_enrollments_high_school ON enrollments(HighSchool);

CREATE TABLE IF NOT EXISTS grades (
    GradeID SERIAL PRIMARY KEY,
    StudentID INT,
    CourseID INT,
    CourseworkScore DECIMAL(5,2) NOT NULL,
    ExamScore DECIMAL(5,2),
    TotalScore DECIMAL(5,2) NOT NULL,
    GradeLetter VARCHAR(5) NOT NULL,
    FCW BOOLEAN DEFAULT FALSE,
    ExamStatus VARCHAR(10),
    AbsenceReason VARCHAR(200),
    FOREIGN KEY (StudentID) REFERENCES students(StudentID) ON DELETE CASCADE,
    FOREIGN KEY (CourseID) REFERENCES courses(CourseID) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(StudentID);
CREATE INDEX IF NOT EXISTS idx_grades_course ON grades(CourseID);
CREATE INDEX IF NOT EXISTS idx_grades_letter ON grades(GradeLetter);
CREATE INDEX IF NOT EXISTS idx_grades_exam_status ON grades(ExamStatus);

CREATE TABLE IF NOT EXISTS attendance (
    AttendanceID SERIAL PRIMARY KEY,
    StudentID INT,
    CourseID INT,
    Date DATE,
    Status VARCHAR(20),
    FOREIGN KEY (StudentID) REFERENCES students(StudentID) ON DELETE CASCADE,
    FOREIGN KEY (CourseID) REFERENCES courses(CourseID) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(StudentID);
CREATE INDEX IF NOT EXISTS idx_attendance_course ON attendance(CourseID);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(Date);

CREATE TABLE IF NOT EXISTS student_fees (
    PaymentID SERIAL PRIMARY KEY,
    StudentID INT,
    Year INT,
    Semester VARCHAR(50),
    TuitionNational DECIMAL(15,2),
    TuitionInternational DECIMAL(15,2),
    FunctionalFees DECIMAL(15,2),
    AmountPaid DECIMAL(15,2),
    Balance DECIMAL(15,2),
    StudentType VARCHAR(20) DEFAULT 'national',
    PaymentDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PaymentTimestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PaymentMethod VARCHAR(50) DEFAULT 'Bank Transfer',
    Status VARCHAR(20) DEFAULT 'Pending',
    SemesterStartDate DATE,
    DeadlineMet BOOLEAN DEFAULT FALSE,
    DeadlineType VARCHAR(50),
    WeeksFromDeadline DECIMAL(5,2),
    LatePenalty DECIMAL(15,2) DEFAULT 0,
    FOREIGN KEY (StudentID) REFERENCES students(StudentID) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_student_fees_student ON student_fees(StudentID);
CREATE INDEX IF NOT EXISTS idx_student_fees_semester ON student_fees(Semester);
CREATE INDEX IF NOT EXISTS idx_student_fees_year ON student_fees(Year);
CREATE INDEX IF NOT EXISTS idx_student_fees_payment_date ON student_fees(PaymentDate);
CREATE INDEX IF NOT EXISTS idx_student_fees_status ON student_fees(Status);
CREATE INDEX IF NOT EXISTS idx_student_fees_deadline_met ON student_fees(DeadlineMet);
