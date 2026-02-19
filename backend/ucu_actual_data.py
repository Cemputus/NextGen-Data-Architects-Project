"""
UCU Actual Data - Exact Structure from Official Documents
11 Faculties/Schools with Departments and Programs
"""
from typing import List, Dict, Tuple

# UCU 11 Faculties/Schools (Actual Structure)
UCU_FACULTIES = [
    {'id': 1, 'name': 'Bishop Tucker School of Divinity and Theology', 'dean': 'Rev. Dr. Samuel Kizito'},
    {'id': 2, 'name': 'School of Education', 'dean': 'Dr. Rebecca Nakato'},
    {'id': 3, 'name': 'Faculty of Public Health, Nursing & Midwifery', 'dean': 'Dr. Esther Komugisha'},
    {'id': 4, 'name': 'School of Journalism, Media and Communication', 'dean': 'Dr. Grace Nalubega'},
    {'id': 5, 'name': 'Faculty of Agricultural Sciences', 'dean': 'Prof. James Kato'},
    {'id': 6, 'name': 'Faculty of Engineering, Design & Technology', 'dean': 'Dr. Allan Mugisha'},
    {'id': 7, 'name': 'School of Social Sciences', 'dean': 'Prof. Mawejje Johnpaul'},
    {'id': 8, 'name': 'School of Dentistry', 'dean': 'Dr. Yohana Eyob'},
    {'id': 9, 'name': 'School of Medicine', 'dean': 'Dr. Peter Mukasa'},
    {'id': 10, 'name': 'School of Business', 'dean': 'Dr. Sarah Kakuru'},
    {'id': 11, 'name': 'School of Law', 'dean': 'Prof. John Mutyaba'},
]

