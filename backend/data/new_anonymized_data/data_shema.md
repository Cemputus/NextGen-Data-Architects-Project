# UCU Analytics Demo Dataset  
## data_schema.md

## Purpose
This document defines the **data model / schema** for the synthetic UCU Analytics demo datasets, including:
- Primary keys (PK)
- Foreign keys (FK)
- Table relationships
- Recommended warehouse/star-schema structure for BI (Power BI)

---

## Naming Conventions
- Student identifiers:
  - `REG_NO` = Registration number (unique student key in this demo)
  - `ACC_NO` = Access number (unique student key alternate)
- Dates:
  - Stored as ISO-like format in CSV/XLSX (`YYYY-MM-DD`) where applicable.
- Semester alignment:
  - `SEMESTER_INDEX` = 1..N (historical registrations/semesters)
  - `ACADEMIC_YEAR` = e.g., `2025/2026`
  - `SEMESTER` = `SEM1` or `SEM2`

---

# 1) Core Dimension: Students

## Table: `students_list15_anonymized_5000.xlsx` / `students_list16_anonymized_5000.xlsx`  
**Grain:** 1 row per student (current/latest registration snapshot)

### Keys
- **PK:** `REG_NO`
- Alternate unique: `ACC_NO`

### Important Columns (examples)
- `REG_NO`, `ACC_NO`, `NAME`
- `PROGRAM`
- `TOTAL_REGISTRATIONS`
- `RESIDENCE`, `ACCOMMODATION_TYPE`
- `EXPECTED FEES(%) - RAW`, `EXPECTED FEES(%) - RANGE`
- `TOTAL EXPECTED FEES (UGX)`, `AMOUNT PAID (UGX)`, `TUITION BALANCE (UGX)`

### Notes
- Students files are **snapshots of the latest state**, but `TOTAL_REGISTRATIONS` enables building historical fact tables.

---

# 2) Fact: Student Payments

## Table: `student_payments_list15.csv` / `student_payments_list16.csv`  
**Grain:** 1 row per payment transaction

### Keys
- **PK:** `PAYMENT_ID`
- **FK:** `REG_NO` → `students.REG_NO`
- Optional FK: `ACC_NO` → `students.ACC_NO`

### Columns
- `PAYMENT_ID`
- `REG_NO`, `ACC_NO`
- `ACADEMIC_YEAR`, `SEMESTER`, `SEMESTER_INDEX`
- `PAYMENT_DATE`
- `AMOUNT_UGX`
- `PAYMENT_METHOD`, `BANK_NAME`, `MOBILE_PROVIDER`
- `CHANNEL`, `PAYMENT_SOURCE`
- `TRANSACTION_REFERENCE`, `PAYMENT_STATUS`

### Relationships
- Many payments → one student
- Many payments → one semester (via `SEMESTER_INDEX`)

---

# 3) Fact: Sponsorship / Scholarship Disbursements

## Table: `student_sponsorships_list15` / `student_sponsorships_list16`  
**Grain:** 1 row per sponsor disbursement event (often per semester)

### Keys
- **PK:** `SPONSOR_PAYMENT_ID`
- **FK:** `REG_NO` → `students.REG_NO`

### Columns
- `SPONSOR_PAYMENT_ID`
- `REG_NO`, `ACC_NO`
- `SPONSOR_NAME`
- `SCHOLARSHIP_TYPE`
- `SEMESTER_INDEX`, `ACADEMIC_YEAR`
- `AMOUNT_SPONSORED_UGX`
- `DISBURSEMENT_DATE`
- `SPONSOR_REFERENCE`
- `STATUS`

### Relationships
- Many sponsorships → one student
- Many sponsorships → one semester

---

# 4) Fact: Course Grades

## Table: `student_grades_list15` / `student_grades_list16`  
**Grain:** 1 row per (student × course × semester)

### Keys
- **PK (recommended composite):** (`REG_NO`, `SEMESTER_INDEX`, `COURSE_CODE`)
- Alternate unique: `RECORD_ID`
- **FK:** `REG_NO` → `students.REG_NO`
- **FK:** (`PROGRAM`, `SEMESTER_INDEX`, `COURSE_CODE`) → `course_catalog`

### Columns
- Student context:
  - `REG_NO`, `ACC_NO`, `PROGRAM`
  - `ACADEMIC_YEAR`, `SEMESTER`, `SEMESTER_INDEX`
- Course context:
  - `COURSE_CODE`, `COURSE_TITLE`, `COURSE_UNITS`
- Assessment:
  - `CW_MARK_60`, `EXAM_MARK_40`, `FINAL_MARK_100`
  - `STATUS` (Completed / FCW / FEX / MEX)
  - `MEX_REASON`
- Outcomes:
  - `LETTER_GRADE`, `GRADE_POINTS`

### Business Rules (high-level)
- `CW < 17/60` → `FCW`
- Exam missing but registered → `MEX` (+ `MEX_REASON`)
- `EXAM < 17/40` → `FEX`
- `FINAL < 50` → fail (`FEX`)
- Otherwise → Completed (A–D)

