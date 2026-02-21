"""
ETL Pipeline with Medallion Architecture (Bronze, Silver, Gold)
Uses MySQL
"""
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
import pymysql
import random
import logging
from config import (
    DB1_CONN_STRING, DB2_CONN_STRING, CSV1_PATH, CSV2_PATH,
    BRONZE_PATH, SILVER_PATH, GOLD_PATH,
    DATA_WAREHOUSE_NAME, DATA_WAREHOUSE_CONN_STRING,
    MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD
)

class ETLPipeline:
    def __init__(self):
        self.bronze_path = BRONZE_PATH
        self.silver_path = SILVER_PATH
        self.gold_path = GOLD_PATH
        self.dw_name = DATA_WAREHOUSE_NAME
        
        # Setup logging
        self.log_dir = Path(__file__).parent / "logs"
        self.log_dir.mkdir(parents=True, exist_ok=True)
        
        # Create log file with timestamp
        log_filename = f"etl_pipeline_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        self.log_file = self.log_dir / log_filename
        
        # Configure logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(self.log_file, encoding='utf-8'),
                logging.StreamHandler()  # Also print to console
            ]
        )
        self.logger = logging.getLogger(__name__)
        self.logger.info(f"ETL Pipeline initialized. Log file: {self.log_file}")
        
    def create_data_warehouse(self):
        """Create data warehouse database if it doesn't exist"""
        try:
            self.logger.info(f"Creating data warehouse database: {self.dw_name}")
            # Connect to MySQL server (without specifying database)
            conn = pymysql.connect(
                host=MYSQL_HOST,
                port=int(MYSQL_PORT),
                user=MYSQL_USER,
                password=MYSQL_PASSWORD,
                charset='utf8mb4'
            )
            cursor = conn.cursor()
            
            # Check if database exists
            cursor.execute(f"SHOW DATABASES LIKE '{self.dw_name}'")
            if cursor.fetchone() is None:
                cursor.execute(f"CREATE DATABASE `{self.dw_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
                self.logger.info(f"Data warehouse database {self.dw_name} created successfully")
                print(f"Data warehouse database {self.dw_name} created successfully")
            else:
                self.logger.info(f"Data warehouse database {self.dw_name} already exists")
                print(f"Data warehouse database {self.dw_name} already exists")
            
            conn.close()
        except Exception as e:
            self.logger.error(f"Error creating data warehouse: {e}", exc_info=True)
            print(f"Error creating data warehouse: {e}")
            raise
        
    def extract(self):
        """Extract data from all sources (Bronze Layer)"""
        self.logger.info("=" * 60)
        self.logger.info("EXTRACT PHASE - Bronze Layer")
        self.logger.info("=" * 60)
        print("Extracting data to Bronze layer...")
        
        # Extract from Database 1 (ACADEMICS)
        self.logger.info("Extracting from Source Database 1 (ACADEMICS)...")
        engine1 = create_engine(DB1_CONN_STRING)
        students_db1 = pd.read_sql_query("SELECT * FROM students", engine1)
        self.logger.info(f"  → Extracted {len(students_db1)} students")
        courses_db1 = pd.read_sql_query("SELECT * FROM courses", engine1)
        self.logger.info(f"  → Extracted {len(courses_db1)} courses")
        enrollments_db1 = pd.read_sql_query("SELECT * FROM enrollments", engine1)
        self.logger.info(f"  → Extracted {len(enrollments_db1)} enrollments")
        attendance_db1 = pd.read_sql_query("SELECT * FROM attendance", engine1)
        self.logger.info(f"  → Extracted {len(attendance_db1)} attendance records")
        grades_db1 = pd.read_sql_query("SELECT * FROM grades", engine1)
        self.logger.info(f"  → Extracted {len(grades_db1)} grades")
        student_fees_db1 = pd.read_sql_query("SELECT * FROM student_fees", engine1)
        self.logger.info(f"  → Extracted {len(student_fees_db1)} student fees")
        # Extract dimension tables
        faculties_db1 = pd.read_sql_query("SELECT * FROM faculties", engine1)
        self.logger.info(f"  → Extracted {len(faculties_db1)} faculties")
        departments_db1 = pd.read_sql_query("SELECT * FROM departments", engine1)
        self.logger.info(f"  → Extracted {len(departments_db1)} departments")
        programs_db1 = pd.read_sql_query("SELECT * FROM programs", engine1)
        self.logger.info(f"  → Extracted {len(programs_db1)} programs")
        engine1.dispose()
        
        # Extract from Database 2 (ADMINISTRATION) - for future use
        self.logger.info("Extracting from Source Database 2 (ADMINISTRATION)...")
        engine2 = create_engine(DB2_CONN_STRING)
        employees_db2 = pd.read_sql_query("SELECT * FROM employees", engine2)
        self.logger.info(f"  → Extracted {len(employees_db2)} employees")
        payroll_db2 = pd.read_sql_query("SELECT * FROM payroll", engine2)
        self.logger.info(f"  → Extracted {len(payroll_db2)} payroll records")
        engine2.dispose()
        
        # Extract from CSV files (for backward compatibility)
        try:
            payments_csv = pd.read_csv(CSV1_PATH)
        except:
            payments_csv = pd.DataFrame()
        try:
            grades_csv = pd.read_csv(CSV2_PATH)
        except:
            grades_csv = pd.DataFrame()
        
        # Save to Bronze layer (raw data)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        students_db1.to_parquet(self.bronze_path / f"bronze_students_db1_{timestamp}.parquet", index=False)
        courses_db1.to_parquet(self.bronze_path / f"bronze_courses_db1_{timestamp}.parquet", index=False)
        enrollments_db1.to_parquet(self.bronze_path / f"bronze_enrollments_db1_{timestamp}.parquet", index=False)
        attendance_db1.to_parquet(self.bronze_path / f"bronze_attendance_db1_{timestamp}.parquet", index=False)
        grades_db1.to_parquet(self.bronze_path / f"bronze_grades_db1_{timestamp}.parquet", index=False)
        student_fees_db1.to_parquet(self.bronze_path / f"bronze_student_fees_db1_{timestamp}.parquet", index=False)
        if not faculties_db1.empty:
            faculties_db1.to_parquet(self.bronze_path / f"bronze_faculties_db1_{timestamp}.parquet", index=False)
        if not departments_db1.empty:
            departments_db1.to_parquet(self.bronze_path / f"bronze_departments_db1_{timestamp}.parquet", index=False)
        if not programs_db1.empty:
            programs_db1.to_parquet(self.bronze_path / f"bronze_programs_db1_{timestamp}.parquet", index=False)
        
        employees_db2.to_parquet(self.bronze_path / f"bronze_employees_db2_{timestamp}.parquet", index=False)
        payroll_db2.to_parquet(self.bronze_path / f"bronze_payroll_db2_{timestamp}.parquet", index=False)
        
        if not payments_csv.empty:
            payments_csv.to_parquet(self.bronze_path / f"bronze_payments_csv_{timestamp}.parquet", index=False)
        if not grades_csv.empty:
            grades_csv.to_parquet(self.bronze_path / f"bronze_grades_csv_{timestamp}.parquet", index=False)
        
        self.logger.info(f"Bronze layer files saved to: {self.bronze_path}")
        self.logger.info("Bronze layer extraction complete!")
        print("Bronze layer extraction complete!")
        return {
            'students_db1': students_db1,
            'courses_db1': courses_db1,
            'enrollments_db1': enrollments_db1,
            'attendance_db1': attendance_db1,
            'grades_db1': grades_db1,
            'student_fees_db1': student_fees_db1,
            'faculties_db1': faculties_db1,
            'departments_db1': departments_db1,
            'programs_db1': programs_db1,
            'employees_db2': employees_db2,
            'payroll_db2': payroll_db2,
            'payments_csv': payments_csv,
            'grades_csv': grades_csv
        }
    
    def transform(self, bronze_data):
        """Transform and clean data (Silver Layer)"""
        self.logger.info("=" * 60)
        self.logger.info("TRANSFORM PHASE - Silver Layer")
        self.logger.info("=" * 60)
        print("Transforming data to Silver layer...")
        
        # Transform Students (DB1) - map to old format for compatibility
        students_silver = bronze_data['students_db1'].copy()
        students_silver = students_silver.fillna('')
        # Create student_id from RegNo for compatibility
        if 'RegNo' in students_silver.columns:
            students_silver['student_id'] = students_silver['RegNo'].astype(str)
            students_silver['reg_no'] = students_silver['RegNo'].astype(str)
        elif 'StudentID' in students_silver.columns:
            students_silver['student_id'] = students_silver['StudentID'].apply(lambda x: f"STU{int(x):06d}" if pd.notna(x) else '')
        # Extract Access Number
        if 'AccessNumber' in students_silver.columns:
            students_silver['access_number'] = students_silver['AccessNumber'].astype(str)
        else:
            # Generate if missing (for backward compatibility)
            students_silver['access_number'] = students_silver['student_id'].apply(
                lambda x: f"{random.choice(['A', 'B'])}{random.randint(10000, 99999):05d}" if pd.notna(x) else ''
            )
        if 'FullName' in students_silver.columns:
            # Split FullName into first_name and last_name
            names = students_silver['FullName'].str.split(' ', n=1, expand=True)
            students_silver['first_name'] = names[0].fillna('')
            students_silver['last_name'] = names[1].fillna('') if len(names.columns) > 1 else ''
        # Extract high school information
        if 'HighSchool' in students_silver.columns:
            students_silver['high_school'] = students_silver['HighSchool'].astype(str)
        else:
            students_silver['high_school'] = ''
        if 'HighSchoolDistrict' in students_silver.columns:
            students_silver['high_school_district'] = students_silver['HighSchoolDistrict'].astype(str)
        else:
            students_silver['high_school_district'] = ''
        # Extract program and status
        if 'ProgramID' in students_silver.columns:
            students_silver['program_id'] = students_silver['ProgramID']
        if 'YearOfStudy' in students_silver.columns:
            students_silver['year_of_study'] = students_silver['YearOfStudy']
        if 'Status' in students_silver.columns:
            students_silver['status'] = students_silver['Status']
        # Add missing columns with defaults
        if 'email' not in students_silver.columns:
            students_silver['email'] = students_silver.get('access_number', '').astype(str) + '@ucu.ac.ug'
        if 'gender' not in students_silver.columns:
            students_silver['gender'] = random.choice(['M', 'F'])
        if 'nationality' not in students_silver.columns:
            students_silver['nationality'] = 'Ugandan'
        if 'admission_date' not in students_silver.columns:
            students_silver['admission_date'] = (datetime.now() - timedelta(days=random.randint(0, 1460))).strftime('%Y-%m-%d')
        students_silver = students_silver.fillna('')
        
        # Transform Courses (DB1)
        courses_silver = bronze_data['courses_db1'].copy()
        courses_silver = courses_silver.fillna('')
        # Map CourseCode to course_code
        if 'CourseCode' in courses_silver.columns:
            courses_silver['course_code'] = courses_silver['CourseCode']
        if 'CourseName' in courses_silver.columns:
            courses_silver['course_name'] = courses_silver['CourseName']
        if 'CreditUnits' in courses_silver.columns:
            courses_silver['credits'] = courses_silver['CreditUnits']
        courses_silver['department'] = 'General'  # Default, can be enhanced
        
        # Clean enrollments - need to join with students and courses to get proper IDs
        enrollments_silver = bronze_data['enrollments_db1'].copy()
        enrollments_silver = enrollments_silver.fillna('')
        
        # Join with students to get RegNo
        if 'StudentID' in enrollments_silver.columns and 'RegNo' in bronze_data['students_db1'].columns:
            student_map = dict(zip(bronze_data['students_db1']['StudentID'], bronze_data['students_db1']['RegNo']))
            enrollments_silver['student_id'] = enrollments_silver['StudentID'].map(student_map).fillna('')
        elif 'StudentID' in enrollments_silver.columns:
            enrollments_silver['student_id'] = enrollments_silver['StudentID'].apply(lambda x: f"STU{int(x):06d}" if pd.notna(x) else '')
        
        # Join with courses to get CourseCode
        if 'CourseID' in enrollments_silver.columns and 'CourseCode' in bronze_data['courses_db1'].columns:
            course_map = dict(zip(bronze_data['courses_db1']['CourseID'], bronze_data['courses_db1']['CourseCode']))
            enrollments_silver['course_code'] = enrollments_silver['CourseID'].map(course_map).fillna('')
        elif 'CourseID' in enrollments_silver.columns:
            enrollments_silver['course_code'] = enrollments_silver['CourseID'].apply(lambda x: f"COURSE{int(x):03d}" if pd.notna(x) else '')
        
        if 'AcademicYear' in enrollments_silver.columns:
            enrollments_silver['semester'] = enrollments_silver['AcademicYear'].astype(str) + ' ' + enrollments_silver.get('Semester', '').astype(str)
        enrollments_silver['enrollment_date'] = pd.to_datetime(datetime.now(), errors='coerce')
        enrollments_silver['status'] = 'Active'
        enrollments_silver['enrollment_id'] = enrollments_silver.get('EnrollmentID', range(1, len(enrollments_silver) + 1))
        
        # Clean attendance (DB1)
        attendance_silver = bronze_data['attendance_db1'].copy()
        attendance_silver = attendance_silver.fillna('')
        
        # Join with students to get RegNo
        if 'StudentID' in attendance_silver.columns and 'RegNo' in bronze_data['students_db1'].columns:
            student_map = dict(zip(bronze_data['students_db1']['StudentID'], bronze_data['students_db1']['RegNo']))
            attendance_silver['student_id'] = attendance_silver['StudentID'].map(student_map).fillna('')
        elif 'StudentID' in attendance_silver.columns:
            attendance_silver['student_id'] = attendance_silver['StudentID'].apply(lambda x: f"STU{int(x):06d}" if pd.notna(x) else '')
        
        # Join with courses to get CourseCode
        if 'CourseID' in attendance_silver.columns and 'CourseCode' in bronze_data['courses_db1'].columns:
            course_map = dict(zip(bronze_data['courses_db1']['CourseID'], bronze_data['courses_db1']['CourseCode']))
            attendance_silver['course_code'] = attendance_silver['CourseID'].map(course_map).fillna('')
        elif 'CourseID' in attendance_silver.columns:
            attendance_silver['course_code'] = attendance_silver['CourseID'].apply(lambda x: f"COURSE{int(x):03d}" if pd.notna(x) else '')
        
        if 'Date' in attendance_silver.columns:
            attendance_silver['attendance_date'] = pd.to_datetime(attendance_silver['Date'], errors='coerce')
        # Calculate hours_attended based on status
        if 'Status' in attendance_silver.columns:
            attendance_silver['hours_attended'] = attendance_silver['Status'].apply(
                lambda x: 2.0 if str(x).upper() == 'PRESENT' else (1.0 if str(x).upper() == 'LATE' else 0.0)
            )
        else:
            attendance_silver['hours_attended'] = 2.0
        
        # Clean payments (from DB1 student_fees or CSV)
        if not bronze_data['student_fees_db1'].empty:
            payments_silver = bronze_data['student_fees_db1'].copy()
            payments_silver = payments_silver.fillna('')
            # Join with students to get RegNo
            if 'StudentID' in payments_silver.columns and 'RegNo' in bronze_data['students_db1'].columns:
                student_map = dict(zip(bronze_data['students_db1']['StudentID'], bronze_data['students_db1']['RegNo']))
                payments_silver['student_id'] = payments_silver['StudentID'].map(student_map).fillna('')
            elif 'StudentID' in payments_silver.columns:
                payments_silver['student_id'] = payments_silver['StudentID'].apply(lambda x: f"STU{int(x):06d}" if pd.notna(x) else '')
            if 'AmountPaid' in payments_silver.columns:
                payments_silver['amount'] = pd.to_numeric(payments_silver['AmountPaid'], errors='coerce').fillna(0)
            # Extract fee breakdown from database
            if 'TuitionNational' in payments_silver.columns:
                payments_silver['tuition_national'] = pd.to_numeric(payments_silver['TuitionNational'], errors='coerce').fillna(0)
            else:
                payments_silver['tuition_national'] = 0
            if 'TuitionInternational' in payments_silver.columns:
                payments_silver['tuition_international'] = pd.to_numeric(payments_silver['TuitionInternational'], errors='coerce').fillna(0)
            else:
                payments_silver['tuition_international'] = 0
            if 'FunctionalFees' in payments_silver.columns:
                payments_silver['functional_fees'] = pd.to_numeric(payments_silver['FunctionalFees'], errors='coerce').fillna(0)
            else:
                payments_silver['functional_fees'] = 0
            # Extract year
            if 'Year' in payments_silver.columns:
                payments_silver['year'] = pd.to_numeric(payments_silver['Year'], errors='coerce').fillna(datetime.now().year)
            else:
                payments_silver['year'] = datetime.now().year
            # Extract payment date/timestamp
            if 'PaymentDate' in payments_silver.columns:
                payments_silver['payment_date'] = pd.to_datetime(payments_silver['PaymentDate'], errors='coerce')
            elif 'PaymentTimestamp' in payments_silver.columns:
                payments_silver['payment_date'] = pd.to_datetime(payments_silver['PaymentTimestamp'], errors='coerce')
            else:
                payments_silver['payment_date'] = pd.to_datetime(datetime.now(), errors='coerce')
            
            # Extract payment timestamp (with time component)
            if 'PaymentTimestamp' in payments_silver.columns:
                payments_silver['payment_timestamp'] = pd.to_datetime(payments_silver['PaymentTimestamp'], errors='coerce')
            elif 'PaymentDate' in payments_silver.columns:
                payments_silver['payment_timestamp'] = pd.to_datetime(payments_silver['PaymentDate'], errors='coerce')
            else:
                payments_silver['payment_timestamp'] = pd.to_datetime(datetime.now(), errors='coerce')
            
            # Extract semester start date
            if 'SemesterStartDate' in payments_silver.columns:
                payments_silver['semester_start_date'] = pd.to_datetime(payments_silver['SemesterStartDate'], errors='coerce')
            else:
                payments_silver['semester_start_date'] = None  # Will be calculated in load phase
            
            payments_silver['payment_method'] = payments_silver.get('PaymentMethod', 'Bank Transfer')
            if 'Status' in payments_silver.columns:
                payments_silver['status'] = payments_silver['Status']
            else:
                payments_silver['status'] = 'Completed'
            if 'Semester' in payments_silver.columns:
                payments_silver['semester'] = payments_silver['Semester']
            payments_silver['payment_id'] = payments_silver.get('PaymentID', range(1, len(payments_silver) + 1))
        elif not bronze_data['payments_csv'].empty:
            payments_silver = bronze_data['payments_csv'].copy()
            payments_silver = payments_silver.fillna('')
            
            # Extract payment date/timestamp
            if 'payment_timestamp' in payments_silver.columns:
                payments_silver['payment_date'] = pd.to_datetime(payments_silver['payment_timestamp'], errors='coerce')
                payments_silver['payment_timestamp'] = pd.to_datetime(payments_silver['payment_timestamp'], errors='coerce')
            elif 'payment_date' in payments_silver.columns:
                payments_silver['payment_date'] = pd.to_datetime(payments_silver['payment_date'], errors='coerce')
                payments_silver['payment_timestamp'] = payments_silver['payment_date']
            else:
                payments_silver['payment_date'] = pd.to_datetime(datetime.now(), errors='coerce')
                payments_silver['payment_timestamp'] = pd.to_datetime(datetime.now(), errors='coerce')
            
            # Extract semester start date
            if 'semester_start_date' in payments_silver.columns:
                payments_silver['semester_start_date'] = pd.to_datetime(payments_silver['semester_start_date'], errors='coerce')
            else:
                payments_silver['semester_start_date'] = None  # Will be calculated in load phase
            
            payments_silver['amount'] = pd.to_numeric(payments_silver.get('amount', 0), errors='coerce').fillna(0)
            # Extract year if present
            if 'year' in payments_silver.columns:
                payments_silver['year'] = pd.to_numeric(payments_silver['year'], errors='coerce').fillna(datetime.now().year)
            else:
                payments_silver['year'] = payments_silver['payment_date'].dt.year.fillna(datetime.now().year)
            # Extract fee breakdown if present
            payments_silver['tuition_national'] = pd.to_numeric(payments_silver.get('tuition_national', 0), errors='coerce').fillna(0)
            payments_silver['tuition_international'] = pd.to_numeric(payments_silver.get('tuition_international', 0), errors='coerce').fillna(0)
            payments_silver['functional_fees'] = pd.to_numeric(payments_silver.get('functional_fees', 0), errors='coerce').fillna(0)
            
            # Extract payment method
            payments_silver['payment_method'] = payments_silver.get('payment_method', 'Bank Transfer')
        else:
            payments_silver = pd.DataFrame()
        
        # Clean grades (from DB1 or CSV)
        if not bronze_data['grades_db1'].empty:
            grades_silver = bronze_data['grades_db1'].copy()
            grades_silver = grades_silver.fillna('')
            # Join with students to get RegNo
            if 'StudentID' in grades_silver.columns and 'RegNo' in bronze_data['students_db1'].columns:
                student_map = dict(zip(bronze_data['students_db1']['StudentID'], bronze_data['students_db1']['RegNo']))
                grades_silver['student_id'] = grades_silver['StudentID'].map(student_map).fillna('')
            elif 'StudentID' in grades_silver.columns:
                grades_silver['student_id'] = grades_silver['StudentID'].apply(lambda x: f"STU{int(x):06d}" if pd.notna(x) else '')
            # Join with courses to get CourseCode
            if 'CourseID' in grades_silver.columns and 'CourseCode' in bronze_data['courses_db1'].columns:
                course_map = dict(zip(bronze_data['courses_db1']['CourseID'], bronze_data['courses_db1']['CourseCode']))
                grades_silver['course_code'] = grades_silver['CourseID'].map(course_map).fillna('')
            elif 'CourseID' in grades_silver.columns:
                grades_silver['course_code'] = grades_silver['CourseID'].apply(lambda x: f"COURSE{int(x):03d}" if pd.notna(x) else '')
            # Extract coursework and exam scores
            if 'CourseworkScore' in grades_silver.columns:
                grades_silver['coursework_score'] = pd.to_numeric(grades_silver['CourseworkScore'], errors='coerce').fillna(0)
            else:
                grades_silver['coursework_score'] = 0.0
            if 'ExamScore' in grades_silver.columns:
                # Replace empty strings with None before converting to numeric
                grades_silver['ExamScore'] = grades_silver['ExamScore'].replace('', None)
                grades_silver['exam_score'] = pd.to_numeric(grades_silver['ExamScore'], errors='coerce')
            else:
                grades_silver['exam_score'] = None
            # Drop original ExamScore column to avoid parquet conversion issues
            if 'ExamScore' in grades_silver.columns:
                grades_silver = grades_silver.drop(columns=['ExamScore'])
            if 'TotalScore' in grades_silver.columns:
                # Always store numeric score (MEX will have 0, but letter grade will be MEX)
                grades_silver['grade'] = pd.to_numeric(grades_silver['TotalScore'], errors='coerce')
                grades_silver['grade'] = grades_silver['grade'].fillna(0)  # Ensure numeric score is always present
            if 'GradeLetter' in grades_silver.columns:
                grades_silver['letter_grade'] = grades_silver['GradeLetter']
            # Extract FCW flag
            if 'FCW' in grades_silver.columns:
                grades_silver['fcw'] = grades_silver['FCW'].astype(bool)
            else:
                grades_silver['fcw'] = False
            # Extract exam status and absence reason
            if 'ExamStatus' in grades_silver.columns:
                grades_silver['exam_status'] = grades_silver['ExamStatus']
            else:
                grades_silver['exam_status'] = 'Completed'
            if 'AbsenceReason' in grades_silver.columns:
                grades_silver['absence_reason'] = grades_silver['AbsenceReason']
            else:
                grades_silver['absence_reason'] = ''
            grades_silver['exam_date'] = pd.to_datetime(datetime.now(), errors='coerce')
            grades_silver['semester'] = '2023/2024 Sem 1'
            grades_silver['grade_id'] = grades_silver.get('GradeID', range(1, len(grades_silver) + 1))
        elif not bronze_data['grades_csv'].empty:
            grades_silver = bronze_data['grades_csv'].copy()
            grades_silver = grades_silver.fillna('')
            # Extract coursework and exam scores from CSV
            if 'coursework_score' in grades_silver.columns:
                grades_silver['coursework_score'] = pd.to_numeric(grades_silver['coursework_score'], errors='coerce').fillna(0)
            else:
                grades_silver['coursework_score'] = 0.0
            if 'exam_score' in grades_silver.columns:
                # Replace empty strings with None before converting to numeric
                grades_silver['exam_score'] = grades_silver['exam_score'].replace('', None)
                grades_silver['exam_score'] = pd.to_numeric(grades_silver['exam_score'], errors='coerce')
            else:
                grades_silver['exam_score'] = None
            grades_silver['grade'] = pd.to_numeric(grades_silver.get('grade', 0), errors='coerce').fillna(0)
            # Extract FCW flag
            if 'fcw' in grades_silver.columns:
                grades_silver['fcw'] = grades_silver['fcw'].astype(bool)
            else:
                grades_silver['fcw'] = False
            # Extract exam status and absence reason
            if 'exam_status' in grades_silver.columns:
                grades_silver['exam_status'] = grades_silver['exam_status']
            else:
                grades_silver['exam_status'] = 'Completed'
            if 'absence_reason' in grades_silver.columns:
                grades_silver['absence_reason'] = grades_silver['absence_reason']
            else:
                grades_silver['absence_reason'] = ''
            grades_silver['exam_date'] = pd.to_datetime(grades_silver.get('exam_date', datetime.now()), errors='coerce')
            # Extract year if present in CSV
            if 'year' in grades_silver.columns:
                grades_silver['year'] = pd.to_numeric(grades_silver['year'], errors='coerce').fillna(grades_silver['exam_date'].dt.year.fillna(datetime.now().year))
            else:
                grades_silver['year'] = grades_silver['exam_date'].dt.year.fillna(datetime.now().year)
        else:
            grades_silver = pd.DataFrame()
        
        # Save to Silver layer
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        students_silver.to_parquet(self.silver_path / f"silver_students_{timestamp}.parquet", index=False)
        courses_silver.to_parquet(self.silver_path / f"silver_courses_{timestamp}.parquet", index=False)
        enrollments_silver.to_parquet(self.silver_path / f"silver_enrollments_{timestamp}.parquet", index=False)
        attendance_silver.to_parquet(self.silver_path / f"silver_attendance_{timestamp}.parquet", index=False)
        payments_silver.to_parquet(self.silver_path / f"silver_payments_{timestamp}.parquet", index=False)
        grades_silver.to_parquet(self.silver_path / f"silver_grades_{timestamp}.parquet", index=False)
        
        self.logger.info(f"Silver layer files saved to: {self.silver_path}")
        self.logger.info(f"  → Students: {len(students_silver)}")
        self.logger.info(f"  → Courses: {len(courses_silver)}")
        self.logger.info(f"  → Enrollments: {len(enrollments_silver)}")
        self.logger.info(f"  → Attendance: {len(attendance_silver)}")
        self.logger.info(f"  → Payments: {len(payments_silver)}")
        self.logger.info(f"  → Grades: {len(grades_silver)}")
        self.logger.info("Silver layer transformation complete!")
        print("Silver layer transformation complete!")
        return {
            'students': students_silver,
            'courses': courses_silver,
            'enrollments': enrollments_silver,
            'attendance': attendance_silver,
            'payments': payments_silver,
            'grades': grades_silver,
            # Pass through dimension tables from bronze
            'faculties_db1': bronze_data.get('faculties_db1', pd.DataFrame()),
            'departments_db1': bronze_data.get('departments_db1', pd.DataFrame()),
            'programs_db1': bronze_data.get('programs_db1', pd.DataFrame()),
            'employees_db2': bronze_data.get('employees_db2', pd.DataFrame())
        }
    
    def load_to_warehouse(self, silver_data):
        """Load transformed data into star schema data warehouse (Gold Layer)"""
        self.logger.info("=" * 60)
        self.logger.info("LOAD PHASE - Gold Layer (Data Warehouse)")
        self.logger.info("=" * 60)
        print("Loading data to Gold layer (Data Warehouse)...")
        
        # Create data warehouse if it doesn't exist
        self.create_data_warehouse()
        
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        
        # Create dimension tables
        self._create_dimensions(engine, silver_data)
        
        # Populate time dimension before facts (facts reference dim_time)
        self._populate_time_dimension(engine)
        
        # Create fact tables
        self._create_facts(engine, silver_data)
        
        engine.dispose()
        self.logger.info("=" * 60)
        self.logger.info("ETL PIPELINE COMPLETED SUCCESSFULLY")
        self.logger.info(f"Log file saved to: {self.log_file}")
        self.logger.info("=" * 60)
        print("Gold layer (Data Warehouse) loading complete!")
        print(f"ETL log file: {self.log_file}")
    
    def _create_dimensions(self, engine, silver_data):
        """Create dimension tables for star schema"""
        self.logger.info("Creating dimension tables...")
        
        with engine.connect() as conn:
            # Temporarily disable FK checks so we can drop and recreate tables safely
            conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))

            # Drop fact tables first (they reference dimensions)
            conn.execute(text("DROP TABLE IF EXISTS fact_grade"))
            conn.execute(text("DROP TABLE IF EXISTS fact_payment"))
            conn.execute(text("DROP TABLE IF EXISTS fact_attendance"))
            conn.execute(text("DROP TABLE IF EXISTS fact_enrollment"))

            # Dim_Student
            conn.execute(text("DROP TABLE IF EXISTS dim_student"))
            conn.execute(text("""
                CREATE TABLE dim_student (
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """))
            
            # Dim_Course
            conn.execute(text("DROP TABLE IF EXISTS dim_course"))
            conn.execute(text("""
                CREATE TABLE dim_course (
                    course_code VARCHAR(20) PRIMARY KEY,
                    course_name VARCHAR(100),
                    credits INT,
                    department VARCHAR(50),
                    INDEX idx_department (department)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """))
            
            # Dim_Time
            conn.execute(text("DROP TABLE IF EXISTS dim_time"))
            conn.execute(text("""
                CREATE TABLE dim_time (
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """))
            
            # Dim_Semester
            conn.execute(text("DROP TABLE IF EXISTS dim_semester"))
            conn.execute(text("""
                CREATE TABLE dim_semester (
                    semester_id INT PRIMARY KEY,
                    semester_name VARCHAR(50),
                    academic_year VARCHAR(20),
                    INDEX idx_academic_year (academic_year)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """))

            # Re‑enable foreign key checks
            conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))
            conn.commit()
        
        # Dim_Student - deduplicate by student_id and include all fields
        student_cols = ['student_id', 'reg_no', 'access_number', 'first_name', 'last_name', 
                       'email', 'gender', 'nationality', 'admission_date', 'high_school', 
                       'high_school_district', 'program_id', 'year_of_study', 'status']
        
        # Select only columns that exist
        available_cols = [col for col in student_cols if col in silver_data['students'].columns]
        students_dim = silver_data['students'][available_cols].copy()
        
        # Ensure all required columns exist with defaults
        if 'reg_no' not in students_dim.columns:
            students_dim['reg_no'] = students_dim['student_id']
        if 'access_number' not in students_dim.columns:
            students_dim['access_number'] = ''
        if 'high_school' not in students_dim.columns:
            students_dim['high_school'] = ''
        if 'high_school_district' not in students_dim.columns:
            students_dim['high_school_district'] = ''
        if 'program_id' not in students_dim.columns:
            students_dim['program_id'] = None
        if 'year_of_study' not in students_dim.columns:
            students_dim['year_of_study'] = 1
        if 'status' not in students_dim.columns:
            students_dim['status'] = 'Active'
        
        students_dim = students_dim.drop_duplicates(subset=['student_id'], keep='first')
        # Also deduplicate by access_number to avoid unique constraint violations
        students_dim = students_dim.drop_duplicates(subset=['access_number'], keep='first')
        
        # Clear existing data first
        with engine.connect() as conn:
            conn.execute(text("DELETE FROM dim_student"))
            conn.commit()
        
        students_dim.to_sql('dim_student', engine, if_exists='append', index=False, method='multi', chunksize=100)
        self.logger.info(f"  → Loaded {len(students_dim)} students into dim_student")
        
        # Dim_Course - deduplicate by course_code
        courses_dim = silver_data['courses'][['course_code', 'course_name', 'credits', 'department']].copy()
        courses_dim.columns = ['course_code', 'course_name', 'credits', 'department']
        courses_dim = courses_dim.drop_duplicates(subset=['course_code'], keep='first')
        # Clear existing data first
        with engine.connect() as conn:
            conn.execute(text("DELETE FROM dim_course"))
            conn.commit()
        courses_dim.to_sql('dim_course', engine, if_exists='append', index=False)
        self.logger.info(f"  → Loaded {len(courses_dim)} courses into dim_course")
        
        # Dim_Semester - UCU Semester Names
        semesters = pd.DataFrame({
            'semester_id': [1, 2, 3],
            'semester_name': ['Jan (Easter Semester)', 'May (Trinity Semester)', 'September (Advent)'],
            'academic_year': ['2023-2024', '2023-2024', '2023-2024']  # Can be updated based on actual year
        })
        semesters.to_sql('dim_semester', engine, if_exists='append', index=False)
        self.logger.info(f"  → Loaded {len(semesters)} semesters into dim_semester")
        
        # Dim_Faculty - from source database
        if 'faculties_db1' in silver_data and not silver_data['faculties_db1'].empty:
            faculties_dim = silver_data['faculties_db1'].copy()
            # Map column names
            if 'FacultyID' in faculties_dim.columns:
                faculties_dim['faculty_id'] = faculties_dim['FacultyID']
            if 'FacultyName' in faculties_dim.columns:
                faculties_dim['faculty_name'] = faculties_dim['FacultyName']
            if 'DeanName' in faculties_dim.columns:
                faculties_dim['dean_name'] = faculties_dim['DeanName']
            # Select only required columns
            faculty_cols = ['faculty_id', 'faculty_name', 'dean_name']
            available_cols = [col for col in faculty_cols if col in faculties_dim.columns]
            if available_cols:
                faculties_dim = faculties_dim[available_cols].drop_duplicates(subset=['faculty_id'], keep='first')
                with engine.connect() as conn:
                    conn.execute(text("DELETE FROM dim_faculty"))
                    conn.commit()
                faculties_dim.to_sql('dim_faculty', engine, if_exists='append', index=False)
                self.logger.info(f"  -> Loaded {len(faculties_dim)} faculties into dim_faculty")
                print(f"  -> Loaded {len(faculties_dim)} faculties into dim_faculty")
        
        # Dim_Department - from source database
        if 'departments_db1' in silver_data and not silver_data['departments_db1'].empty:
            departments_dim = silver_data['departments_db1'].copy()
            # Map column names
            if 'DepartmentID' in departments_dim.columns:
                departments_dim['department_id'] = departments_dim['DepartmentID']
            if 'DepartmentName' in departments_dim.columns:
                departments_dim['department_name'] = departments_dim['DepartmentName']
            if 'FacultyID' in departments_dim.columns:
                departments_dim['faculty_id'] = departments_dim['FacultyID']
            if 'HeadOfDepartment' in departments_dim.columns:
                departments_dim['head_of_department'] = departments_dim['HeadOfDepartment']
            # Select only required columns
            dept_cols = ['department_id', 'department_name', 'faculty_id', 'head_of_department']
            available_cols = [col for col in dept_cols if col in departments_dim.columns]
            if available_cols:
                departments_dim = departments_dim[available_cols].drop_duplicates(subset=['department_id'], keep='first')
                with engine.connect() as conn:
                    conn.execute(text("DELETE FROM dim_department"))
                    conn.commit()
                departments_dim.to_sql('dim_department', engine, if_exists='append', index=False)
                self.logger.info(f"  -> Loaded {len(departments_dim)} departments into dim_department")
                print(f"  -> Loaded {len(departments_dim)} departments into dim_department")
        
        # Dim_Program - from source database
        if 'programs_db1' in silver_data and not silver_data['programs_db1'].empty:
            programs_dim = silver_data['programs_db1'].copy()
            # Map column names
            if 'ProgramID' in programs_dim.columns:
                programs_dim['program_id'] = programs_dim['ProgramID']
            if 'ProgramName' in programs_dim.columns:
                programs_dim['program_name'] = programs_dim['ProgramName']
            if 'DegreeLevel' in programs_dim.columns:
                programs_dim['degree_level'] = programs_dim['DegreeLevel']
            if 'DepartmentID' in programs_dim.columns:
                programs_dim['department_id'] = programs_dim['DepartmentID']
            if 'DurationYears' in programs_dim.columns:
                programs_dim['duration_years'] = programs_dim['DurationYears']
            # Select only required columns
            program_cols = ['program_id', 'program_name', 'degree_level', 'department_id', 'duration_years']
            available_cols = [col for col in program_cols if col in programs_dim.columns]
            if available_cols:
                programs_dim = programs_dim[available_cols].drop_duplicates(subset=['program_id'], keep='first')
                with engine.connect() as conn:
                    conn.execute(text("DELETE FROM dim_program"))
                    conn.commit()
                programs_dim.to_sql('dim_program', engine, if_exists='append', index=False)
                self.logger.info(f"  -> Loaded {len(programs_dim)} programs into dim_program")
                print(f"  -> Loaded {len(programs_dim)} programs into dim_program")
        
        # Dim_Employee (staff/lecturers) - from source database 2 (Administration)
        if 'employees_db2' in silver_data and not silver_data['employees_db2'].empty:
            employees_dim = silver_data['employees_db2'].copy()
            if 'EmployeeID' in employees_dim.columns:
                employees_dim['employee_id'] = employees_dim['EmployeeID']
            if 'FullName' in employees_dim.columns:
                employees_dim['full_name'] = employees_dim['FullName']
            if 'PositionID' in employees_dim.columns:
                employees_dim['position_id'] = employees_dim['PositionID']
            if 'DepartmentID' in employees_dim.columns:
                employees_dim['department_id'] = employees_dim['DepartmentID']
            if 'ContractType' in employees_dim.columns:
                employees_dim['contract_type'] = employees_dim['ContractType']
            if 'Status' in employees_dim.columns:
                employees_dim['status'] = employees_dim['Status']
            emp_cols = ['employee_id', 'full_name', 'position_id', 'department_id', 'contract_type', 'status']
            available_emp_cols = [c for c in emp_cols if c in employees_dim.columns]
            if available_emp_cols:
                employees_dim = employees_dim[available_emp_cols].drop_duplicates(subset=['employee_id'], keep='first')
                with engine.connect() as conn:
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS dim_employee (
                            employee_id INT PRIMARY KEY,
                            full_name VARCHAR(200),
                            position_id INT,
                            department_id INT,
                            contract_type VARCHAR(50),
                            status VARCHAR(50),
                            INDEX idx_department (department_id),
                            INDEX idx_status (status)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    """))
                    conn.commit()
                    conn.execute(text("DELETE FROM dim_employee"))
                    conn.commit()
                employees_dim.to_sql('dim_employee', engine, if_exists='append', index=False)
                self.logger.info(f"  -> Loaded {len(employees_dim)} employees (staff/lecturers) into dim_employee")
                print(f"  -> Loaded {len(employees_dim)} employees (staff/lecturers) into dim_employee")
        
    def _populate_time_dimension(self, engine):
        """Populate time dimension table"""
        self.logger.info("Populating time dimension...")
        print("Populating time dimension...")
        
        # Generate dates from 2022-01-01 to 2026-12-31 to cover all payment dates
        # This ensures we have dates for historical payments (2022) and future dates (2025-2026)
        dates = pd.date_range(start='2022-01-01', end='2026-12-31', freq='D')
        time_dim = pd.DataFrame({
            'date_key': [d.strftime('%Y%m%d') for d in dates],
            'date': dates,
            'year': dates.year,
            'quarter': dates.quarter,
            'month': dates.month,
            'month_name': dates.strftime('%B'),
            'day': dates.day,
            'day_of_week': dates.dayofweek,
            'day_name': dates.strftime('%A'),
            'is_weekend': dates.dayofweek >= 5
        })
        
        # Clear existing time dimension data first
        with engine.connect() as conn:
            conn.execute(text("DELETE FROM dim_time"))
            conn.commit()
        
        time_dim.to_sql('dim_time', engine, if_exists='append', index=False, method='multi', chunksize=1000)
        self.logger.info(f"  → Loaded {len(time_dim)} time dimension records")
        print("Time dimension populated!")
        
    def _create_time_dimension(self):
        """Create time dimension table (helper method)"""
        dates = pd.date_range(start='2023-01-01', end='2025-12-31', freq='D')
        time_dim = pd.DataFrame({
            'date_key': [d.strftime('%Y%m%d') for d in dates],
            'date': dates,
            'year': dates.year,
            'quarter': dates.quarter,
            'month': dates.month,
            'month_name': dates.strftime('%B'),
            'day': dates.day,
            'day_of_week': dates.dayofweek,
            'day_name': dates.strftime('%A'),
            'is_weekend': dates.dayofweek >= 5
        })
        return time_dim
    
    def _create_facts(self, engine, silver_data):
        """Create fact tables for star schema"""
        
        with engine.connect() as conn:
            # Fact_Enrollment
            conn.execute(text("DROP TABLE IF EXISTS fact_enrollment"))
            conn.execute(text("""
                CREATE TABLE fact_enrollment (
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """))
            
            # Fact_Attendance
            conn.execute(text("DROP TABLE IF EXISTS fact_attendance"))
            conn.execute(text("""
                CREATE TABLE fact_attendance (
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """))
            
            # Fact_Payment
            conn.execute(text("DROP TABLE IF EXISTS fact_payment"))
            conn.execute(text("""
                CREATE TABLE fact_payment (
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
                    payment_timestamp DATETIME,
                    semester_start_date DATE,
                    deadline_met BOOLEAN DEFAULT FALSE,
                    deadline_type VARCHAR(50),
                    weeks_from_deadline DECIMAL(5,2),
                    late_penalty DECIMAL(15,2) DEFAULT 0,
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """))
            
            # Fact_Grade
            conn.execute(text("DROP TABLE IF EXISTS fact_grade"))
            conn.execute(text("""
                CREATE TABLE fact_grade (
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
                    FOREIGN KEY (semester_id) REFERENCES dim_semester(semester_id) ON DELETE CASCADE,
                    INDEX idx_student (student_id),
                    INDEX idx_course (course_code),
                    INDEX idx_date (date_key),
                    INDEX idx_semester (semester_id),
                    INDEX idx_grade (grade)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """))
            conn.commit()
        
        # Fact_Enrollment
        enrollments = silver_data['enrollments'].copy()
        enrollments['date_key'] = pd.to_datetime(enrollments['enrollment_date'], errors='coerce').dt.strftime('%Y%m%d').fillna('')
        # Map UCU semester names to semester_id
        def map_ucu_semester_enroll(semester_str):
            if pd.isna(semester_str):
                return 1
            sem = str(semester_str).lower()
            if 'jan' in sem or 'easter' in sem:
                return 1  # Jan (Easter Semester)
            elif 'may' in sem or 'trinity' in sem:
                return 2  # May (Trinity Semester)
            elif 'september' in sem or 'advent' in sem:
                return 3  # September (Advent)
            else:
                return 1  # Default
        enrollments['semester_id'] = enrollments['semester'].apply(map_ucu_semester_enroll)
        
        # Filter out rows with invalid date_key (must exist in dim_time)
        fact_enrollment = enrollments[['enrollment_id', 'student_id', 'course_code', 
                                      'date_key', 'semester_id', 'status']].copy()
        fact_enrollment = fact_enrollment[fact_enrollment['date_key'] != '']  # Remove invalid dates
        
        # Filter to only include students that exist in dim_student
        if not fact_enrollment.empty:
            with engine.connect() as conn:
                valid_students = pd.read_sql_query("SELECT student_id FROM dim_student", conn)
            valid_student_ids = set(valid_students['student_id'].tolist())
            fact_enrollment = fact_enrollment[fact_enrollment['student_id'].isin(valid_student_ids)]
        
        if not fact_enrollment.empty:
            fact_enrollment.to_sql('fact_enrollment', engine, if_exists='append', index=False, method='multi', chunksize=50)
            self.logger.info(f"  → Loaded {len(fact_enrollment)} enrollments into fact_enrollment")
        else:
            self.logger.warning("  → No enrollment data to load")
        
        # Fact_Attendance
        attendance = silver_data['attendance'].copy()
        attendance['date_key'] = pd.to_datetime(attendance['attendance_date'], errors='coerce').dt.strftime('%Y%m%d').fillna('')
        
        # Filter out rows with invalid dates
        attendance = attendance[attendance['date_key'] != '']
        
        # Filter to only include students that exist in dim_student
        if not attendance.empty:
            # Get list of valid student_ids from dim_student
            with engine.connect() as conn:
                valid_students = pd.read_sql_query("SELECT student_id FROM dim_student", conn)
            valid_student_ids = set(valid_students['student_id'].tolist())
            attendance = attendance[attendance['student_id'].isin(valid_student_ids)]
        
        if not attendance.empty:
            # Aggregate attendance by student, course, and date
            # Check which columns exist
            agg_dict = {'hours_attended': 'sum'}
            if 'Status' in attendance.columns:
                agg_dict['Status'] = lambda x: (x == 'Present').sum() if len(x) > 0 and 'Present' in x.values else 0
            elif 'status' in attendance.columns:
                agg_dict['status'] = lambda x: (x == 'Present').sum() if len(x) > 0 and 'Present' in x.values else 0
            
            attendance_agg = attendance.groupby(['student_id', 'course_code', 'date_key']).agg(agg_dict).reset_index()
            
            # Rename columns appropriately
            if 'Status' in attendance_agg.columns or 'status' in attendance_agg.columns:
                status_col = 'Status' if 'Status' in attendance_agg.columns else 'status'
                attendance_agg.columns = ['student_id', 'course_code', 'date_key', 
                                          'total_hours', 'days_present']
            else:
                # If no status column, calculate days_present from hours_attended
                attendance_agg['days_present'] = (attendance_agg['hours_attended'] > 0).astype(int)
                attendance_agg.columns = ['student_id', 'course_code', 'date_key', 
                                          'total_hours', 'days_present']
            
            fact_attendance = attendance_agg.copy()
            fact_attendance.to_sql('fact_attendance', engine, if_exists='append', index=False, method='multi', chunksize=50)
            self.logger.info(f"  → Loaded {len(fact_attendance)} attendance records into fact_attendance")
        else:
            self.logger.warning("  → No attendance data to load")
        
        # Fact_Payment
        payments = silver_data['payments'].copy()
        payments['date_key'] = pd.to_datetime(payments['payment_date'], errors='coerce').dt.strftime('%Y%m%d').fillna('')
        
        # Map UCU semester names to semester_id
        # UCU semesters: Jan (Easter Semester), May (Trinity Semester), September (Advent)
        def map_ucu_semester(semester_str):
            if pd.isna(semester_str):
                return 1
            sem = str(semester_str).lower()
            if 'jan' in sem or 'easter' in sem:
                return 1  # Jan (Easter Semester)
            elif 'may' in sem or 'trinity' in sem:
                return 2  # May (Trinity Semester)
            elif 'september' in sem or 'advent' in sem:
                return 3  # September (Advent)
            else:
                return 1  # Default
        payments['semester_id'] = payments['semester'].apply(map_ucu_semester)
        
        # Extract year if present, otherwise from payment_date
        if 'year' in payments.columns:
            payments['year'] = pd.to_numeric(payments['year'], errors='coerce').fillna(payments['payment_date'].dt.year.fillna(datetime.now().year))
        else:
            payments['year'] = pd.to_datetime(payments['payment_date'], errors='coerce').dt.year.fillna(datetime.now().year)
        
        # Extract fee breakdown
        if 'tuition_national' in payments.columns:
            payments['tuition_national'] = pd.to_numeric(payments['tuition_national'], errors='coerce').fillna(0)
        else:
            payments['tuition_national'] = 0
        
        if 'tuition_international' in payments.columns:
            payments['tuition_international'] = pd.to_numeric(payments['tuition_international'], errors='coerce').fillna(0)
        else:
            payments['tuition_international'] = 0
        
        if 'functional_fees' in payments.columns:
            payments['functional_fees'] = pd.to_numeric(payments['functional_fees'], errors='coerce').fillna(0)
        else:
            payments['functional_fees'] = 0
        
        # Determine student_type based on which tuition is non-zero
        payments['student_type'] = payments.apply(
            lambda row: 'international' if row['tuition_international'] > 0 else 'national', axis=1
        )
        
        # Extract payment timestamp
        if 'payment_timestamp' in payments.columns:
            payments['payment_timestamp'] = pd.to_datetime(payments['payment_timestamp'], errors='coerce')
        elif 'payment_date' in payments.columns:
            payments['payment_timestamp'] = pd.to_datetime(payments['payment_date'], errors='coerce')
        else:
            payments['payment_timestamp'] = pd.to_datetime(datetime.now())
        
        # Extract semester start date for deadline calculation
        if 'semester_start_date' in payments.columns:
            payments['semester_start_date'] = pd.to_datetime(payments['semester_start_date'], errors='coerce')
        else:
            # Default semester start dates based on semester and year
            def get_semester_start_date(row):
                semester_id = row['semester_id']
                year = int(row['year']) if pd.notna(row['year']) else datetime.now().year
                if semester_id == 1:  # Jan (Easter)
                    return pd.Timestamp(f'{year}-01-15')
                elif semester_id == 2:  # May (Trinity)
                    return pd.Timestamp(f'{year}-05-15')
                elif semester_id == 3:  # September (Advent)
                    return pd.Timestamp(f'{year}-08-29')  # Based on the image provided
                else:
                    return pd.Timestamp(f'{year}-01-15')
            payments['semester_start_date'] = payments.apply(get_semester_start_date, axis=1)
        
        # Calculate deadline compliance using payment deadlines utility
        try:
            import sys
            from pathlib import Path
            # Add backend directory to path for imports
            backend_dir = Path(__file__).parent
            if str(backend_dir) not in sys.path:
                sys.path.insert(0, str(backend_dir))
            
            from utils.payment_deadlines import calculate_payment_deadlines, get_current_deadline_status
            from datetime import timedelta
            
            def check_deadline_compliance(row):
                """Check if payment meets deadline requirements"""
                try:
                    payment_date = pd.to_datetime(row['payment_timestamp'])
                    semester_start = pd.to_datetime(row['semester_start_date'])
                    
                    if pd.isna(payment_date) or pd.isna(semester_start):
                        return {
                            'deadline_met': False,
                            'deadline_type': None,
                            'weeks_from_deadline': None,
                            'late_penalty': 0
                        }
                    
                    # Calculate deadlines for this semester
                    semester_start_str = semester_start.strftime('%Y-%m-%d')
                    deadlines = calculate_payment_deadlines(semester_start_str)
                    
                    # Find which deadline this payment relates to
                    deadline_met = False
                    deadline_type = None
                    weeks_from_deadline = None
                    late_penalty = 0
                    
                    for deadline in deadlines:
                        deadline_date = pd.to_datetime(deadline['deadline_date'], format='%d-%m-%Y')
                        weeks_from_start = deadline['weeks_from_semester_start']
                        
                        # Calculate weeks from deadline
                        days_diff = (payment_date - deadline_date).days
                        weeks_diff = days_diff / 7.0
                        
                        # Check if payment is before or on deadline
                        if payment_date <= deadline_date:
                            deadline_met = True
                            deadline_type = deadline['deadline_type']
                            weeks_from_deadline = -weeks_diff  # Negative means before deadline
                            break
                        elif deadline_type is None:
                            # Payment is after this deadline, check next one
                            deadline_type = deadline['deadline_type']
                            weeks_from_deadline = weeks_diff
                            
                            # Calculate late penalty if applicable
                            if 'penalty_percentage' in deadline:
                                penalty_pct = deadline['penalty_percentage']
                                # Calculate penalty on outstanding amount
                                total_required = row.get('tuition_national', 0) + row.get('tuition_international', 0) + row.get('functional_fees', 0)
                                amount_paid = row.get('amount', 0)
                                outstanding = max(0, total_required - amount_paid)
                                late_penalty = outstanding * (penalty_pct / 100)
                    
                    # If payment is after all deadlines, it's late
                    if not deadline_met:
                        # Find the latest deadline that was passed
                        if deadline_type and 'late_penalty' in deadline_type:
                            # Already calculated penalty above
                            pass
                        else:
                            # Calculate penalty based on latest deadline
                            latest_deadline = deadlines[-1]
                            if 'penalty_percentage' in latest_deadline:
                                total_required = row.get('tuition_national', 0) + row.get('tuition_international', 0) + row.get('functional_fees', 0)
                                amount_paid = row.get('amount', 0)
                                outstanding = max(0, total_required - amount_paid)
                                late_penalty = outstanding * (latest_deadline['penalty_percentage'] / 100)
                            # Set deadline_type to latest if not set
                            if not deadline_type:
                                deadline_type = latest_deadline['deadline_type']
                                # Calculate weeks from latest deadline
                                latest_deadline_date = pd.to_datetime(latest_deadline['deadline_date'], format='%d-%m-%Y')
                                days_diff = (payment_date - latest_deadline_date).days
                                weeks_from_deadline = days_diff / 7.0
                    
                    return {
                        'deadline_met': deadline_met,
                        'deadline_type': deadline_type,
                        'weeks_from_deadline': round(weeks_from_deadline, 2) if weeks_from_deadline is not None else None,
                        'late_penalty': round(late_penalty, 2)
                    }
                except Exception as e:
                    self.logger.warning(f"Error checking deadline compliance: {e}")
                    return {
                        'deadline_met': False,
                        'deadline_type': None,
                        'weeks_from_deadline': None,
                        'late_penalty': 0
                    }
            
            # Apply deadline checking to each payment
            deadline_results = payments.apply(check_deadline_compliance, axis=1)
            payments['deadline_met'] = deadline_results.apply(lambda x: x['deadline_met'])
            payments['deadline_type'] = deadline_results.apply(lambda x: x['deadline_type'])
            payments['weeks_from_deadline'] = deadline_results.apply(lambda x: x['weeks_from_deadline'])
            payments['late_penalty'] = deadline_results.apply(lambda x: x['late_penalty'])
            
        except ImportError:
            self.logger.warning("Payment deadlines utility not found, skipping deadline compliance checking")
            payments['deadline_met'] = False
            payments['deadline_type'] = None
            payments['weeks_from_deadline'] = None
            payments['late_penalty'] = 0
        except Exception as e:
            self.logger.warning(f"Error in deadline compliance checking: {e}")
            payments['deadline_met'] = False
            payments['deadline_type'] = None
            payments['weeks_from_deadline'] = None
            payments['late_penalty'] = 0
        
        # Filter out rows with invalid dates
        fact_payment_cols = ['payment_id', 'student_id', 'date_key', 'semester_id', 'year',
                            'tuition_national', 'tuition_international', 'functional_fees',
                            'amount', 'payment_method', 'status', 'student_type',
                            'payment_timestamp', 'semester_start_date', 'deadline_met',
                            'deadline_type', 'weeks_from_deadline', 'late_penalty']
        available_cols = [col for col in fact_payment_cols if col in payments.columns]
        fact_payment = payments[available_cols].copy()
        fact_payment = fact_payment[fact_payment['date_key'] != '']  # Remove invalid dates
        
        # Filter to only include date_keys that exist in dim_time
        if not fact_payment.empty:
            with engine.connect() as conn:
                valid_dates = pd.read_sql_query("SELECT date_key FROM dim_time", conn)
            valid_date_keys = set(valid_dates['date_key'].astype(str).tolist())
            initial_count = len(fact_payment)
            fact_payment = fact_payment[fact_payment['date_key'].astype(str).isin(valid_date_keys)]
            if initial_count > len(fact_payment):
                self.logger.warning(f"  → Filtered out {initial_count - len(fact_payment)} payment records with invalid date_keys")
        
        # Filter to only include students that exist in dim_student
        if not fact_payment.empty:
            with engine.connect() as conn:
                valid_students = pd.read_sql_query("SELECT student_id FROM dim_student", conn)
            valid_student_ids = set(valid_students['student_id'].tolist())
            initial_count = len(fact_payment)
            fact_payment = fact_payment[fact_payment['student_id'].isin(valid_student_ids)]
            if initial_count > len(fact_payment):
                self.logger.warning(f"  → Filtered out {initial_count - len(fact_payment)} payment records with invalid student_ids")
        
        if not fact_payment.empty:
            fact_payment.to_sql('fact_payment', engine, if_exists='append', index=False, method='multi', chunksize=50)
            self.logger.info(f"  → Loaded {len(fact_payment)} payments into fact_payment")
        else:
            self.logger.warning("  → No payment data to load")
        
        # Fact_Grade
        grades = silver_data['grades'].copy()
        grades['date_key'] = pd.to_datetime(grades['exam_date'], errors='coerce').dt.strftime('%Y%m%d').fillna('')
        # Map UCU semester names to semester_id
        def map_ucu_semester_grade(semester_str):
            if pd.isna(semester_str):
                return 1
            sem = str(semester_str).lower()
            if 'jan' in sem or 'easter' in sem:
                return 1  # Jan (Easter Semester)
            elif 'may' in sem or 'trinity' in sem:
                return 2  # May (Trinity Semester)
            elif 'september' in sem or 'advent' in sem:
                return 3  # September (Advent)
            else:
                return 1  # Default
        grades['semester_id'] = grades['semester'].apply(map_ucu_semester_grade)
        
        # Filter out rows with invalid dates
        # Ensure all required columns exist
        if 'coursework_score' not in grades.columns:
            grades['coursework_score'] = 0.0
        if 'exam_score' not in grades.columns:
            grades['exam_score'] = None
        if 'fcw' not in grades.columns:
            grades['fcw'] = False
        if 'exam_status' not in grades.columns:
            grades['exam_status'] = 'Completed'
        if 'absence_reason' not in grades.columns:
            grades['absence_reason'] = ''
        
        grade_cols = ['grade_id', 'student_id', 'course_code', 'date_key', 
                     'semester_id', 'coursework_score', 'exam_score', 'grade', 
                     'letter_grade', 'fcw', 'exam_status', 'absence_reason']
        
        fact_grade = grades[grade_cols].copy()
        fact_grade = fact_grade[fact_grade['date_key'] != '']  # Remove invalid dates
        
        # Filter to only include students that exist in dim_student
        if not fact_grade.empty:
            with engine.connect() as conn:
                valid_students = pd.read_sql_query("SELECT student_id FROM dim_student", conn)
            valid_student_ids = set(valid_students['student_id'].tolist())
            fact_grade = fact_grade[fact_grade['student_id'].isin(valid_student_ids)]
        
        if not fact_grade.empty:
            fact_grade.to_sql('fact_grade', engine, if_exists='append', index=False, method='multi', chunksize=50)
            self.logger.info(f"  → Loaded {len(fact_grade)} grades into fact_grade")
        else:
            self.logger.warning("  → No grade data to load")
    
    def run(self):
        """Run the complete ETL pipeline"""
        start_time = datetime.now()
        self.logger.info("=" * 60)
        self.logger.info("ETL PIPELINE STARTED")
        self.logger.info(f"Start time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        self.logger.info("=" * 60)
        print("Starting ETL Pipeline...")
        print(f"Log file: {self.log_file}")
        
        try:
            bronze_data = self.extract()
            silver_data = self.transform(bronze_data)
            self.load_to_warehouse(silver_data)
            
            end_time = datetime.now()
            duration = end_time - start_time
            self.logger.info(f"ETL Pipeline completed successfully in {duration}")
            print("ETL Pipeline completed successfully!")
            print(f"Duration: {duration}")
            print(f"Log file: {self.log_file}")
        except Exception as e:
            end_time = datetime.now()
            duration = end_time - start_time
            self.logger.error(f"ETL Pipeline failed after {duration}: {e}", exc_info=True)
            print(f"ETL Pipeline failed: {e}")
            print(f"Check log file for details: {self.log_file}")
            raise

if __name__ == "__main__":
    pipeline = ETLPipeline()
    pipeline.run()
