# University NextGen Analytics System
## Advanced Business Intelligence & Analytics Framework

## 1. System Overview

The University NextGen Analytics platform integrates multiple institutional datasets to enable **academic intelligence, financial monitoring, and student success analytics**.

The system consolidates data from the following domains:

- Academic records
- Student attendance
- Tuition payments
- Scholarship sponsorships
- Academic progression
- Faculty and department structure

The goal is to transform operational data into **strategic institutional insights**.

---

# 2. Core Data Sources

## 2.1 Student Records
Contains anonymized student information including:

- REG_NO
- ACC_NO
- Program
- Department
- Faculty
- Registration history
- Fee expectations

Used as the **central dimension table**.

---

## 2.2 Faculties and Departments
Defines the academic hierarchy:

Faculty → Department → Program

Columns include:

- faculty_id
- faculty_name
- department_id
- department_name
- program_id
- program_name

This dataset enables **faculty-level and department-level analytics**.

---

## 2.3 Grades Dataset

Contains course performance information:

- coursework marks
- exam marks
- final score
- grade
- GPA points
- result status (Completed, FEX, FCW, MEX)

This dataset supports **academic performance analytics**.

---

## 2.4 Attendance Dataset

Tracks daily student engagement.

Columns include:

- REG_NO
- DATE
- SEMESTER
- STATUS (Present / Late / Absent)

Attendance data enables **behavioral analytics** and **risk detection**.

---

## 2.5 Payments Dataset

Contains student payment transactions:

- Payment ID
- REG_NO
- Amount Paid
- Payment Date
- Payment Method

Supports **financial monitoring and tuition tracking**.

---

## 2.6 Sponsorship Dataset

Captures external funding support.

Columns:

- Sponsor name
- Scholarship type
- Amount sponsored
- Semester supported

Used for **funding and scholarship analytics**.

---

## 2.7 Academic Progression

Tracks retakes and course progression.

Columns include:

- REG_NO
- Course code
- Retake count
- Semester

This helps identify **curriculum bottlenecks**.

---

# 3. Data Warehouse Architecture

The system can be modeled as a **star schema**.
dim_faculty
dim_department
dim_program
dim_student
dim_date

    ↓
fact_grades
fact_payments
fact_attendance
fact_sponsorships
fact_progression


Benefits:

- Faster BI queries
- Easier dashboard creation
- Consistent analytics

---

# 4. Key Institutional KPIs

## Academic KPIs

- Average GPA
- Pass rate
- Fail rate
- Course retake rate
- GPA by program

---

## Financial KPIs

- Total tuition collected
- Outstanding balances
- Sponsorship funding
- Average payment completion

---

## Student Engagement KPIs

- Attendance rate
- Late arrival frequency
- Absenteeism rate

---

# 5. Advanced BI Analytics Opportunities

## 5.1 GPA Performance Analytics

Insights:

- GPA by faculty
- GPA by department
- GPA trend across semesters
- GPA distribution

Visualization examples:

- GPA histogram
- Faculty comparison charts

---

## 5.2 Course Difficulty Index

Metrics:

- Course failure rate
- Retake frequency
- Average course score

Helps identify:

- difficult courses
- curriculum bottlenecks

---

## 5.3 Attendance vs Academic Performance

Correlate:

Attendance Rate vs GPA

Example Insight:

Students with attendance > 85% may have significantly higher GPA.

---

## 5.4 Financial Behavior Analytics

Track payment behavior patterns:

- number of payments per semester
- early vs late payments
- partial payment patterns

Insights:

- financially struggling students
- payment seasonality

---

## 5.5 Scholarship Analytics

Analyze sponsorship coverage:

- sponsored students percentage
- sponsorship amount by faculty
- top sponsors

Insights:

- which programs receive most support
- sponsor funding distribution

---

# 6. Student Risk Detection

Use combined datasets to detect at-risk students.

Example rule:
Attendance < 70%
AND GPA < 2.5
AND Outstanding Fees > 50%

→ High Risk Student


Risk detection allows **early academic intervention**.

---

# 7. Predictive Analytics Opportunities

The system can support machine learning models.