---

# 5) Dimension: Course Catalog

## Table: `course_catalog_ucu`  
**Grain:** 1 row per (program × semester × course)

### Keys
- **PK (recommended composite):** (`PROGRAM`, `SEMESTER_INDEX`, `COURSE_CODE`)

### Columns
- `PROGRAM`
- `SEMESTER_INDEX`
- `COURSE_CODE`
- `COURSE_TITLE`
- `COURSE_UNITS`
- `COURSE_TYPE` (CORE/ELECTIVE)

### Relationships
- One course catalog row → many grade rows (per student)

---

# 6) Fact: Semester GPA

## Table (sheet): `SEMESTER_GPA` (inside grade summaries)  
**Grain:** 1 row per (student × semester)

### Keys
- **PK (recommended composite):** (`REG_NO`, `SEMESTER_INDEX`)
- **FK:** `REG_NO` → `students.REG_NO`

### Columns
- `REG_NO`
- `SEMESTER_INDEX`
- `SEMESTER_GPA`

---

# 7) Fact: Student CGPA

## Table (sheet): `STUDENT_CGPA` (inside grade summaries)  
**Grain:** 1 row per student

### Keys
- **PK:** `REG_NO`
- **FK:** `REG_NO` → `students.REG_NO`

### Columns
- `REG_NO`
- `CGPA`
- `SEMESTERS_COUNT`
- (Optional) last semester metrics

---

# 8) Fact: Academic Progression / Retake History

## Table: `academic_progression_list15` / `academic_progression_list16`  
**Grain:** 1 row per (student × course × attempt/semester)

### Keys
- **PK:** `PROGRESSION_ID`
- **FK:** `REG_NO` → `students.REG_NO`
- **FK:** `COURSE_CODE` → `course_catalog.COURSE_CODE` (recommended via composite with program+semester)

### Columns
- `PROGRESSION_ID`
- `REG_NO`
- `COURSE_CODE`
- `SEMESTER_INDEX`
- `STATUS`
- `ATTEMPT_NUMBER`
- `RETAKE_FLAG`
- `PROGRESSION_STATUS` (NORMAL / RETAKE_REQUIRED)

### Relationships
- One grade record can map to one progression record, but progression is more “attempt-aware”.

---

# 9) Fact: Attendance

## Table: `student_attendance_list15` / `student_attendance_list16`  
**Grain:** 1 row per (student × day)

### Keys
- **PK (recommended composite):** (`REG_NO`, `DATE`)
- **FK:** `REG_NO` → `students.REG_NO`

### Columns
- `REG_NO`, `ACC_NO`
- `DATE`
- `SEMESTER_INDEX`
- `STATUS` (PRESENT / LATE / ABSENT)

### Notes
- Generated for weekdays only (Mon–Fri)
- Historical coverage from first semester up to the defined cutoff date

---

# ERD Relationship Map (Text)
             +---------------------+
             |       Students      |
             |  PK: REG_NO         |
             |  AK: ACC_NO         |
             +----------+----------+
                        |
    +-------------------+-------------------+-------------------+-------------------+
    |                   |                   |                   |                   |
    +-------v--------+ +-------v--------+ +--------v--------+ +-------v--------+ +------v------+
| Payments | | Sponsorships | | Attendance | | Semester GPA | | Student CGPA|
| PK: PAYMENT_ID | | PK: SPONSOR... | | PK: REG_NO+DATE | | PK: REG+SEM | | PK: REG_NO |
| FK: REG_NO | | FK: REG_NO | | FK: REG_NO | | FK: REG_NO | | FK: REG_NO |
+----------------+ +----------------+ +------------------+ +----------------+ +-------------+
                  +-----------------------+
                  |     Course Catalog    |
                  | PK: PROG+SEM+COURSE   |
                  +----------+------------+
                             |
                       +-----v------+
                       |   Grades   |
                       | PK: REG+   |
                       | SEM+COURSE |
                       | FK: REG_NO |
                       +-----+------+
                             |
                       +-----v----------------+
                       | Academic Progression |
                       | PK: PROGRESSION_ID   |
                       | FK: REG_NO           |
                       | FK: COURSE_CODE      |
                       +----------------------+



---

# Recommended BI Star Schema (Power BI)

### Dimensions
- `dim_student` (from Students)
- `dim_course` (from Course Catalog)
- `dim_date` (generated calendar table)
- Optional: `dim_program` (distinct programs)

### Facts
- `fact_payments`
- `fact_sponsorships`
- `fact_grades`
- `fact_attendance`
- `fact_semester_gpa`
- `fact_progression`

---

# Data Quality Expectations (Analytics)
- `REG_NO` and `ACC_NO` should remain unique in Students.
- Payment totals by semester should align with expected fees and sponsorship logic.
- Grade status rules:
  - `FCW` implies CW below threshold and exam not applicable.
  - `MEX` implies missing exam.
  - `FEX` implies exam below threshold or total < 50.
- Attendance should exclude weekends.

---