# UCU Structure: Faculty -> Department -> Programs
# Format: (faculty_id, department_name, program_name, duration_years, tuition_nationals, tuition_non_nationals, degree_level)
UCU_STRUCTURE: List[Tuple[int, str, str, int, int, int, str]] = [
    # 1. Bishop Tucker School of Divinity and Theology
    (1, 'Divinity and Theology', 'Master of Theological Studies', 2, 2545000, 3817500, 'Master'),
    (1, 'Divinity and Theology', 'Master of Arts in Theology', 2, 2545000, 3817500, 'Master'),
    (1, 'Divinity and Theology', 'Master of Divinity', 3, 1904000, 2856000, 'Master'),
    (1, 'Divinity and Theology', 'PhD in Theology', 3, 5696000, 8544000, 'PhD'),
    (1, 'Divinity and Theology', 'Doctor of Ministry', 3, 3844500, 5766750, 'Doctorate'),
    (1, 'Divinity and Theology', 'Bachelor of Divinity', 3, 1818000, 2727000, 'Bachelor'),
    
    # 2. School of Education
    # Department: Education & Literature
    (2, 'Education & Literature', 'Master of Education Administration and Management', 2, 2546500, 3819750, 'Master'),
    (2, 'Education & Literature', 'MA Literature', 2, 2546500, 3819750, 'Master'),
    (2, 'Education & Literature', 'Master of Library and Information Science', 2, 2546500, 3819750, 'Master'),
    (2, 'Education & Literature', 'Master of Education in Curriculum Studies', 2, 2546500, 3819750, 'Master'),
    (2, 'Education & Literature', 'Master of Educational Psychology', 2, 2546500, 3819750, 'Master'),
    (2, 'Education & Literature', 'Master of Higher Education Pedagogy and Leadership', 2, 2546500, 3819750, 'Master'),
    (2, 'Education & Literature', 'Higher Education Certificate (Arts)', 1, 1050000, 1575000, 'Certificate'),
    (2, 'Education & Literature', 'Higher Education Certificate (Sciences)', 1, 1270000, 1905000, 'Certificate'),
    (2, 'Education & Literature', 'Higher Education Certificate (Blended)', 1, 1000000, 0, 'Certificate'),
    (2, 'Education & Literature', 'Bachelor of Science in Education', 3, 1818000, 2727000, 'Bachelor'),
    (2, 'Education & Literature', 'Bachelor of Education (Recess) (Upgrading Teachers)', 2, 1000000, 0, 'Bachelor'),
    (2, 'Education & Literature', 'BA Education', 3, 1818000, 2727000, 'Bachelor'),
    # Department: Postgraduate Studies
    (2, 'Postgraduate Studies', 'PGD Education', 1, 2546500, 3819750, 'Postgraduate Diploma'),
    (2, 'Postgraduate Studies', 'PGD Higher Education', 1, 2546500, 3819750, 'Postgraduate Diploma'),
    (2, 'Postgraduate Studies', 'PGD Internationalisation of Education', 1, 2546500, 3819750, 'Postgraduate Diploma'),
    (2, 'Postgraduate Studies', 'PhD in Literature', 3, 5696000, 8544000, 'PhD'),
    (2, 'Postgraduate Studies', 'PhD in Education (Administration & Management)', 3, 5696000, 8544000, 'PhD'),
    
    # 3. Faculty of Public Health, Nursing & Midwifery
    (3, 'Public Health, Nursing & Midwifery', 'Master of Public Health Leadership', 2, 2586500, 3879750, 'Master'),
    (3, 'Public Health, Nursing & Midwifery', 'Master of Nursing Science', 2, 2586500, 3879750, 'Master'),
    (3, 'Public Health, Nursing & Midwifery', 'Master of Public Health', 2, 2586500, 3879750, 'Master'),
    (3, 'Public Health, Nursing & Midwifery', 'Bachelor of Public Health', 3, 2304000, 3456000, 'Bachelor'),
    (3, 'Public Health, Nursing & Midwifery', 'Bachelor of Nursing Science (For A\' level Applicants)', 4, 2304000, 3456000, 'Bachelor'),
    (3, 'Public Health, Nursing & Midwifery', 'Bachelor of Nursing Science (Diploma Entry)', 3, 2304000, 3456000, 'Bachelor'),
    
    # 4. School of Journalism, Media and Communication
    (4, 'Journalism, Media & Communication', 'MA Journalism and Strategic Communication', 2, 2545000, 3817500, 'Master'),
    (4, 'Journalism, Media & Communication', 'Master of Arts in Strategic Communication', 2, 2545000, 3817500, 'Master'),
    (4, 'Journalism, Media & Communication', 'PhD in Journalism, Media and Communication', 3, 5696000, 8544000, 'PhD'),
    (4, 'Journalism, Media & Communication', 'BA Journalism and Communication', 3, 2304000, 3456000, 'Bachelor'),
    
    # 5. Faculty of Agricultural Sciences
    (5, 'Agricultural Science', 'Master of Science in Agriculture (Rural Dev\'t | Crop Science | Soil Science)', 2, 2545000, 3817500, 'Master'),
    (5, 'Agricultural Science', 'Master of Science in Agricultural Economics', 2, 2545000, 3817500, 'Master'),
    (5, 'Agricultural Science', 'Master of Science in Agribusiness Management and Entrepreneurship', 2, 2545000, 3817500, 'Master'),
    (5, 'Agricultural Science', 'Master of Science in Human Nutrition', 2, 2545000, 3817500, 'Master'),
    (5, 'Agricultural Science', 'PhD in Agricultural Systems and Value Chain Management', 3, 5696000, 8544000, 'PhD'),
    (5, 'Agricultural Science', 'Bachelor of Science in Agricultural Science and Entrepreneurship', 4, 2425000, 3637500, 'Bachelor'),
    (5, 'Agricultural Science', 'Bachelor of Science in Human Nutrition and Clinical Dietetics', 4, 2425000, 3637500, 'Bachelor'),
    (5, 'Agricultural Science', 'Bachelor of Science in Food Science and Technology', 4, 2425000, 3637500, 'Bachelor'),
    
    # 6. Faculty of Engineering, Design & Technology
    # Department: Computing
    (6, 'Computing', 'Master of Science in Computer Science', 2, 2545000, 3817500, 'Master'),
    (6, 'Computing', 'Master of Information Technology', 2, 2545000, 3817500, 'Master'),
    (6, 'Computing', 'Bachelor of Science in Data Science and Analytics', 3, 2425000, 3637500, 'Bachelor'),
    (6, 'Computing', 'Bachelor of Science in Computer Science', 3, 2425000, 3637500, 'Bachelor'),
    (6, 'Computing', 'Bachelor of Science in Information Technology', 3, 2425000, 3637500, 'Bachelor'),
    (6, 'Computing', 'Diploma in Information Technology', 2, 700000, 1050000, 'Diploma'),
    # Department: Visual Arts
    (6, 'Visual Arts', 'Diploma in Visual Art and Design', 2, 700000, 1050000, 'Diploma'),
    (6, 'Visual Arts', 'Bachelor of Visual Art and Design', 3, 1941000, 2911500, 'Bachelor'),
    (6, 'Visual Arts', 'Bachelor of Art in Graphic Design and Animation', 3, 2425000, 3637500, 'Bachelor'),
    # Department: Engineering
    (6, 'Engineering', 'Master of Science in Water and Sanitation', 2, 2545000, 3817500, 'Master'),
    (6, 'Engineering', 'Master of Science in Data Science and Analytics', 2, 2545000, 3817500, 'Master'),
    (6, 'Engineering', 'Master of Science in Environmental Science & Management', 2, 2545000, 3817500, 'Master'),
    (6, 'Engineering', 'Bachelor of Science in Civil and Environmental Engineering', 4, 2425000, 3637500, 'Bachelor'),
    (6, 'Engineering', 'Bachelor of Electronics and Communication Science', 3, 2425000, 3637500, 'Bachelor'),
    (6, 'Engineering', 'PGD Water and Sanitation', 1, 2545000, 3817500, 'Postgraduate Diploma'),
    
    # 7. School of Social Sciences
    (7, 'Social Sciences', 'PGD Public Administration', 1, 2546000, 3819000, 'Postgraduate Diploma'),
    (7, 'Social Sciences', 'PGD Development Monitoring and Evaluation', 1, 2546000, 3819000, 'Postgraduate Diploma'),
    (7, 'Social Sciences', 'Master of Social Work', 2, 2545000, 3817500, 'Master'),
    (7, 'Social Sciences', 'Master of Counseling Psychology', 2, 2209000, 3313500, 'Master'),
    (7, 'Social Sciences', 'Master of Governance and International Relations', 2, 2546000, 3819000, 'Master'),
    (7, 'Social Sciences', 'Master of Public Administration and Management', 2, 2546000, 3819000, 'Master'),
    (7, 'Social Sciences', 'Master of Research and Public Policy', 2, 2545000, 3817500, 'Master'),
    (7, 'Social Sciences', 'Master of Development Monitoring and Evaluation', 2, 2546000, 3819000, 'Master'),
    (7, 'Social Sciences', 'Master of Arts in African Studies', 2, 2545000, 3817500, 'Master'),
    (7, 'Social Sciences', 'PhD in Development Studies', 3, 5696000, 8544000, 'PhD'),
    (7, 'Social Sciences', 'Diploma in Social Work and Social Administration', 2, 700000, 1050000, 'Diploma'),
    (7, 'Social Sciences', 'Bachelor of Public Administration and Management', 3, 1818000, 2727000, 'Bachelor'),
    (7, 'Social Sciences', 'Bachelor of Governance and International Relations', 3, 1818000, 2727000, 'Bachelor'),
    (7, 'Social Sciences', 'Bachelor of Human Rights, Peace and Humanitarian Interventions', 3, 1818000, 2727000, 'Bachelor'),
    (7, 'Social Sciences', 'Bachelor of Social Work and Social Administration', 3, 1818000, 2727000, 'Bachelor'),
    
    # 8. School of Dentistry
    (8, 'Dentistry', 'Bachelor of Dental Surgery', 5, 5000000, 7500000, 'Bachelor'),
    
    # 9. School of Medicine
    (9, 'Medicine', 'Bachelor of Medicine and Bachelor of Surgery (MBChB)', 5, 5000000, 7500000, 'Bachelor'),
    
    # 10. School of Business
    # Department: Business
    (10, 'Business', 'Master of Business Administration', 2, 2584000, 3876000, 'Master'),
    (10, 'Business', 'Master of Arts in Organizational Leadership and Management', 3, 1764000, 2646000, 'Master'),
    (10, 'Business', 'Bachelor of Business Administration', 3, 1818000, 2727000, 'Bachelor'),
    (10, 'Business', 'Diploma in Business Administration', 2, 700000, 1050000, 'Diploma'),
    # Department: Human Resource
    (10, 'Human Resource', 'PGD Human Resource Management', 1, 2584000, 3876000, 'Postgraduate Diploma'),
    (10, 'Human Resource', 'Master of Human Resource Management', 2, 2584000, 3876000, 'Master'),
    (10, 'Human Resource', 'Bachelor of Human Resource Management', 3, 1818000, 2727000, 'Bachelor'),
    # Department: Procurement and Logistics Management
    (10, 'Procurement and Logistics Management', 'PGD Sustainable Business and Renewable Energy', 1, 2584000, 3876000, 'Postgraduate Diploma'),
    (10, 'Procurement and Logistics Management', 'Master of Science in Procurement and Supply Chain Management', 2, 2584000, 3876000, 'Master'),
    (10, 'Procurement and Logistics Management', 'Bachelor of Procurement and Logistics Management', 3, 1818000, 2727000, 'Bachelor'),
    # Department: Tourism & Hospitality
    (10, 'Tourism & Hospitality', 'Bachelor of Tourism and Hospitality Management', 3, 1818000, 2727000, 'Bachelor'),
    # Department: Accounting
    (10, 'Accounting', 'Bachelor of Science in Accounting and Finance', 3, 1818000, 2727000, 'Bachelor'),
    (10, 'Accounting', 'Bachelor of Science in Economics and Statistics', 3, 1818000, 2727000, 'Bachelor'),
    
    # 11. School of Law
    (11, 'Law', 'Master of Laws in International Business Law', 2, 4623000, 6934500, 'Master'),
    (11, 'Law', 'Master of Laws in International Energy Law and Policy', 2, 5100000, 7650000, 'Master'),
    (11, 'Law', 'Master of Laws (Oil & Gas)', 2, 5100000, 7650000, 'Master'),
    (11, 'Law', 'Diploma in Law', 2, 600000, 900000, 'Diploma'),
    (11, 'Law', 'Bachelor of Laws (LLB)', 4, 2325000, 3487500, 'Bachelor'),
]