## Dropout Prediction

Features:

- attendance
- GPA trend
- payment completion
- coursework performance

---

## Course Failure Prediction

Features:

- coursework marks
- attendance
- historical GPA

---

# 8. Suggested Dashboards

## Executive Dashboard

Metrics:

- total students
- tuition revenue
- average GPA
- sponsorship funding

---

## Academic Dashboard

Metrics:

- GPA by faculty
- course failure heatmap
- retake analysis

---

## Financial Dashboard

Metrics:

- payment trends
- outstanding balances
- sponsorship contributions

---

## Student Engagement Dashboard

Metrics:

- attendance trends
- absenteeism heatmap
- attendance vs GPA analysis

---

# 9. Strategic Institutional Insights

This system enables:

- data-driven academic planning
- financial monitoring
- early student intervention
- curriculum improvement

The integrated datasets create a **comprehensive institutional analytics ecosystem**.
🔥 Important Suggestion (for your project)
Since you now have many datasets, your project can look very professional if you also include:

1️⃣ ERD (Entity Relationship Diagram)
showing how:

Students
   │
   ├── Grades
   ├── Payments
   ├── Attendance
   ├── Sponsorships
   └── Progression
connected to:

Programs → Departments → Faculties
2️⃣ BI Architecture Diagram
Raw Data
   ↓
ETL / Data Pipelines
   ↓
Data Warehouse
   ↓
    BI 
   ↓
Dashboards

# University Analytics System
## Data Description and Advanced Analytics Guide

This document describes the datasets generated for the **University Analytics and Decision Support System**.
The data models simulate a realistic university operational environment including **academic, financial, attendance, and sponsorship records**.

The system supports advanced analytics, business intelligence dashboards, and SQL-driven insights through the **NextGen Query Engine**.

---

# 1. Data Architecture

The system follows a **star-schema inspired architecture** with:

- **Dimension Tables**
- **Fact Tables**

## Dimension Tables

| Table | Description |
|------|-------------|
| students_list15 / students_list16 | Master student records |
| faculties_departments | Academic structure |
| course_catalog_ucu | Course structure per program |
| dim_date | Calendar table |

## Fact Tables

| Table | Description |
|------|-------------|
| student_grades | Individual course results |
| student_attendance | Daily attendance tracking |
| student_payments | Tuition payment transactions |
| student_sponsorships | Scholarship funding |
| fact_student_academic_performance | Semester performance summary |
| student_transcript | GPA and CGPA progression |

---

# 2. Student Master Data

## Students Dataset

Contains the primary information for each student.

### Key Fields

| Field | Description |
|------|-------------|
| REG_NO | Unique student registration number |
| ACC_NO | Student access number |
| PROGRAM | Academic program |
| NATIONALITY | Student nationality |
| STUDENT_STATUS | Active, Completed, etc |
| REGISTRATION_TYPE | Normal / Late |
| RESIDENCE | Resident / Non-resident |
| ACCOMMODATION_TYPE | Room category |
| FEES | Tuition fees |
| EXPECTED_FEES_PERCENT | Percentage of expected fees paid |

### Registration Number Format

Example:

```
KM23B38/005
```

Meaning:

| Part | Meaning |
|-----|--------|
| K | Kampala Campus |
| M | May intake |
| 23 | Admission year |
| B | Bachelor program |
| 38 | Program code |
| 005 | Student sequence number |

---

# 3. Academic Structure

## faculties_departments

Defines the academic hierarchy.

```
Faculty
↓
Department
↓
Program
```

### Fields

| Field | Description |
|------|-------------|
| faculty_id | Faculty identifier |
| faculty_name | Faculty name |
| department_id | Department identifier |
| department_name | Department name |
| program_id | Program identifier |
| program_name | Program title |

This structure enables analytics by:

- faculty
- department
- program

---

# 4. Course Catalog

## course_catalog_ucu

Defines the courses offered in each program.

### Fields

| Field | Description |
|------|-------------|
| PROGRAM | Academic program |
| SEMESTER_INDEX | Semester number |
| COURSE_CODE | Unique course identifier |
| COURSE_TITLE | Course name |
| COURSE_UNITS | Credit units |
| COURSE_TYPE | Core / Elective |

