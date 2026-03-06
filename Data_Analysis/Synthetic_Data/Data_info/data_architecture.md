# University Analytics System  
## Data Architecture Diagram, ERD, and Star Schema

## Overview

This document describes the **data architecture** for the University Analytics System.  
It explains how the generated datasets relate to each other and how they can be modeled in a **Business Intelligence / Data Warehouse** environment.

The design supports:

- reporting
- dashboarding
- SQL analytics
- academic monitoring
- financial analysis
- predictive analytics

---

# 1. Architecture Style

The system follows a **hybrid analytical data model**:

- **Dimension tables** hold descriptive reference data
- **Fact tables** hold measurable transactional or event data

This is suitable for:

- Power BI
- SQL warehouse reporting
- analytics models
- institutional scorecards

---

# 2. Main Subject Areas

The architecture covers four major subject areas:

## Academic
- programs
- faculties
- departments
- courses
- grades
- GPA / CGPA
- progression / retakes

## Finance
- student fees
- tuition payments
- sponsorships / scholarships

## Student Engagement
- attendance
- LMS/behavior extensions if added later

## Time Intelligence
- date-based slicing using `dim_date`

---

# 3. Core Entity Relationship Model (ERD)

## Main Entities

- Students
- Faculties / Departments / Programs
- Course Catalog
- Grades
- Attendance
- Payments
- Sponsorships
- Academic Performance
- Transcript
- Date Dimension

---

## ERD Diagram (Text Form)

```text
+----------------------+
|   faculties_departments |
|----------------------|
| faculty_id           |
| faculty_name         |
| department_id        |
| department_name      |
| program_id           |
| program_name         |
+----------+-----------+
           |
           | program_name
           v
+----------------------+
|       students       |
|----------------------|
| REG_NO (PK)          |
| ACC_NO               |
| PROGRAM              |
| FEES                 |
| RESIDENCE            |
| REGISTRATION TYPE    |
| TOTAL REGISTRATIONS  |
| STUDENT STATUS       |
+----+----+----+----+--+
     |    |    |    |
     |    |    |    |
     |    |    |    +------------------------------+
     |    |    |                                   |
     |    |    v                                   v
     |    |  +-------------------+        +----------------------+
     |    |  | student_payments  |        | student_sponsorships |
     |    |  |-------------------|        |----------------------|
     |    |  | PAYMENT_ID        |        | SPONSOR_PAYMENT_ID   |
     |    |  | REG_NO (FK)       |        | REG_NO (FK)          |
     |    |  | PAYMENT_DATE      |        | DISBURSEMENT_DATE    |
     |    |  | AMOUNT            |        | AMOUNT_SPONSORED     |
     |    |  +-------------------+        +----------------------+
     |    |
     |    v
     |  +-------------------+
     |  | student_attendance|
     |  |-------------------|
     |  | REG_NO (FK)       |
     |  | DATE              |
     |  | STATUS            |
     |  | SEMESTER_INDEX    |
     |  +-------------------+
     |
     v
+----------------------+
|   course_catalog     |
|----------------------|
| PROGRAM              |
| SEMESTER_INDEX       |
| COURSE_CODE (PK*)    |
| COURSE_TITLE         |
| COURSE_UNITS         |
| COURSE_TYPE          |
+----------+-----------+
           |
           | COURSE_CODE
           v
+----------------------+
|    student_grades    |
|----------------------|
| RECORD_ID            |
| REG_NO (FK)          |
| COURSE_CODE (FK)     |
| SEMESTER_INDEX       |
| CW_MARK_60           |
| EXAM_MARK_40         |
| FINAL_MARK_100       |
| STATUS               |
| LETTER_GRADE         |
| GRADE_POINTS         |
+----------+-----------+
           |
           +---------------------------+
           |                           |
           v                           v
+----------------------+      +-------------------------------+
| student_transcript   |      | academic_progression          |
|----------------------|      |-------------------------------|
| REG_NO (FK)          |      | PROGRESSION_ID               |
| SEMESTER_INDEX       |      | REG_NO (FK)                  |
| SEMESTER_GPA         |      | COURSE_CODE (FK)             |
| CGPA                 |      | ATTEMPT_NUMBER               |
| CREDITS_PASSED       |      | RETAKE_FLAG                  |
+----------------------+      | PROGRESSION_STATUS           |
                              +-------------------------------+

+----------------------+
|       dim_date       |
|----------------------|
| date_key             |
| full_date            |
| academic_year        |
| academic_term        |
| intake_window        |
| month / quarter      |
+----------------------+
```

---

# 4. Primary Keys and Foreign Keys

## Primary Keys

| Table | Primary Key |
|------|-------------|
| students | `REG_NO` |
| faculties_departments | `program_id` or composite structure |
| course_catalog | `COURSE_CODE` *(or composite: PROGRAM + SEMESTER_INDEX + COURSE_CODE)* |
| student_payments | `PAYMENT_ID` |
| student_sponsorships | `SPONSOR_PAYMENT_ID` |
| student_grades | `RECORD_ID` |
| academic_progression | `PROGRESSION_ID` |
| dim_date | `date_key` |

---

## Foreign Keys