# Functional Fees (Per Semester) from PDF
FUNCTIONAL_FEES = {
    'undergraduate': {
        'registration_fee': 53000,
        'development_fee': 500000,
        'medical_fee': 70000,
        'student_activity_fee': 90000,
        'computer_fee': 100000,
        'examination_fee': 80000,
        'book_fee_imat': 90000,
        'total': 983000
    },
    'postgraduate': {
        'registration_fee': 35000,
        'development_fee': 333000,
        'medical_fee': 0,
        'student_activity_fee': 66000,
        'computer_fee': 67000,
        'examination_fee': 53000,
        'book_fee_imat': 64000,
        'total': 618000
    }
}

# Recess Term Fees (MBChB & BDS Students)
RECESS_TERM_FEES = {
    'development_fee': 210000,
    'medical_fee': 70000,
    'imat_fee': 100000,
    'computer_fee': 90000,
    'examination_fee': 80000,
    'total': 550000
}

# Helper function to get programs by faculty
def get_programs_by_faculty(faculty_id: int) -> List[Tuple[str, str, int, int, int, str]]:
    """Get all programs for a specific faculty"""
    return [
        (dept, prog, dur, nat, non_nat, level)
        for fid, dept, prog, dur, nat, non_nat, level in UCU_STRUCTURE
        if fid == faculty_id
    ]

# Helper function to get departments by faculty
def get_departments_by_faculty(faculty_id: int) -> List[str]:
    """Get all departments for a specific faculty"""
    departments = set()
    for fid, dept, _, _, _, _, _ in UCU_STRUCTURE:
        if fid == faculty_id:
            departments.add(dept)
    return sorted(list(departments))

# Helper function to get all programs
def get_all_programs() -> List[Tuple[int, str, str, int, int, int, str]]:
    """Get all programs"""
    return UCU_STRUCTURE

# Helper function to get programs by department
def get_programs_by_department(faculty_id: int, department_name: str) -> List[Tuple[str, int, int, int, str]]:
    """Get all programs for a specific department"""
    return [
        (prog, dur, nat, non_nat, level)
        for fid, dept, prog, dur, nat, non_nat, level in UCU_STRUCTURE
        if fid == faculty_id and dept == department_name
    ]