### Course Structure

Each semester typically contains:

```
6 – 7 courses
```

---

# 5. Student Grades Dataset

## student_grades

Contains **course-level academic performance**.

### Fields

| Field | Description |
|------|-------------|
| REG_NO | Student identifier |
| COURSE_CODE | Course identifier |
| COURSE_TITLE | Course title |
| CW_MARK_60 | Coursework score |
| EXAM_MARK_40 | Exam score |
| FINAL_MARK_100 | Final mark |
| STATUS | Course outcome |
| LETTER_GRADE | Letter grade |
| GRADE_POINTS | GPA value |

### Assessment Rules

Coursework weight:

```
60%
```

Exam weight:

```
40%
```

### Special Status Codes

| Code | Meaning |
|----|------|
| Completed | Sat exam and passed |
| FCW | Failed coursework |
| FEX | Failed exam |
| MEX | Missed exam |

### Pass Rule

```
Final Mark >= 50%
```

---

# 6. Attendance Dataset

Tracks daily attendance for students.

### Coverage

Attendance records include:

```
Every weekday
Excludes Saturday and Sunday
```

### Fields

| Field | Description |
|------|-------------|
| REG_NO | Student identifier |
| DATE | Attendance date |
| STATUS | Present / Absent |
| COURSE_CODE | Course attended |

---

# 7. Payments Dataset

Tracks tuition payments made by students.

### Fields

| Field | Description |
|------|-------------|
| PAYMENT_ID | Transaction ID |
| REG_NO | Student |
| PAYMENT_DATE | Date of payment |
| AMOUNT | Payment amount |
| PAYMENT_METHOD | Mobile Money / Bank |
| SEMESTER | Semester paid |

Students can make **multiple payments per semester**.

---

# 8. Sponsorship Dataset

Tracks scholarships and sponsorships.

### Fields

| Field | Description |
|------|-------------|
| SPONSOR_NAME | Funding organization |
| SCHOLARSHIP_TYPE | Scholarship category |
| AMOUNT_SPONSORED | Amount covered |
| DISBURSEMENT_DATE | Payment date |

Typical sponsorship coverage:

```
20% – 100% of fees
```

---

# 9. Academic Transcript

## student_transcript

Provides semester-level academic summaries.

### Fields

| Field | Description |
|------|-------------|
| SEMESTER_GPA | GPA for semester |
| CGPA | Cumulative GPA |
| CREDITS_ATTEMPTED | Credits taken |
| CREDITS_PASSED | Credits passed |
| CREDITS_FAILED | Credits failed |

### GPA Scale

| Grade | GPA |
|------|------|
| A | 5.0 |
| B+ | 4.5 |
| B | 4.0 |
| C+ | 3.5 |
| C | 3.0 |
| D+ | 2.5 |
| D | 2.0 |
| F | 1.5 |

---

# 10. Fact Student Academic Performance

Aggregated dataset used for analytics.

### Fields

| Field | Description |
|------|-------------|
| COURSES_REGISTERED | Courses taken |
| TOTAL_CREDITS | Total credit load |
| PASSED_COURSES | Courses passed |
| FAILED_COURSES | Courses failed |
| FCW_COUNT | Coursework failures |
| FEX_COUNT | Exam failures |
| MEX_COUNT | Missed exams |
| SEMESTER_GPA | Semester GPA |

This table enables fast analytics.

---

# 11. Advanced BI Analytics

The system enables advanced analytics for university management.

---

## Academic Performance Analytics

### GPA Distribution

Identify performance trends across programs.

Example insights:

- average GPA by program
- GPA distribution by faculty
- top performing departments

---

## Course Difficulty Analytics

Identify difficult courses.

Metrics:

```
failure rate
retake rate
average mark
```

---

## Student Risk Prediction

Identify at-risk students early.

Indicators:

```
low GPA
high absence
multiple retakes
financial hold
```

---

## Attendance Analytics

Analyze student engagement.

Questions answered:

- Does attendance correlate with GPA?
- Which courses have poor attendance?

---

## Financial Analytics

