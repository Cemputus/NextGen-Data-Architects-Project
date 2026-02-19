"""
Setup script to create source databases with realistic UCU data
Uses MySQL - Generates 1000+ entries per table
"""
import pymysql
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
from pathlib import Path
from sqlalchemy import create_engine, text
from config import (
    MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD,
    DB1_NAME, DB2_NAME, CSV1_PATH, CSV2_PATH,
    get_pymysql_params, DB1_CONN_STRING, DB2_CONN_STRING
)

# Set seeds for reproducibility
np.random.seed(42)
random.seed(42)

# Create data directory
Path(CSV1_PATH).parent.mkdir(parents=True, exist_ok=True)

# Realistic Ugandan names pool
UGANDAN_FIRST_NAMES = [
    "John", "Mary", "Peter", "Sarah", "David", "Grace", "James", "Ruth", "Michael", "Esther",
    "Paul", "Joy", "Daniel", "Faith", "Joseph", "Hope", "Andrew", "Peace", "Mark", "Mercy",
    "Luke", "Patience", "Stephen", "Priscilla", "Samuel", "Rebecca", "Joshua", "Hannah",
    "Isaac", "Deborah", "Solomon", "Esther", "Timothy", "Ruth", "Nathan", "Naomi",
    "Benjamin", "Miriam", "Caleb", "Rachel", "Aaron", "Leah", "Moses", "Martha",
    "Jonathan", "Elizabeth", "Simon", "Mary", "Thomas", "Sarah", "Philip", "Anna",
    "Matthew", "Lydia", "Barnabas", "Phoebe", "Silas", "Dorcas", "Titus", "Priscilla"
]

UGANDAN_LAST_NAMES = [
    "Mukasa", "Nakato", "Kato", "Nalubega", "Ssemwogerere", "Nabukeera", "Mugerwa", "Nakazibwe",
    "Kawuma", "Nalubwama", "Ssempijja", "Nabatanzi", "Mugisha", "Nakayiza", "Kasozi", "Nalubega",
    "Ssebunya", "Nabukeera", "Kawesa", "Nakiyemba", "Mugabi", "Nabukenya", "Ssekyanzi", "Nakiganda",
    "Kawuki", "Nalwanga", "Mugenyi", "Nabwami", "Ssemakula", "Nakibuka", "Kawere", "Nalubowa",
    "Mugume", "Nabukeera", "Ssebowa", "Nakigudde", "Kawalya", "Nalubega", "Mugisha", "Nabukeera",
    "Ssemogerere", "Nakato", "Kawuma", "Nalubega", "Mugerwa", "Nakazibwe", "Kawuma", "Nalubwama"
]

# Popular Uganda High Schools (for realistic data generation)
UGANDAN_HIGH_SCHOOLS = [
    # Kampala District
    ("King's College Budo", "Kampala"), ("Ntare School", "Kampala"), ("St. Mary's College Kisubi", "Kampala"),
    ("Gayaza High School", "Kampala"), ("Namagunga Girls School", "Kampala"), ("Nabisunsa Girls School", "Kampala"),
    ("Trinity College Nabbingo", "Kampala"), ("Seeta High School", "Kampala"), ("St. Lawrence Schools", "Kampala"),
    ("Uganda Martyrs High School", "Kampala"), ("Makerere College School", "Kampala"), ("Lubiri Secondary School", "Kampala"),
    # Wakiso District
    ("St. Mary's Secondary School Kitende", "Wakiso"), ("Kibuli Secondary School", "Wakiso"),
    ("St. Joseph's Secondary School Naggalama", "Wakiso"), ("Kiira College Butiki", "Wakiso"),
    # Mukono District
    ("St. Joseph's Secondary School Mukono", "Mukono"), ("Uganda Christian University High School", "Mukono"),
    # Other Districts
    ("Busoga College Mwiri", "Jinja"), ("Jinja Secondary School", "Jinja"), ("Kiira College Butiki", "Jinja"),
    ("St. Henry's College Kitovu", "Masaka"), ("Masaka Secondary School", "Masaka"),
    ("Mbarara High School", "Mbarara"), ("Ntare School Mbarara", "Mbarara"),
    ("Gulu High School", "Gulu"), ("St. Joseph's Layibi", "Gulu"),
    ("Lira Town College", "Lira"), ("St. Katherine's Secondary School", "Lira"),
    ("Mbale Secondary School", "Mbale"), ("Nabumali High School", "Mbale"),
    ("Tororo Girls School", "Tororo"), ("St. Peter's College Tororo", "Tororo"),
    ("Arua Public Secondary School", "Arua"), ("Muni Girls School", "Arua"),
    ("Fort Portal Secondary School", "Fort Portal"), ("St. Leo's College Fort Portal", "Fort Portal"),
    ("Hoima Secondary School", "Hoima"), ("Duhaga Secondary School", "Hoima"),
    ("Kabarole Secondary School", "Kabarole"), ("St. Mary's College Rushoroza", "Kabarole"),
    ("Soroti Secondary School", "Soroti"), ("Ngora High School", "Soroti"),
    ("Iganga Secondary School", "Iganga"), ("Busoga High School", "Iganga"),
    ("Kamuli Secondary School", "Kamuli"), ("Namasagali College", "Kamuli"),
    ("Pallisa Secondary School", "Pallisa"), ("Kumi Secondary School", "Kumi"),
    ("Moroto High School", "Moroto"), ("Kotido Secondary School", "Kotido"),
    ("Nebbi Secondary School", "Nebbi"), ("Pakwach Secondary School", "Nebbi"),
    ("Kasese Secondary School", "Kasese"), ("St. Charles Lwanga Secondary School", "Kasese"),
    ("Bundibugyo Secondary School", "Bundibugyo"), ("Kyenjojo Secondary School", "Kyenjojo"),
    ("Kiboga Secondary School", "Kiboga"), ("Mityana Secondary School", "Mityana"),
    ("Mubende Secondary School", "Mubende"), ("Kakumiro Secondary School", "Kakumiro"),
    ("Kibale Secondary School", "Kibale"), ("Kyegegwa Secondary School", "Kyegegwa"),
    ("Sembabule Secondary School", "Sembabule"), ("Rakai Secondary School", "Rakai"),
    ("Kalangala Secondary School", "Kalangala"), ("Bukomansimbi Secondary School", "Bukomansimbi"),
    ("Gomba Secondary School", "Gomba"), ("Butambala Secondary School", "Butambala"),
    ("Mpigi Secondary School", "Mpigi"), ("Gomba Secondary School", "Mpigi"),
    ("Kalungu Secondary School", "Kalungu"), ("Lwengo Secondary School", "Lwengo"),
    ("Lyantonde Secondary School", "Lyantonde"), ("Rakai Secondary School", "Rakai"),
    ("Kyotera Secondary School", "Kyotera"), ("Bukomansimbi Secondary School", "Bukomansimbi")
]

