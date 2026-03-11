
# University Analytics System
## Comprehensive Data Documentation, BI Dashboards, and Advanced Analytics

---

# 1. Project Overview

This project implements a **University Analytics and Decision Support System** that integrates academic, financial, and engagement data to enable **institutional analytics and business intelligence**.

The system simulates a realistic university environment using anonymized datasets representing:

- Students
- Courses
- Faculties and departments
- Grades and transcripts
- Tuition payments
- Scholarships and sponsorships
- Attendance records
- Academic performance metrics

The architecture supports:

- SQL analytics
- BI dashboards
- Institutional performance monitoring
- Risk detection for students
- Financial analysis

---

# 2. Complete Dataset Inventory

## Student Master Data

### students_list15_anonymized_5000_corrected_fee_logic.xlsx
### students_list16_anonymized_5000_corrected_fee_logic.xlsx

Contains anonymized student information.

Fields include:

- REG_NO
- ACC_NO
- PROGRAM
- NATIONALITY
- STUDENT_STATUS
- REGISTRATION_TYPE
- RESIDENCE
- ACCOMMODATION_TYPE
- TOTAL_REGISTRATIONS
- FEES
- EXPECTED_FEES_PERCENT

Registration numbers follow a structured format.

Example:

KM23B38/005

Meaning:

K → Kampala Campus  
M → May Intake  
23 → Admission Year  
B → Bachelor Program  
38 → Program Code  
005 → Student Sequence Number

---

# 3. Academic Structure Data

## faculties_departments.csv

Defines the academic hierarchy.

Faculty  
→ Department  
→ Program

Used for analytics such as:

- GPA by faculty
- Student distribution by department
- Faculty performance comparison

---

# 4. Course Catalog

## course_catalog_ucu_actual_titles.csv
## course_catalog_ucu_actual_titles.xlsx

Defines course structure per program.

Fields:

PROGRAM  
SEMESTER_INDEX  
COURSE_CODE  
COURSE_TITLE  
COURSE_UNITS  
COURSE_TYPE

Each semester typically includes **6–7 courses**.

---

# 5. Student Grades Data

## student_grades_list15_updated_titles
## student_grades_list16_updated_titles

Grain:

One student × one course × one semester

Fields:

CW_MARK_60  
EXAM_MARK_40  
FINAL_MARK_100  
STATUS  
LETTER_GRADE  
GRADE_POINTS

Assessment rules:

Coursework = 60%  
Exam = 40%

Special status codes:

Completed → student sat exam and passed  
FCW → Failed Coursework  
FEX → Failed Exam  
MEX → Missed Exam

Pass rule:

Final Mark ≥ 50

---

# 6. Academic Transcript Data

## student_transcript_list15
## student_transcript_list16

Grain:

One student × one semester

Fields:

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

# 7. Academic Performance Fact Tables

## fact_student_academic_performance_list15
## fact_student_academic_performance_list16

Grain:

One student × one semester

Fields:

COURSES_REGISTERED  
TOTAL_CREDITS  
QUALITY_POINTS  
PASSED_COURSES  
FAILED_COURSES  
FCW_COUNT  
FEX_COUNT  
MEX_COUNT  
SEMESTER_GPA

Used for institutional analytics.

---

# 8. Financial Data

## student_payments_list15_realistic
## student_payments_list16_realistic

Tracks tuition payment transactions.

Fields:

PAYMENT_ID  
REG_NO  
PAYMENT_DATE  
AMOUNT  
PAYMENT_METHOD  
SEMESTER

Students may make **multiple payments per semester**.

---

# 9. Scholarship Data

## student_sponsorships_list15
## student_sponsorships_list16

Fields:

SPONSOR_NAME  
SCHOLARSHIP_TYPE  
AMOUNT_SPONSORED  
DISBURSEMENT_DATE

Scholarships may cover **20–100% of tuition**.

---

# 10. Attendance Data

## student_attendance

Tracks student presence per class day.

Coverage:

Weekdays only (Monday–Friday)

Fields:

REG_NO  
DATE  
COURSE_CODE  
STATUS

Used to analyze engagement and academic behavior.

---

# 11. Time Intelligence

## dim_date_2022_2026

Calendar dimension table used for analytics.

Fields:

date_key  
full_date  
academic_year  
academic_term  
month  
quarter  
weekday

Used for:

- payment trends
- attendance patterns
- semester analysis

---

# 12. Data Architecture

The system follows a **star-schema inspired architecture**.

Dimensions:

dim_student  
dim_program  
dim_faculty_department  
dim_course  
dim_date

Fact tables:

fact_grades  
fact_payments  
fact_sponsorships  
fact_attendance  
fact_academic_performance  
fact_transcript

This architecture enables high-performance BI analytics.

---

# 13. Recommended BI Dashboards

The system should implement **six core dashboards**.

---

## 1. Executive Overview Dashboard

Purpose:

Provide top management with a high-level institutional view.

KPIs:

Total Students  
Average GPA  
Total Tuition Collected  
Outstanding Fees  
Students Sponsored  
Attendance Rate

Visualizations:

Student population by Faculty  
Tuition collected by semester  
GPA distribution  
Attendance trend

Datasets used:

students  
fact_student_academic_performance  
student_payments  
student_sponsorships  
student_attendance

---

## 2. Academic Performance Dashboard

Purpose:

Monitor student academic outcomes.

KPIs:

Average GPA  
Pass Rate  
Fail Rate  
Retake Rate

Visualizations:

GPA by Program  
GPA by Faculty  
Course failure rate  
Retake analysis  
Semester GPA trend

Datasets used:

student_grades  
student_transcript  
fact_student_academic_performance  
course_catalog  
faculties_departments

---

## 3. Course Difficulty Analytics

Purpose:

Identify difficult courses.

KPIs:

Failure Rate  
FCW Rate  
FEX Rate  
Average Mark

Visualizations:

Failure rate by course  
Courses with most retakes  
Average marks by semester

Dataset used:

student_grades  
course_catalog

---

## 4. Student Finance Dashboard

Purpose:

Monitor tuition payment behavior.

KPIs:

Expected Fees  
Total Paid  
Outstanding Balance  
Payment Completion Rate

Visualizations:

Fees collected per semester  
Payment methods distribution  
Outstanding fees by program  
Sponsorship coverage

Datasets used:

students  
student_payments  
student_sponsorships

---

## 5. Attendance Analytics Dashboard

Purpose:

Monitor student engagement.

KPIs:

Average Attendance  
Absence Rate  
Courses with Low Attendance

Visualizations:

Attendance trend  
Attendance by faculty  
Attendance vs GPA

Datasets used:

student_attendance  
student_transcript  
students

---

## 6. Student Risk Analytics Dashboard

Purpose:

Identify students at risk of academic failure.

Risk rules:

SEMESTER_GPA < 2.5  
FAILED_COURSES >= 2  
ATTENDANCE < 70%  
FEES_PAID < 50%

KPIs:

At-Risk Students  
Students with FCW  
Students with FEX  
Students with Low Attendance

Visualizations:

Risk level by program  
At-risk students table  
Academic risk heatmap

Datasets used:

student_transcript  
fact_student_academic_performance  
student_attendance  
student_payments

---

# 14. Advanced Analytics Insights

## Attendance vs GPA Correlation

Investigates whether class attendance improves academic performance.

Example insight:

Students attending more than 80% of classes tend to have significantly higher GPAs.

---

## Program Difficulty Ranking

Average GPA by program.

Helps identify challenging academic programs.

---

## Revenue by Faculty

Total tuition generated per faculty.

Helps identify programs contributing most to institutional revenue.

---

## Course Failure Analysis

Courses with the highest failure rates.

Helps improve curriculum design and student support.

---

## Retake Pressure

Courses with highest retake rates.

Helps identify academically demanding courses.

---

# 15. NextGen Query Feature

The system includes a **SQL analytics interface** that allows analysts to run queries such as:

SELECT program,
AVG(semester_gpa)
FROM fact_student_academic_performance
GROUP BY program
ORDER BY AVG(semester_gpa) DESC;

This allows interactive exploration of institutional performance.

---

# 16. Final System Summary

The project delivers:

- A complete **university analytics data warehouse**
- 18 integrated datasets
- Star-schema architecture
- Multi-domain analytics (academic, finance, engagement)
- Advanced BI dashboards
- SQL query analytics engine

This architecture simulates a **real institutional analytics platform used by modern universities**.