Monitor tuition revenue.

Metrics:

```
total fees collected
outstanding balances
payment completion rate
```

---

## Scholarship Analytics

Evaluate sponsorship distribution.

Metrics:

```
students sponsored
total sponsorship value
sponsorship by faculty
```

---

## Institutional Performance

Executive-level KPIs:

```
Average GPA
Student success rate
Dropout risk index
Faculty performance ranking
Revenue per program
```

---

# 12. Strategic Decision Support

The analytics platform supports:

- Academic planning
- Financial monitoring
- Student retention strategies
- Resource allocation

---

# Conclusion

This dataset ecosystem simulates a **complete university analytics platform** integrating:

- Academic performance
- Financial operations
- Student engagement
- Institutional strategy

The system enables **advanced BI dashboards, SQL analytics, and predictive modeling**.




University Analytics System


Recommended BI Dashboards


You should build 6 main dashboards.



These dashboards will use the datasets we generated.

1. Executive Overview Dashboard


Purpose:

Give top university management a quick view of institutional performance.



KPIs
Total Students
Average GPA
Total Tuition Collected
Outstanding Fees
Students Sponsored
Attendance Rate
Visualizations
Student population by Faculty

Tuition collected by semester

GPA distribution

Attendance trend



Datasets used
students
fact_student_academic_performance
student_payments
student_sponsorships
student_attendance
2. Academic Performance Dashboard


Purpose:

Monitor student academic outcomes.



KPIs
Average GPA
Pass Rate
Fail Rate
Retake Rate
Visualizations
GPA by Program

GPA by Faculty

Course failure rate

Retake analysis

Semester GPA trend



Example Chart
Program vs Average GPA
Datasets used
student_grades
student_transcript
fact_student_academic_performance
course_catalog
faculties_departments
3. Course Difficulty Analytics


Purpose:

Identify difficult courses.



KPIs
Failure Rate
FCW Rate
FEX Rate
Average Mark
Visualizations
Failure rate by course

Courses with most retakes

Average marks by semester



Example Chart
Top 10 Hardest Courses
Dataset used
student_grades
course_catalog
4. Student Finance Dashboard


Purpose:

Monitor tuition payment behavior.



KPIs
Expected Fees
Total Paid
Outstanding Balance
Payment Completion Rate
Visualizations
Fees collected per semester

Payment methods distribution

Outstanding fees by program

Sponsorship coverage



Example Chart
Fees Paid vs Expected
Datasets used
students
student_payments
student_sponsorships
5. Attendance Analytics Dashboard


Purpose:

Monitor student engagement.



KPIs
Average Attendance
Absence Rate
Courses with Low Attendance
Visualizations
Attendance trend

Attendance by faculty

Attendance vs GPA



Example Chart
Attendance vs GPA correlation
Datasets used
student_attendance
student_transcript
students
6. Student Risk Analytics Dashboard


Purpose:

Identify students at risk of failure or dropout.



Risk Rules


Example:

SEMESTER_GPA < 2.5
FAILED_COURSES >= 2
ATTENDANCE < 70%
FEES_PAID < 50%
KPIs
At-Risk Students
Students with FCW
Students with FEX
Students with Low Attendance
Visualizations
Risk level by program

At-risk students table

Academic risk heatmap



Datasets used
student_transcript
fact_student_academic_performance
student_attendance
student_payments
Recommended Dashboard Layout
Executive Dashboard
        │
        ├── Academic Performance
        │
        ├── Course Difficulty
        │
        ├── Student Finance
        │
        ├── Attendance Analytics
        │
        └── Student Risk Analytics
Advanced Analytics You Can Show


These make your project look very advanced.



Attendance vs GPA Correlation
Do students who attend more perform better?
Program Difficulty Ranking
Average GPA by program
Revenue by Faculty
Total tuition collected per faculty
Retake Pressure
Courses with highest retake rates
Bonus Feature for Your Project


Your NextGen Query page will allow analysts to run queries like:

SELECT program,
AVG(semester_gpa)
FROM fact_student_academic_performance
GROUP BY program
ORDER BY AVG(semester_gpa) DESC;
This will show best performing programs.