def create_database_if_not_exists(database_name):
    """Create MySQL database if it doesn't exist"""
    try:
        conn = pymysql.connect(
            host=MYSQL_HOST,
            port=int(MYSQL_PORT),
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            charset='utf8mb4'
        )
        cursor = conn.cursor()
        cursor.execute(f"SHOW DATABASES LIKE '{database_name}'")
        if cursor.fetchone() is None:
            cursor.execute(f"CREATE DATABASE `{database_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            print(f"Database {database_name} created successfully")
        else:
            print(f"Database {database_name} already exists")
        conn.close()
    except Exception as e:
        print(f"Error creating database {database_name}: {e}")
        raise

def execute_sql_file(engine, sql_file_path):
    """Execute SQL file"""
    try:
        with open(sql_file_path, 'r', encoding='utf-8') as f:
            sql_script = f.read()
        statements = [s.strip() for s in sql_script.split(';') if s.strip() and not s.strip().startswith('--')]
        with engine.connect() as conn:
            for statement in statements:
                if statement:
                    try:
                        conn.execute(text(statement))
                    except Exception as e:
                        if 'already exists' not in str(e).lower():
                            print(f"Warning: {e}")
            conn.commit()
    except FileNotFoundError:
        return False
    except Exception as e:
        print(f"Error executing SQL file: {e}")
        return False
    return True

# ==================== ACADEMICS DATABASE (DB1) ====================

def generate_faculties():
    """Generate Faculties data based on UCU actual structure - 11 Faculties/Schools"""
    from ucu_actual_data import UCU_FACULTIES
    faculties = []
    for fac in UCU_FACULTIES:
        faculties.append({
            'FacultyID': fac['id'],
            'FacultyName': fac['name'],
            'DeanName': fac['dean']
        })
    return pd.DataFrame(faculties)

def generate_departments(faculties_df):
    """Generate Departments data based on UCU actual structure with exact departments"""
    from ucu_actual_data import UCU_STRUCTURE
    departments = []
    dept_id = 1
    
    # Extract unique (faculty_id, department_name) pairs from UCU_STRUCTURE
    dept_map = {}
    for faculty_id, dept_name, _, _, _, _, _ in UCU_STRUCTURE:
        if (faculty_id, dept_name) not in dept_map:
            dept_map[(faculty_id, dept_name)] = dept_id
            head_names = [f"Dr. {random.choice(UGANDAN_FIRST_NAMES)} {random.choice(UGANDAN_LAST_NAMES)}" 
                         for _ in range(3)]
            departments.append({
                'DepartmentID': dept_id,
                'DepartmentName': dept_name,
                'FacultyID': faculty_id,
                'HeadOfDepartment': random.choice(head_names)
            })
            dept_id += 1
    
    return pd.DataFrame(departments)

def generate_programs(departments_df):
    """Generate Programs data based on UCU actual structure with exact department mapping"""
    from ucu_actual_data import UCU_STRUCTURE
    programs = []
    program_id = 1
    
    # Create a mapping from (faculty_id, department_name) to department_id
    dept_name_to_id = {}
    for _, dept in departments_df.iterrows():
        key = (dept['FacultyID'], dept['DepartmentName'])
        dept_name_to_id[key] = dept['DepartmentID']
    
    # Map UCU programs to their exact departments
    for faculty_id, dept_name, prog_name, duration, tuition_nat, tuition_non_nat, degree_level in UCU_STRUCTURE:
        key = (faculty_id, dept_name)
        if key in dept_name_to_id:
            dept_id = dept_name_to_id[key]
            programs.append({
                'ProgramID': program_id,
                'ProgramName': prog_name,
                'DegreeLevel': degree_level,
                'DepartmentID': dept_id,
                'DurationYears': duration,
                'TuitionNationals': tuition_nat,
                'TuitionNonNationals': tuition_non_nat
            })
            program_id += 1
        else:
            print(f"Warning: Department '{dept_name}' not found for faculty {faculty_id}")
    
    return pd.DataFrame(programs)

def generate_courses(programs_df):
    """Generate Courses data - 1000+ entries with program-specific realistic courses"""
    courses = []
    course_id = 1
    
    # Program-specific course mappings with realistic course names
    program_courses = {
        # Computer Science & IT Programs
        'BSc Computer Science': [
            ('CSC1101', 'Introduction to Computer Science', 3),
            ('CSC1102', 'Programming Fundamentals', 4),
            ('CSC2101', 'Data Structures and Algorithms', 4),
            ('CSC2102', 'Object-Oriented Programming', 3),
            ('CSC2103', 'Database Systems', 3),
            ('CSC2201', 'Computer Networks', 3),
            ('CSC3101', 'Software Engineering', 4),
            ('CSC3102', 'Operating Systems', 3),
            ('CSC3201', 'Web Development', 3),
            ('CSC3202', 'Mobile Application Development', 3),
            ('CSC4101', 'Machine Learning', 4),
            ('CSC4102', 'Data Warehousing', 3),
            ('CSC4201', 'Project Management', 3),
            ('CSC4202', 'Final Year Project', 6),
        ],
        'BSc Information Technology': [
            ('BIT1101', 'Introduction to IT', 3),
            ('BIT1102', 'IT Fundamentals', 3),
            ('BIT2101', 'Systems Analysis and Design', 3),
            ('BIT2102', 'Database Management', 3),
            ('BIT2103', 'Web Programming', 4),
            ('BIT2201', 'Network Administration', 3),
            ('BIT3101', 'IT Project Management', 3),
            ('BIT3102', 'Information Security', 3),
            ('BIT3201', 'E-Commerce Systems', 3),
            ('BIT3202', 'Cloud Computing', 3),
            ('BIT4101', 'IT Strategy', 3),
            ('BIT4201', 'IT Capstone Project', 6),
        ],
        'BSc Software Engineering': [
            ('SWE1101', 'Introduction to Software Engineering', 3),
            ('SWE1102', 'Programming Principles', 4),
            ('SWE2101', 'Software Design Patterns', 3),
            ('SWE2102', 'Software Testing', 3),
            ('SWE2201', 'Software Architecture', 3),
            ('SWE3101', 'Agile Development', 3),
            ('SWE3102', 'Software Quality Assurance', 3),
            ('SWE3201', 'DevOps Practices', 3),
            ('SWE4101', 'Software Project Management', 3),
            ('SWE4201', 'Software Engineering Project', 6),
        ],
        # Business Programs
        'BBA': [
            ('BUS1101', 'Introduction to Business', 3),
            ('BUS1102', 'Business Mathematics', 3),
            ('BUS2101', 'Principles of Management', 3),
            ('BUS2102', 'Business Communication', 2),
            ('BUS2201', 'Organizational Behavior', 3),
            ('BUS3101', 'Strategic Management', 3),
            ('BUS3102', 'Business Ethics', 2),
            ('BUS3201', 'Entrepreneurship', 3),
            ('BUS4101', 'Business Research Methods', 3),
            ('BUS4201', 'Business Capstone Project', 6),
        ],
        'BSc Accounting & Finance': [
            ('ACC1101', 'Introduction to Accounting', 3),
            ('ACC1102', 'Financial Accounting I', 4),
            ('ACC2101', 'Financial Accounting II', 4),
            ('ACC2102', 'Cost Accounting', 3),
            ('ACC2105', 'Financial Reporting', 4),
            ('FIN2101', 'Corporate Finance', 3),
            ('FIN3101', 'Investment Analysis', 3),
            ('ACC3101', 'Auditing', 3),
            ('ACC3102', 'Taxation', 3),
            ('FIN4101', 'Financial Management', 3),
            ('ACC4201', 'Accounting Research Project', 6),
        ],
        'BSc Finance': [
            ('FIN1101', 'Introduction to Finance', 3),
            ('FIN1102', 'Financial Markets', 3),
            ('FIN2101', 'Corporate Finance', 3),
            ('FIN2102', 'Financial Analysis', 3),
            ('FIN3101', 'Investment Analysis', 3),
            ('FIN3102', 'Risk Management', 3),
            ('FIN3201', 'International Finance', 3),
            ('FIN4101', 'Financial Management', 3),
            ('FIN4102', 'Portfolio Management', 3),
            ('FIN4201', 'Finance Capstone Project', 6),
        ],
        # Law Programs
        'LLB': [
            ('LAW1101', 'Introduction to Law', 3),
            ('LAW1102', 'Legal Methods', 3),
            ('LAW2101', 'Constitutional Law', 4),
            ('LAW2102', 'Criminal Law', 4),
            ('LAW2103', 'Contract Law', 4),
            ('LAW2201', 'Tort Law', 3),
            ('LAW3101', 'Commercial Law', 4),
            ('LAW3102', 'Property Law', 3),
            ('LAW3201', 'International Law', 3),
            ('LAW4101', 'Legal Research and Writing', 3),
            ('LAW4102', 'Moot Court Practice', 2),
            ('LAW4201', 'Legal Internship', 6),
        ],
        # Education Programs
        'BEd': [
            ('EDU1101', 'Introduction to Education', 3),
            ('EDU1102', 'Educational Psychology', 3),
            ('EDU2101', 'Curriculum Development', 3),
            ('EDU2102', 'Teaching Methods', 4),
            ('EDU2201', 'Classroom Management', 3),
            ('EDU3101', 'Assessment and Evaluation', 3),
            ('EDU3102', 'Educational Technology', 3),
            ('EDU3201', 'Special Needs Education', 3),
            ('EDU4101', 'Educational Research', 3),
            ('EDU4201', 'Teaching Practice', 6),
        ],
        # Journalism & Media Programs
        'BA Journalism': [
            ('JRN1101', 'Introduction to Journalism', 3),
            ('JRN1102', 'News Writing', 3),
            ('JRN2101', 'Feature Writing', 3),
            ('JRN2102', 'Broadcast Journalism', 3),
            ('JRN2201', 'Photojournalism', 3),
            ('JRN3101', 'Investigative Journalism', 3),
            ('JRN3102', 'Media Ethics', 2),
            ('JRN3201', 'Digital Journalism', 3),
            ('JRN4101', 'Journalism Project', 6),
        ],
        # Medicine Programs
        'MBChB': [
            ('MED1101', 'Human Anatomy', 4),
            ('MED1102', 'Human Physiology', 4),
            ('MED2101', 'Biochemistry', 3),
            ('MED2102', 'Pathology', 4),
            ('MED2201', 'Pharmacology', 3),
            ('MED3101', 'Internal Medicine', 4),
            ('MED3102', 'Surgery', 4),
            ('MED3201', 'Pediatrics', 3),
            ('MED4101', 'Obstetrics and Gynecology', 3),
            ('MED4201', 'Clinical Rotations', 12),
        ],
        # Dentistry Programs
        'BDS': [
            ('DEN1101', 'Dental Anatomy', 3),
            ('DEN1102', 'Oral Biology', 3),
            ('DEN2101', 'Oral Pathology', 3),
            ('DEN2102', 'Preventive Dentistry', 3),
            ('DEN2201', 'Restorative Dentistry', 4),
            ('DEN3101', 'Oral Surgery', 3),
            ('DEN3102', 'Orthodontics', 3),
            ('DEN3201', 'Prosthodontics', 3),
            ('DEN4101', 'Clinical Dentistry', 6),
        ],
        # Nursing Programs
        'BSc Nursing': [
            ('NUR1101', 'Introduction to Nursing', 3),
            ('NUR1102', 'Human Anatomy and Physiology', 4),
            ('NUR2101', 'Medical-Surgical Nursing', 4),
            ('NUR2102', 'Pharmacology for Nurses', 3),
            ('NUR2201', 'Maternal and Child Health', 3),
            ('NUR3101', 'Community Health Nursing', 3),
            ('NUR3102', 'Mental Health Nursing', 3),
            ('NUR3201', 'Nursing Research', 3),
            ('NUR4101', 'Nursing Leadership', 3),
            ('NUR4201', 'Clinical Practice', 6),
        ],
        # Theology Programs
        'BDiv': [
            ('THE1101', 'Introduction to Theology', 3),
            ('THE1102', 'Biblical Studies I', 3),
            ('THE2101', 'Biblical Studies II', 3),
            ('THE2102', 'Church History', 3),
            ('THE2201', 'Systematic Theology', 3),
            ('THE3101', 'Pastoral Care', 3),
            ('THE3102', 'Christian Ethics', 2),
            ('THE3201', 'Preaching', 3),
            ('THE4101', 'Theological Research', 3),
            ('THE4201', 'Ministry Internship', 6),
        ],
        # Social Work Programs
        'BSW': [
            ('SWK1101', 'Introduction to Social Work', 3),
            ('SWK1102', 'Human Behavior', 3),
            ('SWK2101', 'Social Work Practice', 3),
            ('SWK2102', 'Social Policy', 3),
            ('SWK2201', 'Community Development', 3),
            ('SWK3101', 'Counseling Skills', 3),
            ('SWK3102', 'Social Work Research', 3),
            ('SWK3201', 'Field Practice', 6),
        ],
        # Agriculture Programs
        'BSc Agriculture': [
            ('AGR1101', 'Introduction to Agriculture', 3),
            ('AGR1102', 'Soil Science', 3),
            ('AGR2101', 'Crop Production', 4),
            ('AGR2102', 'Animal Science', 3),
            ('AGR2201', 'Agricultural Economics', 3),
            ('AGR3101', 'Agricultural Extension', 3),
            ('AGR3102', 'Agribusiness', 3),
            ('AGR3201', 'Sustainable Agriculture', 3),
            ('AGR4101', 'Agricultural Research', 3),
            ('AGR4201', 'Agricultural Project', 6),
        ],
    }
    
    # Course prefix mapping for programs not in the dictionary
    default_prefixes = {
        'Computer Science': 'CSC', 'Information Technology': 'BIT', 'IT': 'BIT',
        'Software Engineering': 'SWE', 'Data Science': 'DSC',
        'Business': 'BUS', 'Accounting': 'ACC', 'Finance': 'FIN', 'Marketing': 'MKT',
        'Law': 'LAW', 'Education': 'EDU', 'Nursing': 'NUR', 'Medicine': 'MED',
        'Dentistry': 'DEN', 'Theology': 'THE', 'Social Work': 'SWK',
        'Agriculture': 'AGR', 'Journalism': 'JRN', 'Media': 'MED', 'Communication': 'COM'
    }
    
    for prog_id, prog_name, degree_level in zip(
        programs_df['ProgramID'], 
        programs_df['ProgramName'], 
        programs_df['DegreeLevel']
    ):
        # Check if we have specific courses for this program
        if prog_name in program_courses:
            # Use predefined courses
            for course_code, course_name, credits in program_courses[prog_name]:
                courses.append({
                    'CourseID': course_id,
                    'CourseCode': course_code,
                    'CourseName': course_name,
                    'ProgramID': prog_id,
                    'CreditUnits': credits
                })
                course_id += 1
                if course_id > 1000:
                    break
        else:
            # Generate courses based on program name
            prefix = 'GEN'
            for key, val in default_prefixes.items():
                if key.lower() in prog_name.lower():
                    prefix = val
                    break
            
            # Generate 4-10 courses per program
            num_courses = random.randint(4, 10)
            
            # Year levels for course numbering
            for year in range(1, 5):  # Years 1-4
                courses_per_year = max(1, num_courses // 4)
                for i in range(courses_per_year):
                    course_num = random.randint(101, 199)
                    course_code = f"{prefix}{year}{course_num % 100:02d}"
                    
                    # Generate realistic course name based on program
                    if 'Computer' in prog_name or 'IT' in prog_name or 'Software' in prog_name:
                        subjects = ['Programming', 'Database', 'Networking', 'Web Development', 
                                   'Software Engineering', 'Data Structures', 'Algorithms']
                    elif 'Business' in prog_name or 'Accounting' in prog_name or 'Finance' in prog_name:
                        subjects = ['Business', 'Accounting', 'Finance', 'Marketing', 
                                   'Management', 'Economics', 'Entrepreneurship']
                    elif 'Law' in prog_name:
                        subjects = ['Law', 'Legal', 'Constitutional', 'Criminal', 'Commercial', 'Contract']
                    elif 'Education' in prog_name:
                        subjects = ['Education', 'Teaching', 'Curriculum', 'Pedagogy', 'Learning']
                    elif 'Journalism' in prog_name or 'Media' in prog_name:
                        subjects = ['Journalism', 'Media', 'Communication', 'Broadcast', 'News']
                    elif 'Medicine' in prog_name or 'Nursing' in prog_name:
                        subjects = ['Medical', 'Health', 'Clinical', 'Patient Care', 'Anatomy']
                    elif 'Theology' in prog_name:
                        subjects = ['Theology', 'Biblical', 'Church', 'Ministry', 'Christian']
                    elif 'Social' in prog_name:
                        subjects = ['Social Work', 'Community', 'Counseling', 'Welfare']
                    elif 'Agriculture' in prog_name:
                        subjects = ['Agriculture', 'Crop', 'Animal', 'Soil', 'Agribusiness']
                    else:
                        subjects = ['Studies', 'Principles', 'Methods', 'Practice']
                    
                    subject = random.choice(subjects)
                    templates = [
                        f'Introduction to {subject}',
                        f'{subject} Fundamentals',
                        f'{subject} I',
                        f'{subject} II',
                        f'Advanced {subject}',
                        f'{subject} Practice',
                        f'{subject} Methods'
                    ]
                    course_name = random.choice(templates)
                    
                    courses.append({
                        'CourseID': course_id,
                        'CourseCode': course_code,
                        'CourseName': course_name,
                        'ProgramID': prog_id,
                        'CreditUnits': random.choice([2, 3, 4])
                    })
                    course_id += 1
                    if course_id > 1000:
                        break
                if course_id > 1000:
                    break
        if course_id > 1000:
            break
    
    return pd.DataFrame(courses)

def generate_lecturers(departments_df):
    """Generate Lecturers data - 1000+ entries"""
    lecturers = []
    lecturer_id = 1
    ranks = ['Professor', 'Associate Professor', 'Senior Lecturer', 'Lecturer', 'Assistant Lecturer', 'Teaching Assistant']
    
    for dept_id in departments_df['DepartmentID']:
        # Generate 5-15 lecturers per department
        num_lecturers = random.randint(5, 15)
        for _ in range(num_lecturers):
            staff_num = f"UCU/STF/{random.randint(100, 9999):04d}"
            full_name = f"{random.choice(['Dr.', 'Prof.', 'Mr.', 'Ms.', 'Mrs.'])} {random.choice(UGANDAN_FIRST_NAMES)} {random.choice(UGANDAN_LAST_NAMES)}"
            
            lecturers.append({
                'LecturerID': lecturer_id,
                'StaffNumber': staff_num,
                'FullName': full_name,
                'DepartmentID': dept_id,
                'Rank': random.choice(ranks)
            })
            lecturer_id += 1
            if lecturer_id > 1000:
                break
        if lecturer_id > 1000:
            break
    
    return pd.DataFrame(lecturers)

def generate_students(programs_df):
    """Generate Students data - 1000+ entries with realistic UCU RegNo format
    Format: [Intake][Year][Degree][ProgramID]/[StudentNumber]
    Intake: J=January, M=May, S=September
    Year: 2 digits (20=2020, 21=2021, 22=2022, 23=2023, 24=2024)
    Degree: B=Bachelor, D=Diploma
    ProgramID: 2 digits (01-99)
    StudentNumber: 3 digits (001-999)
    Example: S23B12/005 = September 2023 intake, Bachelor, Program 12, Student 005
    """
    students = []
    student_id = 1
    
    # UCU has 3 intakes: J (January), M (May), S (September)
    intakes = ['J', 'M', 'S']
    # Years: 21 (2021) to 24 (2024)
    years = ['21', '22', '23', '24']
    
    # Degree level mapping: B=Bachelor, D=Diploma, M=Master, P=PhD
    degree_mapping = {
        'Bachelor': 'B',
        'Diploma': 'D',
        'Master': 'M',
        'PhD': 'P',
        'Certificate': 'C'
    }
    
    # Track student numbers per program per intake/year combination
    student_counters = {}
    
    for prog_id, degree_level in zip(programs_df['ProgramID'], programs_df['DegreeLevel']):
        # Get degree code from mapping
        degree_code = degree_mapping.get(degree_level, 'B')
        
        # Generate 10-50 students per program
        num_students = random.randint(10, 50)
        
        for i in range(num_students):
            # Select intake and year
            intake = random.choice(intakes)
            year = random.choice(years)
            
            # Program ID (2 digits, 01-99) - use actual program ID
            program_id_str = f"{prog_id % 100:02d}"
            
            # Create unique key for this combination (intake + year + degree + program)
            key = f"{intake}{year}{degree_code}{program_id_str}"
            
            # Get or initialize counter for this combination
            if key not in student_counters:
                student_counters[key] = 0
            student_counters[key] += 1
            
            # Student number (3 digits, 001-999)
            student_num = student_counters[key]
            student_num_str = f"{student_num:03d}"
            
            # Generate RegNo: S23B12/005 (Intake + Year + Degree + ProgramID + / + StudentNumber)
            reg_no = f"{intake}{year}{degree_code}{program_id_str}/{student_num_str}"
            
            first_name = random.choice(UGANDAN_FIRST_NAMES)
            last_name = random.choice(UGANDAN_LAST_NAMES)
            full_name = f"{first_name} {last_name}"
            
            # Calculate YearOfStudy based on intake year
            current_year = 2024
            admission_year = 2000 + int(year)
            year_of_study = min(4, max(1, current_year - admission_year + 1))
            
            # Generate Access Number (A##### or B#####)
            # A for regular students, B for special programs/scholarships
            access_prefix = random.choice(['A', 'B'])
            access_number = f"{access_prefix}{random.randint(10000, 99999):05d}"
            
            # Select high school (weighted towards popular schools)
            high_school, district = random.choices(
                UGANDAN_HIGH_SCHOOLS,
                weights=[15] * 12 + [10] * 4 + [8] * 2 + [5] * (len(UGANDAN_HIGH_SCHOOLS) - 18)
            )[0]
            
            students.append({
                'StudentID': student_id,
                'RegNo': reg_no,
                'AccessNumber': access_number,
                'FullName': full_name,
                'ProgramID': prog_id,
                'YearOfStudy': year_of_study,
                'Status': random.choices(
                    ['Active', 'Graduated', 'Suspended', 'Withdrawn'],
                    weights=[85, 10, 3, 2]
                )[0],
                'HighSchool': high_school,
                'HighSchoolDistrict': district
            })
            student_id += 1
            if student_id > 1000:
                break
        if student_id > 1000:
            break
    
    return pd.DataFrame(students)

def generate_enrollments(students_df, courses_df):
    """Generate Enrollments data - 1000+ entries with high school tracking"""
    enrollments = []
    enrollment_id = 1
    academic_years = ['2021/2022', '2022/2023', '2023/2024', '2024/2025']
    # UCU Semester Names: Jan (Easter Semester), May (Trinity Semester), September (Advent)
    semesters = ['Jan (Easter Semester)', 'May (Trinity Semester)', 'September (Advent)']
    
    # Create student to high school mapping
    student_high_school_map = {}
    if 'StudentID' in students_df.columns and 'HighSchool' in students_df.columns:
        for _, row in students_df.iterrows():
            student_high_school_map[row['StudentID']] = row['HighSchool']
    
    for student_id in students_df['StudentID']:
        # Each student enrolls in 4-8 courses
        num_courses = random.randint(4, 8)
        enrolled_courses = random.sample(courses_df['CourseID'].tolist(), min(num_courses, len(courses_df)))
        
        # Get student's high school
        high_school = student_high_school_map.get(student_id, 'Unknown')
        
        for course_id in enrolled_courses:
            enrollments.append({
                'EnrollmentID': enrollment_id,
                'StudentID': student_id,
                'CourseID': course_id,
                'AcademicYear': random.choice(academic_years),
                'Semester': random.choice(semesters),
                'HighSchool': high_school  # Track high school at enrollment time
            })
            enrollment_id += 1
            if enrollment_id > 1000:
                break
        if enrollment_id > 1000:
            break
    
    return pd.DataFrame(enrollments)

def get_letter_grade(score, exam_status=None, fcw=False):
    """Convert numeric grade to letter grade (UCU grading system)
    UCU Grading Scale:
    - 80-100 = A
    - 75-79 = B+
    - 70-74 = B
    - 60-69 = C
    - 50-59 = D
    - 0-49 = F
    Also includes: MEX (Missed Exam), FEX (Failed Exam), FCW (Failed Coursework)
    """
    if exam_status == 'MEX':
        return 'MEX'
    elif exam_status == 'FEX':
        return 'FEX'
    elif fcw or exam_status == 'FCW':
        return 'FCW'
    elif score >= 80:
        return 'A'
    elif score >= 75:
        return 'B+'
    elif score >= 70:
        return 'B'
    elif score >= 60:
        return 'C'
    elif score >= 50:
        return 'D'
    else:
        return 'F'

def generate_grades(students_df, courses_df, programs_df, student_fees_df=None):
    """Generate Grades data - 1000+ entries with MEX, FEX, FCW, and reasons
    UCU Policy:
    - Most programs: CW = 60%, Exam = 40%, FCW threshold = 35%
    - Law program: CW = 30%, Exam = 70%, FCW threshold = 17.5%
    """
    grades = []
    grade_id = 1
    
    # Create program mapping to check if Law program
    program_law_map = {}
    if programs_df is not None and not programs_df.empty:
        for _, row in programs_df.iterrows():
            prog_id = row.get('ProgramID', 0)
            prog_name = str(row.get('ProgramName', '')).lower()
            # Check if program name contains 'law' or is in Law faculty
            program_law_map[prog_id] = 'law' in prog_name or 'llb' in prog_name or 'llm' in prog_name
    
    # Create student to program mapping
    student_program_map = {}
    if 'ProgramID' in students_df.columns:
        for _, row in students_df.iterrows():
            student_program_map[row['StudentID']] = row['ProgramID']
    
    # Reasons for missed exams
    absence_reasons = {
        'MEX': [
            'Tuition fee arrears - unable to sit exam',
            'Family emergency - death of relative',
            'Sickness - medical certificate provided',
            'Family issues - urgent family matter',
            'Financial constraints - pending fees',
            'Transportation issues',
            'Personal emergency',
            'Bereavement in family',
            'Medical emergency',
            'Family crisis'
        ],
        'FEX': [
            'Failed to meet minimum attendance requirement',
            'Incomplete coursework',
            'Academic probation',
            'Disciplinary action'
        ]
    }
    
    # Create a map of student balances for tuition correlation
    student_balances = {}
    if student_fees_df is not None and not student_fees_df.empty:
        for _, row in student_fees_df.iterrows():
            sid = row.get('StudentID', 0)
            balance = row.get('Balance', 0)
            if sid not in student_balances:
                student_balances[sid] = 0
            student_balances[sid] += balance
    
    for student_id in students_df['StudentID']:
        # Each student has grades for 3-10 courses
        num_grades = random.randint(3, 10)
        student_courses = random.sample(courses_df['CourseID'].tolist(), min(num_grades, len(courses_df)))
        
        for course_id in student_courses:
            # Determine exam status (5% MEX, 3% FEX, 92% normal)
            exam_status_roll = random.random()
            exam_status = None
            absence_reason = None
            
            if exam_status_roll < 0.05:  # 5% missed exams
                exam_status = 'MEX'
                # Higher probability of MEX if student has fee balance
                student_balance = student_balances.get(student_id, 0)
                if student_balance > 100000:  # Has significant balance
                    # 60% chance it's due to tuition
                    if random.random() < 0.6:
                        absence_reason = random.choice([
                            'Tuition fee arrears - unable to sit exam',
                            'Financial constraints - pending fees'
                        ])
                    else:
                        absence_reason = random.choice([
                            r for r in absence_reasons['MEX'] 
                            if 'Tuition' not in r and 'Financial' not in r
                        ])
                else:
                    absence_reason = random.choice(absence_reasons['MEX'])
                    
            elif exam_status_roll < 0.08:  # 3% failed exams
                exam_status = 'FEX'
                absence_reason = random.choice(absence_reasons['FEX'])
            
            # Get student's program to determine if Law program
            student_prog_id = student_program_map.get(student_id, 0)
            is_law_program = program_law_map.get(student_prog_id, False)
            
            # UCU Policy: Determine CW and Exam percentages
            if is_law_program:
                cw_percent = 0.30  # 30%
                exam_percent = 0.70  # 70%
                fcw_threshold = 17.5  # 17.5%
            else:
                cw_percent = 0.60  # 60%
                exam_percent = 0.40  # 40%
                fcw_threshold = 35.0  # 35%
            
            # Generate coursework score (always present)
            coursework_score = max(0, min(100, np.random.normal(65, 15)))
            coursework_score = round(coursework_score, 2)
            
            # Check for FCW (Failed Coursework)
            fcw = coursework_score < fcw_threshold
            
            # Generate exam score based on exam status
            if exam_status == 'MEX':
                exam_score = None  # No exam score for missed exam
                total_score = coursework_score * cw_percent  # Only coursework counts
            elif exam_status == 'FEX':
                exam_score = max(0, min(49, np.random.normal(25, 8)))  # Low exam score
                exam_score = round(exam_score, 2)
                total_score = (coursework_score * cw_percent) + (exam_score * exam_percent)
            else:
                # Normal exam score
                exam_score = max(0, min(100, np.random.normal(65, 15)))
                exam_score = round(exam_score, 2)
                total_score = (coursework_score * cw_percent) + (exam_score * exam_percent)
            
            total_score = round(total_score, 2)
            
            # Determine final exam status (FCW takes precedence if coursework failed)
            if fcw:
                final_exam_status = 'FCW'
            elif exam_status:
                final_exam_status = exam_status
            else:
                final_exam_status = 'Completed'
            
            # Calculate letter grade from total score and exam status
            letter_grade = get_letter_grade(total_score, final_exam_status, fcw)
            
            grades.append({
                'GradeID': grade_id,
                'StudentID': student_id,
                'CourseID': course_id,
                'CourseworkScore': coursework_score,  # Coursework score (always present)
                'ExamScore': exam_score,  # Exam score (NULL if MEX)
                'TotalScore': total_score,  # Final calculated score
                'GradeLetter': letter_grade,  # Letter grade (calculated)
                'FCW': fcw,  # Failed Coursework flag
                'ExamStatus': final_exam_status,  # Completed, MEX, FEX, or FCW
                'AbsenceReason': absence_reason
            })
            grade_id += 1
            if grade_id > 1000:
                break
        if grade_id > 1000:
            break
    
    return pd.DataFrame(grades)

def generate_attendance(students_df, courses_df):
    """Generate Attendance data - 1000+ entries"""
    attendance = []
    attendance_id = 1
    
    # Generate attendance for last 120 days
    base_date = datetime.now()
    for day_offset in range(120):
        date = (base_date - timedelta(days=day_offset)).strftime('%Y-%m-%d')
        
        # Skip weekends (Saturday=5, Sunday=6)
        if (base_date - timedelta(days=day_offset)).weekday() >= 5:
            continue
        
        # For each course, generate attendance for some students
        for course_id in courses_df['CourseID'].sample(min(20, len(courses_df))):
            num_students = random.randint(10, 40)
            attending_students = random.sample(students_df['StudentID'].tolist(), 
                                              min(num_students, len(students_df)))
            
            for student_id in attending_students:
                status = random.choices(
                    ['Present', 'Absent', 'Late', 'Excused'],
                    weights=[75, 15, 8, 2]
                )[0]
                
                attendance.append({
                    'AttendanceID': attendance_id,
                    'StudentID': student_id,
                    'CourseID': course_id,
                    'Date': date,
                    'Status': status
                })
                attendance_id += 1
                if attendance_id > 1000:
                    break
            if attendance_id > 1000:
                break
        if attendance_id > 1000:
            break
    
    return pd.DataFrame(attendance)

def generate_student_fees(students_df, programs_df, include_timestamps=True):
    """Generate Student Fees data using actual UCU fee structure from Fees Structure 2025"""
    from ucu_actual_data import FUNCTIONAL_FEES
    fees = []
    payment_id = 1
    # UCU Semester Names: Jan (Easter Semester), May (Trinity Semester), September (Advent)
    semesters = ['Jan (Easter Semester)', 'May (Trinity Semester)', 'September (Advent)']
    
    # Create student to program mapping to get tuition fees
    student_program_map = {}
    program_tuition_map = {}
    if 'ProgramID' in students_df.columns:
        for _, row in students_df.iterrows():
            student_program_map[row['StudentID']] = row['ProgramID']
    
    if programs_df is not None and not programs_df.empty:
        for _, row in programs_df.iterrows():
            prog_id = row.get('ProgramID', 0)
            program_tuition_map[prog_id] = {
                'national': row.get('TuitionNationals', 1818000),
                'non_national': row.get('TuitionNonNationals', 2727000)
            }
    
    # Functional fees
    undergrad_functional = FUNCTIONAL_FEES['undergraduate']['total']  # 983,000 UGX
    postgrad_functional = FUNCTIONAL_FEES['postgraduate']['total']  # 618,000 UGX
    
    for student_id in students_df['StudentID']:
        # Get student's program to determine tuition
        prog_id = student_program_map.get(student_id, 0)
        tuition_info = program_tuition_map.get(prog_id, {'national': 1818000, 'non_national': 2727000})
        
        # Determine if student is national (80% chance) or non-national (20% chance)
        is_national = random.random() < 0.8
        tuition_per_semester = tuition_info['national'] if is_national else tuition_info['non_national']
        
        # Determine if undergraduate or postgraduate based on program
        # Assume Bachelor/Diploma/Certificate = undergrad, Master/PhD = postgrad
        is_undergrad = True  # Default
        if programs_df is not None and not programs_df.empty:
            prog_row = programs_df[programs_df['ProgramID'] == prog_id]
            if not prog_row.empty:
                degree_level = str(prog_row.iloc[0].get('DegreeLevel', '')).lower()
                is_undergrad = 'master' not in degree_level and 'phd' not in degree_level and 'doctor' not in degree_level
        
        functional_fee = undergrad_functional if is_undergrad else postgrad_functional
        total_fee_per_semester = tuition_per_semester + functional_fee
        
        # Each student has 1-6 payment records (representing different semesters)
        num_payments = random.randint(1, 6)
        cumulative_paid = 0
        
        for i in range(num_payments):
            # Payment can be partial or full
            payment_percentage = random.uniform(0.3, 1.0)  # 30% to 100% of semester fee
            amount_paid = int(total_fee_per_semester * payment_percentage)
            cumulative_paid += amount_paid
            
            # Determine payment status
            if payment_percentage >= 0.95:
                status = 'Completed'
            elif payment_percentage >= 0.5:
                status = 'Pending'
            else:
                status = 'Failed'
            
            # Extract year from semester or use current year
            current_year = datetime.now().year
            semester_year = current_year - random.randint(0, 3)  # Last 3 years
            
            # Select semester and calculate semester start date
            semester_name = random.choice(semesters)
            if 'Jan' in semester_name or 'Easter' in semester_name:
                semester_start_date = datetime(semester_year, 1, 15)
            elif 'May' in semester_name or 'Trinity' in semester_name:
                semester_start_date = datetime(semester_year, 5, 15)
            elif 'September' in semester_name or 'Advent' in semester_name:
                semester_start_date = datetime(semester_year, 8, 29)  # Based on image: 29-08-2025
            else:
                semester_start_date = datetime(semester_year, 1, 15)
            
            # Generate payment date (can be before or after semester start, but usually after)
            # Payment dates range from 2 weeks before semester start to 4 months after
            days_offset = random.randint(-14, 120)  # -14 to 120 days from semester start
            payment_date = semester_start_date + timedelta(days=days_offset)
            
            # Ensure payment date is not in the future
            if payment_date > datetime.now():
                payment_date = datetime.now() - timedelta(days=random.randint(1, 30))
            
            # Generate payment timestamp (same as payment_date but with time component)
            payment_timestamp = payment_date.replace(
                hour=random.randint(8, 17),
                minute=random.randint(0, 59),
                second=random.randint(0, 59)
            )
            
            # Determine payment method
            payment_methods = ['Bank Transfer', 'Mobile Money', 'Cash', 'Credit Card', 'Cheque']
            payment_method = random.choice(payment_methods)
            
            fee_record = {
                'PaymentID': payment_id,
                'StudentID': student_id,
                'AmountPaid': amount_paid,
                'TuitionNational': tuition_info['national'] if is_national else 0,
                'TuitionInternational': tuition_info['non_national'] if not is_national else 0,
                'FunctionalFees': functional_fee,
                'TotalAmount': total_fee_per_semester,
                'Semester': semester_name,
                'Year': semester_year,
                'Status': status,
                'Balance': max(0, total_fee_per_semester - amount_paid),
                'StudentType': 'national' if is_national else 'international'
            }
            
            # Add timestamp fields if requested
            if include_timestamps:
                fee_record['PaymentDate'] = payment_date
                fee_record['PaymentTimestamp'] = payment_timestamp
                fee_record['SemesterStartDate'] = semester_start_date
                fee_record['PaymentMethod'] = payment_method
            
            fees.append(fee_record)
            payment_id += 1
            if payment_id > 1000:
                break
        if payment_id > 1000:
            break
    
    return pd.DataFrame(fees)

# ==================== ADMINISTRATION DATABASE (DB2) ====================

def generate_positions():
    """Generate Positions data - 1000+ entries"""
    positions = []
    position_id = 1
    
    base_positions = [
        ('HR Assistant', 10, 1200000), ('Accountant', 11, 1800000), ('Admin Officer', 10, 1500000),
        ('IT Support', 12, 1600000), ('Secretary', 10, 1000000), ('Finance Officer', 11, 2000000),
        ('Procurement Officer', 13, 1700000), ('Maintenance Technician', 14, 1400000),
        ('Security Officer', 15, 900000), ('Driver', 16, 800000), ('Cleaner', 17, 600000),
        ('Librarian', 18, 1300000), ('Registrar', 19, 2500000), ('Dean', 20, 3000000)
    ]
    
    departments = list(range(10, 30))  # Admin departments
    
    # Generate base positions
    for title, dept, salary in base_positions:
        for _ in range(random.randint(2, 10)):  # Multiple positions of same type
            positions.append({
                'PositionID': position_id,
                'PositionTitle': title,
                'DepartmentID': dept,
                'SalaryScale': salary + random.randint(-200000, 200000)
            })
            position_id += 1
            if position_id > 1000:
                break
        if position_id > 1000:
            break
    
    # Generate additional positions
    while position_id <= 1000:
        titles = ['Officer', 'Assistant', 'Manager', 'Coordinator', 'Supervisor', 'Specialist']
        positions.append({
            'PositionID': position_id,
            'PositionTitle': f"{random.choice(['Senior', 'Junior', ''])} {random.choice(titles)}",
            'DepartmentID': random.choice(departments),
            'SalaryScale': random.randint(800000, 3000000)
        })
        position_id += 1
    
    return pd.DataFrame(positions)

def generate_employees(positions_df):
    """Generate Employees data - 1000+ entries"""
    employees = []
    employee_id = 1
    contract_types = ['Permanent', 'Contract', 'Temporary', 'Part-time']
    
    for pos_id in positions_df['PositionID']:
        # Generate 1-3 employees per position
        num_employees = random.randint(1, 3)
        for _ in range(num_employees):
            title = random.choice(['Mr.', 'Ms.', 'Mrs.', 'Dr.'])
            full_name = f"{title} {random.choice(UGANDAN_FIRST_NAMES)} {random.choice(UGANDAN_LAST_NAMES)}"
            
            employees.append({
                'EmployeeID': employee_id,
                'FullName': full_name,
                'PositionID': pos_id,
                'DepartmentID': random.randint(10, 30),
                'ContractType': random.choice(contract_types),
                'Status': random.choice(['Active', 'Active', 'Active', 'On Leave', 'Terminated'])
            })
            employee_id += 1
            if employee_id > 1000:
                break
        if employee_id > 1000:
            break
    
    return pd.DataFrame(employees)

def generate_contracts(employees_df):
    """Generate Contracts data - 1000+ entries"""
    contracts = []
    contract_id = 1
    
    for emp_id in employees_df['EmployeeID']:
        start_date = datetime.now() - timedelta(days=random.randint(0, 1825))  # 0-5 years ago
        
        # Contract duration
        if random.random() < 0.3:  # 30% permanent (no end date)
            end_date = None
        else:
            duration_days = random.choice([365, 730, 1095, 1825])  # 1-5 years
            end_date = (start_date + timedelta(days=duration_days)).strftime('%Y-%m-%d')
        
        contracts.append({
            'ContractID': contract_id,
            'EmployeeID': emp_id,
            'StartDate': start_date.strftime('%Y-%m-%d'),
            'EndDate': end_date,
            'Status': 'Active' if (end_date is None or datetime.strptime(end_date, '%Y-%m-%d') > datetime.now()) else 'Expired'
        })
        contract_id += 1
        if contract_id > 1000:
            break
    
    return pd.DataFrame(contracts)

def generate_employee_attendance(employees_df):
    """Generate Employee Attendance data - 1000+ entries"""
    attendance = []
    attendance_id = 1
    
    base_date = datetime.now()
    for day_offset in range(90):  # Last 90 days
        date = (base_date - timedelta(days=day_offset)).strftime('%Y-%m-%d')
        
        # Skip weekends
        if (base_date - timedelta(days=day_offset)).weekday() >= 5:
            continue
        
        # Generate attendance for random employees
        num_employees = random.randint(50, 200)
        attending_employees = random.sample(employees_df['EmployeeID'].tolist(), 
                                           min(num_employees, len(employees_df)))
        
        for emp_id in attending_employees:
            status = random.choices(
                ['Present', 'Absent', 'Late', 'On Leave'],
                weights=[80, 10, 7, 3]
            )[0]
            
            attendance.append({
                'AttendanceID': attendance_id,
                'EmployeeID': emp_id,
                'Date': date,
                'Status': status
            })
            attendance_id += 1
            if attendance_id > 1000:
                break
        if attendance_id > 1000:
            break
    
    return pd.DataFrame(attendance)

def generate_payroll(employees_df):
    """Generate Payroll data - 1000+ entries"""
    payroll = []
    payroll_id = 1
    
    pay_periods = [f"{year}-{month:02d}" for year in range(2022, 2025) for month in range(1, 13)]
    
    for emp_id in employees_df['EmployeeID']:
        # Generate payroll for last 12-24 months
        num_periods = random.randint(12, 24)
        periods = random.sample(pay_periods, min(num_periods, len(pay_periods)))
        
        for period in periods:
            # Net pay varies by employee
            base_pay = random.randint(800000, 3000000)
            deductions = random.randint(50000, 200000)
            net_pay = base_pay - deductions
            
            payroll.append({
                'PayrollID': payroll_id,
                'EmployeeID': emp_id,
                'PayPeriod': period,
                'NetPay': net_pay
            })
            payroll_id += 1
            if payroll_id > 1000:
                break
        if payroll_id > 1000:
            break
    
    return pd.DataFrame(payroll)

def generate_assets(employees_df):
    """Generate Assets data - 1000+ entries"""
    assets = []
    asset_id = 1
    
    asset_types = [
        ('Dell Laptop', 'UCU-AS-LAP'), ('HP Laptop', 'UCU-AS-LAP'), ('Lenovo Laptop', 'UCU-AS-LAP'),
        ('Desktop Computer', 'UCU-AS-PC'), ('Printer', 'UCU-AS-PRT'), ('Projector', 'UCU-AS-PRO'),
        ('Toyota Van', 'UCU-AS-VEH'), ('Toyota Car', 'UCU-AS-VEH'), ('Bus', 'UCU-AS-VEH'),
        ('Office Desk', 'UCU-AS-FUR'), ('Office Chair', 'UCU-AS-FUR'), ('Filing Cabinet', 'UCU-AS-FUR'),
        ('Air Conditioner', 'UCU-AS-AC'), ('Generator', 'UCU-AS-GEN'), ('Server', 'UCU-AS-SRV')
    ]
    
    statuses = ['Active', 'Active', 'Active', 'Under Maintenance', 'Retired', 'Disposed']
    
    for asset_name, prefix in asset_types:
        # Generate multiple assets of each type
        num_assets = random.randint(5, 30)
        for i in range(num_assets):
            asset_tag = f"{prefix}-{random.randint(1000, 9999)}"
            assigned_to = random.choice([None, None, None, random.choice(employees_df['EmployeeID'].tolist())])
            
            assets.append({
                'AssetID': asset_id,
                'AssetName': asset_name,
                'AssetTag': asset_tag,
                'AssignedTo': assigned_to,
                'Status': random.choice(statuses)
            })
            asset_id += 1
            if asset_id > 1000:
                break
        if asset_id > 1000:
            break
    
    return pd.DataFrame(assets)

def generate_suppliers():
    """Generate Suppliers data - 1000+ entries"""
    suppliers = []
    supplier_id = 1
    
    supplier_types = [
        'TechSource Uganda', 'Mega Supplies Ltd', 'Office Depot Uganda', 'Computer World',
        'Stationery Plus', 'Vehicle Solutions', 'Furniture Hub', 'Electrical Supplies',
        'Print Solutions', 'Network Equipment Co', 'Software Solutions', 'Hardware Express'
    ]
    
    for base_name in supplier_types:
        # Generate multiple suppliers of each type
        num_suppliers = random.randint(5, 20)
        for i in range(num_suppliers):
            if i == 0:
                supplier_name = base_name
            else:
                supplier_name = f"{base_name} {i+1}"
            
            suppliers.append({
                'SupplierID': supplier_id,
                'SupplierName': supplier_name,
                'ContactPerson': f"{random.choice(['Mr.', 'Ms.'])} {random.choice(UGANDAN_FIRST_NAMES)} {random.choice(UGANDAN_LAST_NAMES)}"
            })
            supplier_id += 1
            if supplier_id > 1000:
                break
        if supplier_id > 1000:
            break
    
    return pd.DataFrame(suppliers)

def generate_purchase_orders(suppliers_df):
    """Generate Purchase Orders data - 1000+ entries"""
    orders = []
    order_id = 1
    
    statuses = ['Approved', 'Approved', 'Pending', 'Delivered', 'Cancelled']
    year = 2024
    
    for supplier_id in suppliers_df['SupplierID']:
        # Generate 1-10 orders per supplier
        num_orders = random.randint(1, 10)
        for i in range(num_orders):
            order_num = f"PO-{year}-{str(i+1).zfill(3)}"
            
            orders.append({
                'OrderID': order_id,
                'SupplierID': supplier_id,
                'OrderNumber': order_num,
                'Status': random.choice(statuses)
            })
            order_id += 1
            if order_id > 1000:
                break
        if order_id > 1000:
            break
    
    return pd.DataFrame(orders)

def generate_maintenance_records(assets_df):
    """Generate Maintenance Records data - 1000+ entries"""
    maintenance = []
    maintenance_id = 1
    
    for asset_id in assets_df['AssetID']:
        # Generate 0-3 maintenance records per asset
        num_records = random.randint(0, 3)
        for i in range(num_records):
            date = (datetime.now() - timedelta(days=random.randint(0, 730))).strftime('%Y-%m-%d')
            cost = random.randint(50000, 2000000)
            
            maintenance.append({
                'MaintenanceID': maintenance_id,
                'AssetID': asset_id,
                'Date': date,
                'Cost': cost
            })
            maintenance_id += 1
            if maintenance_id > 1000:
                break
        if maintenance_id > 1000:
            break
    
    return pd.DataFrame(maintenance)

# ==================== CSV GENERATION ====================

def generate_csv1_student_fees(students_df, programs_df):
    """Generate CSV1: Student Fees (for compatibility with ETL)
    UCU tailored data with realistic student IDs (RegNo format)
    Includes year column and actual UCU fee structure
    """
    fees = generate_student_fees(students_df, programs_df)
    
    # Get student mapping for realistic RegNo
    student_reg_map = {}
    if 'RegNo' in students_df.columns:
        for _, row in students_df.iterrows():
            student_reg_map[row['StudentID']] = row['RegNo']
    
    # Convert to CSV format with UCU tailored data
    csv_data = []
    for _, row in fees.iterrows():
        student_id = row['StudentID']
        # Use realistic RegNo if available, otherwise use STU format
        student_id_str = student_reg_map.get(student_id, f"STU{student_id:06d}")
        
        # Extract year from row or payment date
        payment_year = row.get('Year', (datetime.now() - timedelta(days=random.randint(0, 1095))).year)
        payment_date = datetime.now() - timedelta(days=random.randint(0, 1095))  # Last 3 years
        
        csv_data.append({
            'payment_id': f"PAY{row['PaymentID']:06d}",
            'student_id': student_id_str,  # Use RegNo format (e.g., S23B12/005)
            'payment_date': payment_date.strftime('%Y-%m-%d'),
            'year': int(payment_year),  # Year column - ensure it's an integer
            'amount': float(row.get('AmountPaid', row.get('TotalAmount', 0))),
            'tuition_national': float(row.get('TuitionNational', 0)),
            'tuition_international': float(row.get('TuitionInternational', 0)),
            'functional_fees': float(row.get('FunctionalFees', 0)),
            'payment_method': random.choice(['Bank Transfer', 'Mobile Money', 'Cash', 'Credit Card']),
            'status': str(row.get('Status', 'Completed')),
            'semester': str(row.get('Semester', ''))
        })
    return pd.DataFrame(csv_data)

def generate_csv2_grades(students_df, courses_df, programs_df):
    """Generate CSV2: Grades (for compatibility with ETL)
    Both numeric score and letter grade are always included as separate columns
    UCU tailored data with realistic course codes and student IDs
    """
    # Generate fees first for correlation
    fees_df = generate_student_fees(students_df, programs_df)
    grades = generate_grades(students_df, courses_df, programs_df, fees_df)
    
    # Get student mapping for realistic RegNo
    student_reg_map = {}
    if 'RegNo' in students_df.columns:
        for _, row in students_df.iterrows():
            student_reg_map[row['StudentID']] = row['RegNo']
    
    # Get course mapping for realistic course codes
    course_code_map = {}
    if 'CourseCode' in courses_df.columns:
        for _, row in courses_df.iterrows():
            course_code_map[row['CourseID']] = row['CourseCode']
    
    # Convert to CSV format - ensure both numeric score and letter grade are present
    csv_data = []
    for _, row in grades.iterrows():
        student_id = row['StudentID']
        course_id = row['CourseID']
        
        # Use realistic RegNo if available, otherwise use STU format
        student_id_str = student_reg_map.get(student_id, f"STU{student_id:06d}")
        
        # Use realistic course code if available
        course_code = course_code_map.get(course_id, f"COURSE{course_id:03d}")
        
        # Extract year from exam date or semester
        exam_date = datetime.now() - timedelta(days=random.randint(0, 1095))  # Last 3 years
        exam_year = exam_date.year
        
        # Semester with year
        semester_choices = [
            f'Jan {exam_year} (Easter Semester)', 
            f'May {exam_year} (Trinity Semester)', 
            f'September {exam_year} (Advent)',
            f'Jan {exam_year-1} (Easter Semester)', 
            f'May {exam_year-1} (Trinity Semester)', 
            f'September {exam_year-1} (Advent)'
        ]
        
        csv_data.append({
            'grade_id': f"GRD{row['GradeID']:06d}",
            'student_id': student_id_str,  # Use RegNo format
            'course_code': course_code,  # Use realistic course code
            'coursework_score': row.get('CourseworkScore', 0.0),  # Coursework score
            'exam_score': row.get('ExamScore') if pd.notna(row.get('ExamScore')) else None,  # Exam score (may be NULL)
            'grade': row['TotalScore'] if pd.notna(row['TotalScore']) else 0.0,  # Total numeric score (always present)
            'letter_grade': row['GradeLetter'],  # Letter grade (always present, calculated)
            'fcw': row.get('FCW', False),  # Failed Coursework flag
            'exam_status': row.get('ExamStatus', 'Completed'),
            'absence_reason': row.get('AbsenceReason', ''),
            'semester': random.choice(semester_choices),
            'year': exam_year,  # Add year column
            'exam_date': exam_date.strftime('%Y-%m-%d')
        })
    return pd.DataFrame(csv_data)

# ==================== DATABASE CREATION ====================

def create_database1():
    """Create ACADEMICS database (DB1)"""
    print(f"\n{'='*60}")
    print(f"Creating {DB1_NAME} (ACADEMICS DATABASE)")
    print(f"{'='*60}")
    
    create_database_if_not_exists(DB1_NAME)
    engine = create_engine(DB1_CONN_STRING)
    
    # Execute SQL file
    sql_file = Path(__file__).parent / 'sql' / 'create_source_db1.sql'
    execute_sql_file(engine, sql_file)
    
    print("\nGenerating data...")
    
    # Generate data in correct order (respecting foreign keys)
    print("  → Faculties...")
    faculties_df = generate_faculties()
    faculties_df.to_sql('faculties', engine, if_exists='replace', index=False)
    
    print("  → Departments (1000+)...")
    departments_df = generate_departments(faculties_df)
    departments_df.to_sql('departments', engine, if_exists='replace', index=False, method='multi', chunksize=500)
    
    print("  → Programs (1000+)...")
    programs_df = generate_programs(departments_df)
    programs_df.to_sql('programs', engine, if_exists='replace', index=False, method='multi', chunksize=500)
    
    print("  → Courses (1000+)...")
    courses_df = generate_courses(programs_df)
    courses_df.to_sql('courses', engine, if_exists='replace', index=False, method='multi', chunksize=500)
    
    print("  → Lecturers (1000+)...")
    lecturers_df = generate_lecturers(departments_df)
    lecturers_df.to_sql('lecturers', engine, if_exists='replace', index=False, method='multi', chunksize=500)
    
    print("  → Students (1000+)...")
    students_df = generate_students(programs_df)
    students_df.to_sql('students', engine, if_exists='replace', index=False, method='multi', chunksize=500)
    
    print("  → Enrollments (1000+)...")
    enrollments_df = generate_enrollments(students_df, courses_df)
    enrollments_df.to_sql('enrollments', engine, if_exists='replace', index=False, method='multi', chunksize=500)
    
    print("  → Student Fees (1000+)...")
    fees_df = generate_student_fees(students_df, programs_df)
    fees_df.to_sql('student_fees', engine, if_exists='replace', index=False, method='multi', chunksize=500)
    
    print("  → Grades (1000+)...")
    grades_df = generate_grades(students_df, courses_df, programs_df, fees_df)
    grades_df.to_sql('grades', engine, if_exists='replace', index=False, method='multi', chunksize=500)
    
    print("  → Attendance (1000+)...")
    attendance_df = generate_attendance(students_df, courses_df)
    attendance_df.to_sql('attendance', engine, if_exists='replace', index=False, method='multi', chunksize=500)
    
    engine.dispose()
    print(f"\n✓ {DB1_NAME} created and populated successfully!")
    print(f"  - Faculties: {len(faculties_df)}")
    print(f"  - Departments: {len(departments_df)}")
    print(f"  - Programs: {len(programs_df)}")
    print(f"  - Courses: {len(courses_df)}")
    print(f"  - Lecturers: {len(lecturers_df)}")
    print(f"  - Students: {len(students_df)}")
    print(f"  - Enrollments: {len(enrollments_df)}")
    print(f"  - Grades: {len(grades_df)}")
    print(f"  - Attendance: {len(attendance_df)}")
    print(f"  - Student Fees: {len(fees_df)}")

def create_database2():
    """Create ADMINISTRATION database (DB2)"""
    print(f"\n{'='*60}")
    print(f"Creating {DB2_NAME} (ADMINISTRATION DATABASE)")
    print(f"{'='*60}")
    
    create_database_if_not_exists(DB2_NAME)
    engine = create_engine(DB2_CONN_STRING)
    
    # Execute SQL file
    sql_file = Path(__file__).parent / 'sql' / 'create_source_db2.sql'
    execute_sql_file(engine, sql_file)
    
    print("\nGenerating data...")
    
    print("  → Positions (1000+)...")
    positions_df = generate_positions()
    positions_df.to_sql('positions', engine, if_exists='replace', index=False, method='multi', chunksize=500)
    
    print("  → Employees (1000+)...")
    employees_df = generate_employees(positions_df)
    employees_df.to_sql('employees', engine, if_exists='replace', index=False, method='multi', chunksize=500)
    
    print("  → Contracts (1000+)...")
    contracts_df = generate_contracts(employees_df)
    # Handle NULL end dates
    contracts_df['EndDate'] = contracts_df['EndDate'].replace([None, 'None'], None)
    contracts_df.to_sql('contracts', engine, if_exists='replace', index=False, method='multi', chunksize=500)
    
    print("  → Employee Attendance (1000+)...")
    emp_attendance_df = generate_employee_attendance(employees_df)
    emp_attendance_df.to_sql('employee_attendance', engine, if_exists='replace', index=False, method='multi', chunksize=500)
    
    print("  → Payroll (1000+)...")
    payroll_df = generate_payroll(employees_df)
    payroll_df.to_sql('payroll', engine, if_exists='replace', index=False, method='multi', chunksize=500)
    
    print("  → Assets (1000+)...")
    assets_df = generate_assets(employees_df)
    assets_df['AssignedTo'] = assets_df['AssignedTo'].replace([None, 'None'], None)
    assets_df.to_sql('assets', engine, if_exists='replace', index=False, method='multi', chunksize=500)
    
    print("  → Suppliers (1000+)...")
    suppliers_df = generate_suppliers()
    suppliers_df.to_sql('suppliers', engine, if_exists='replace', index=False, method='multi', chunksize=500)
    
    print("  → Purchase Orders (1000+)...")
    orders_df = generate_purchase_orders(suppliers_df)
    orders_df.to_sql('purchase_orders', engine, if_exists='replace', index=False, method='multi', chunksize=500)
    
    print("  → Maintenance Records (1000+)...")
    maintenance_df = generate_maintenance_records(assets_df)
    maintenance_df.to_sql('maintenance_records', engine, if_exists='replace', index=False, method='multi', chunksize=500)
    
    engine.dispose()
    print(f"\n✓ {DB2_NAME} created and populated successfully!")
    print(f"  - Positions: {len(positions_df)}")
    print(f"  - Employees: {len(employees_df)}")
    print(f"  - Contracts: {len(contracts_df)}")
    print(f"  - Employee Attendance: {len(emp_attendance_df)}")
    print(f"  - Payroll: {len(payroll_df)}")
    print(f"  - Assets: {len(assets_df)}")
    print(f"  - Suppliers: {len(suppliers_df)}")
    print(f"  - Purchase Orders: {len(orders_df)}")
    print(f"  - Maintenance Records: {len(maintenance_df)}")

def create_csv1():
    """Create CSV1: Student Fees (for ETL compatibility)"""
    print(f"\n{'='*60}")
    print("Creating CSV1: Student Fees")
    print(f"{'='*60}")
    
    # Generate minimal data for CSV with proper structure
    num_programs = 100
    programs_df = pd.DataFrame({
        'ProgramID': range(1, num_programs + 1),
        'ProgramName': [f'Program {i}' for i in range(1, num_programs + 1)],
        'DegreeLevel': ['Bachelor'] * num_programs
    })
    students_df = generate_students(programs_df)
    fees_df = generate_csv1_student_fees(students_df, programs_df)
    fees_df.to_csv(CSV1_PATH, index=False)
    print(f"✓ CSV 1 created at {CSV1_PATH} ({len(fees_df)} records)")

def create_csv2():
    """Create CSV2: Grades (for ETL compatibility)"""
    print(f"\n{'='*60}")
    print("Creating CSV2: Grades")
    print(f"{'='*60}")
    
    # Generate minimal data for CSV with proper structure
    num_programs = 100
    programs_df = pd.DataFrame({
        'ProgramID': range(1, num_programs + 1),
        'ProgramName': [f'Program {i}' for i in range(1, num_programs + 1)],
        'DegreeLevel': ['Bachelor'] * num_programs
    })
    students_df = generate_students(programs_df)
    courses_df = pd.DataFrame({'CourseID': range(1, 201)})
    grades_df = generate_csv2_grades(students_df, courses_df, programs_df)
    grades_df.to_csv(CSV2_PATH, index=False)
    print(f"✓ CSV 2 created at {CSV2_PATH} ({len(grades_df)} records)")

if __name__ == "__main__":
    print("\n" + "="*60)
    print("UCU REALISTIC DATA GENERATION")
    print("="*60)
    print("Generating 1000+ entries for each table...")
    print("Note: Make sure MySQL is running and credentials are correct")
    print()
    
    try:
        create_database1()
        create_database2()
        create_csv1()
        create_csv2()
        
        print("\n" + "="*60)
        print("✓ ALL DATA GENERATED SUCCESSFULLY!")
        print("="*60)
        print("\nBoth databases and CSV files are ready for ETL pipeline.")
        
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        print("\nPlease check:")
        print("1. MySQL is running")
        print("2. MySQL credentials in config.py are correct")
        print("3. User has CREATE DATABASE privileges")
