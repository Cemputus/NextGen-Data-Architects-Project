
# University Analytics System
## Overall Project Documentation

---

# 1. Project Overview

The **University Analytics System** is a data-driven platform designed to support institutional decision making using integrated academic, financial, and engagement data.

The system simulates a **modern university data warehouse** that enables:

- Business Intelligence dashboards
- Academic performance monitoring
- Financial analysis
- Student risk detection
- SQL-based analytics via the NextGen Query engine

The project integrates multiple datasets representing the core operational areas of a university.

---

# 2. System Architecture

The system follows a simplified **Data Warehouse Architecture**.

```
Operational Data Sources
        │
        ▼
Data Preparation / Transformation
        │
        ▼
University Data Warehouse
        │
        ▼
Business Intelligence Dashboards
        │
        ▼
NextGen Query (SQL Analytics Interface)
```

### Data Domains

The system integrates four main domains:

Academic Data  
Financial Data  
Student Engagement Data  
Time Intelligence

---

# 3. Generated Datasets

The project contains **18 integrated datasets**.

## Student Master Data

students_list15_anonymized_5000_corrected_fee_logic  
students_list16_anonymized_5000_corrected_fee_logic  

Contains anonymized student information including:

REG_NO  
ACC_NO  
PROGRAM  
NATIONALITY  
RESIDENCE  
FEES  
REGISTRATION_TYPE  
TOTAL_REGISTRATIONS  

Registration number structure example:

KM23B38/005

K = Kampala campus  
M = May intake  
23 = admission year  
B = Bachelor program  

---

# 4. Academic Structure

faculties_departments

Defines the academic hierarchy:

Faculty → Department → Program

Used for:

- faculty analytics
- department comparisons
- program-level reporting

---

# 5. Course Catalog

course_catalog_ucu_actual_titles

Defines courses offered per program.

Fields include:

PROGRAM  
SEMESTER_INDEX  
COURSE_CODE  
COURSE_TITLE  
COURSE_UNITS  
COURSE_TYPE  

Each semester typically contains **6–7 courses**.

---

# 6. Student Grades

student_grades_list15_updated_titles  
student_grades_list16_updated_titles  

Granularity:

one student × one course × one semester

Fields:

CW_MARK_60  
EXAM_MARK_40  
FINAL_MARK_100  
STATUS  
LETTER_GRADE  
GRADE_POINTS  

Assessment policy:

Coursework = 60%  
Exam = 40%  

Status codes:

Completed  
FCW – Failed Coursework  
FEX – Failed Exam  
MEX – Missed Exam  

Pass rule:

Final mark ≥ 50%

---

# 7. Academic Transcript

student_transcript_list15  
student_transcript_list16  

Granularity:

one student × one semester

Metrics:

SEMESTER_GPA  
CGPA  
CREDITS_ATTEMPTED  
CREDITS_PASSED  
CREDITS_FAILED  

GPA scale:

A = 5.0  
B+ = 4.5  
B = 4.0  
C+ = 3.5  
C = 3.0  
D+ = 2.5  
D = 2.0  
F = 1.5  

---

# 8. Academic Performance Fact Tables

fact_student_academic_performance_list15  
fact_student_academic_performance_list16  

Granularity:

one student × one semester

Metrics:

COURSES_REGISTERED  
TOTAL_CREDITS  
QUALITY_POINTS  
PASSED_COURSES  
FAILED_COURSES  
FCW_COUNT  
FEX_COUNT  
MEX_COUNT  
SEMESTER_GPA  

Used for institutional performance analytics.

---

# 9. Financial Data

student_payments_list15_realistic  
student_payments_list16_realistic  

Tracks tuition transactions.

Fields:

PAYMENT_ID  
REG_NO  
PAYMENT_DATE  
AMOUNT  
PAYMENT_METHOD  

Students may make multiple payments per semester.

---

# 10. Scholarship Data

student_sponsorships_list15  
student_sponsorships_list16  

Tracks scholarships and sponsorship disbursements.

Fields:

SPONSOR_NAME  
SCHOLARSHIP_TYPE  
AMOUNT_SPONSORED  
DISBURSEMENT_DATE  

Coverage may range from **20% to 100% of tuition**.

---

# 11. Attendance Data

student_attendance

Tracks class attendance.

Fields:

REG_NO  
DATE  
COURSE_CODE  
STATUS  

Attendance records exclude weekends.

Used to analyze student engagement and academic outcomes.

---

# 12. Time Dimension

dim_date_2022_2026

Calendar dimension used for analytics.

Fields:

date_key  
full_date  
academic_year  
academic_term  
month  
quarter  
weekday  

Used for:

payment trends  
attendance analysis  
semester reporting  

---

# 13. Data Warehouse Model

The system follows a **star-schema inspired design**.

Dimensions:

dim_student  
dim_program  
dim_course  
dim_faculty_department  
dim_date  

Fact tables:

fact_grades  
fact_payments  
fact_sponsorships  
fact_attendance  
fact_academic_performance  
fact_transcript  

This architecture enables efficient BI queries.

---

# 14. Business Intelligence Dashboards

The system supports **six analytical dashboards**.

Executive Overview  
Academic Performance  
Course Difficulty Analytics  
Student Finance  
Attendance Analytics  
Student Risk Analytics  

These dashboards provide institutional insights for decision makers.

---

# 15. Advanced Analytics

Examples of insights supported by the system:

Attendance vs GPA correlation  

Program difficulty ranking  

Revenue by faculty  

Course failure analysis  

Retake pressure detection  

Student risk identification  

These analytics support proactive academic and financial management.

---

# 16. NextGen Query System

The system includes a SQL-based analytics interface called **NextGen Query**.

Example query:

SELECT program,
AVG(semester_gpa)
FROM fact_student_academic_performance
GROUP BY program
ORDER BY AVG(semester_gpa) DESC;

This enables analysts to explore institutional performance interactively.

---

# 17. Project Outcome

The project delivers a simulated **enterprise-level university analytics platform** including:

Complete student data model  
18 integrated datasets  
Star-schema architecture  
Business intelligence dashboards  
SQL analytics capability  

This system demonstrates how universities can leverage data for:

academic monitoring  
financial planning  
student success initiatives  
strategic decision making

---