| Child Table | Foreign Key | Parent Table |
|------|------|------|
| student_payments | `REG_NO` | students |
| student_sponsorships | `REG_NO` | students |
| student_attendance | `REG_NO` | students |
| student_grades | `REG_NO` | students |
| student_grades | `COURSE_CODE` | course_catalog |
| academic_progression | `REG_NO` | students |
| academic_progression | `COURSE_CODE` | course_catalog |
| student_transcript | `REG_NO` | students |
| students | `PROGRAM` | faculties_departments / course_catalog |

---

# 5. Recommended Star Schema for BI

The most effective Power BI / warehouse structure is:

## Dimensions

### `dim_student`
Student descriptive data.

### `dim_program`
Program-level attributes.

### `dim_faculty_department`
Faculty and department hierarchy.

### `dim_course`
Course information.

### `dim_date`
Calendar intelligence.

---

## Facts

### `fact_grades`
Grain:
```text
one student × one course × one semester
```

### `fact_payments`
Grain:
```text
one student × one payment transaction
```

### `fact_sponsorships`
Grain:
```text
one student × one sponsorship disbursement
```

### `fact_attendance`
Grain:
```text
one student × one day
```

### `fact_academic_performance`
Grain:
```text
one student × one semester
```

### `fact_transcript`
Grain:
```text
one student × one semester
```

---

# 6. Star Schema Diagram

```text
                    +------------------+
                    |    dim_date      |
                    +------------------+
                             |
                             |
+----------------+   +------------------+   +------------------+
|  dim_student   |---| fact_grades      |---|   dim_course      |
+----------------+   +------------------+   +------------------+
        |
        |           +------------------+
        +-----------| fact_attendance  |
        |           +------------------+
        |
        |           +------------------+
        +-----------| fact_payments    |
        |           +------------------+
        |
        |           +----------------------+
        +-----------| fact_sponsorships    |
        |           +----------------------+
        |
        |           +------------------------------+
        +-----------| fact_academic_performance    |
        |           +------------------------------+
        |
        |           +------------------+
        +-----------| fact_transcript  |
                    +------------------+

dim_student
    |
    +----> dim_program
                |
                +----> dim_faculty_department
```

---

# 7. Recommended Power BI Relationships

## Core Relationships

### Student Links
- `students.REG_NO` → `payments.REG_NO`
- `students.REG_NO` → `grades.REG_NO`
- `students.REG_NO` → `attendance.REG_NO`
- `students.REG_NO` → `sponsorships.REG_NO`
- `students.REG_NO` → `transcript.REG_NO`
- `students.REG_NO` → `fact_student_academic_performance.REG_NO`

### Course Links
- `course_catalog.COURSE_CODE` → `grades.COURSE_CODE`
- `course_catalog.COURSE_CODE` → `academic_progression.COURSE_CODE`

### Date Links
- `dim_date.full_date` → `payments.PAYMENT_DATE`
- `dim_date.full_date` → `attendance.DATE`
- `dim_date.full_date` → `sponsorships.DISBURSEMENT_DATE`

### Program Links
- `students.PROGRAM` → `faculties_departments.program_name`
- `course_catalog.PROGRAM` → `faculties_departments.program_name`

---

# 8. Recommended Semantic Layers

## Academic Metrics
- Pass Rate
- Fail Rate
- FCW Rate
- FEX Rate
- MEX Rate
- Average GPA
- Average CGPA
- Retake Rate

## Finance Metrics
- Total Expected Fees
- Total Amount Paid
- Balance Outstanding
- Sponsorship Coverage %
- Payment Completion Rate

## Engagement Metrics
- Attendance Rate
- Absence Rate
- Attendance vs GPA correlation

---

# 9. Suggested BI Pages

## Executive Dashboard
KPIs:
- total students
- average GPA
- total tuition collected
- sponsorship value
- attendance rate

## Academic Performance Dashboard
- GPA by faculty
- GPA by department
- difficult courses
- retake analysis
- FCW/FEX/MEX trends

## Student Finance Dashboard
- fees expected vs paid
- balances by program
- payment channels
- sponsorship coverage

## Attendance Dashboard
- attendance by program
- absenteeism trends
- attendance vs grades

## Risk Analytics Dashboard
- at-risk students
- financially vulnerable students
- academically weak students
- programs with high failure rates

---

# 10. Advanced Analytics Opportunities

## Predictive Models
- student dropout prediction
- exam failure prediction
- tuition default prediction
- attendance risk scoring

## Institutional Planning
- faculty workload forecasting
- classroom attendance utilization
- scholarship allocation analysis
- high-risk program identification

---

# 11. Recommended Next Steps

To make the architecture even more enterprise-level, the following can be added later:

- LMS / Moodle activity logs
- hostel allocation fact table
- lecturer dimension
- teaching timetable fact table
- invoice / student ledger table
- graduation eligibility fact table

---

# 12. Summary

The University Analytics System now supports a **complete analytical data model** integrating:

- student master data
- academic structure
- grades
- transcript logic
- attendance
- payments
- sponsorships
- time intelligence

This architecture is suitable for:
- final year project demonstration
- Power BI dashboards
- SQL analytics
- institutional decision support
- predictive analytics extensions
