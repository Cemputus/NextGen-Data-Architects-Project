# Data Description
## University Analytics System

This document describes the datasets generated for the University Analytics System, the business rules used to create them, and the criteria that govern their structure, quality, and analytical use.

---

# 1. Project Purpose

The project simulates a university data warehouse that integrates:

- student master data
- enrollment data
- academic structure
- course catalog data
- grades and transcript data
- academic performance data
- payments and sponsorships
- attendance data
- high school recruitment data
- calendar and time intelligence

The datasets are designed to support:

- executive reporting
- academic monitoring
- student risk analytics
- finance analytics
- marketing and recruitment analytics
- SQL-based analysis through the NextGen Query page

---

# 2. Global Data Generation Criteria

The following criteria apply across the generated dataset family.

## 2.1 Completeness criteria
The following fields must never be empty in the student master datasets:

- `REG. NO.`
- `ACC. NO.`
- `NAME`
- `PROGRAM`

## 2.2 Uniqueness criteria
The following identifiers must be unique:

- `REG. NO.`
- `ACC. NO.`

No two students should share the same registration number or access number.

## 2.3 Faculty and department coverage criteria
The dataset must ensure that:

- all 11 faculties/schools have students
- all 18 departments have students
- all programs in the academic structure table have students

## 2.4 Faculty size distribution criteria
Student distribution must follow the priority order below:

1. School of Law — highest student population
2. School of Business — second highest
3. School of Social Sciences — third
4. School of Engineering, Design and Technology — next
5. remaining faculties/schools also represented

## 2.5 Name generation criteria
To reduce unrealistic repetition:

- Ugandan students use a wider Ugandan name pool
- international students use international name pools
- names are generated to reduce excessive duplication

## 2.6 Timeline criteria
The generated data must follow the following time limits:

- payment dates must not exceed January 2026
- grades must not exceed the latest completed semester before January 2026
- attendance extends up to March 15, 2026

## 2.7 Enrollment criteria
An enrollment dataset must exist for all students and should include:

- bio data
- academic placement
- intake
- current progression
- high school linkage

---

# 3. Registration Number Criteria

Registration numbers follow the pattern:

`[K optional][J|M|S][YY][B|D|M][PROGRAM_ID]/[SERIAL]`

Example:

`J22B13/006`

### Meaning
- `J` = January intake
- `22` = admission year 2022
- `B` = Bachelor
- `13` = program id
- `006` = student sequence number within that program and intake

Other examples:
- `M22B11/098`
- `S22B23/017`

## 3.1 Intake criteria
- `J` = January intake, Easter Semester
- `M` = May intake, Trinity Semester
- `S` = September intake, Advent Semester

## 3.2 Campus criteria
If the registration number starts with `K`, the student is a Kampala campus student.  
If it does not start with `K`, the student is a Mukono campus student.

Example:
- `KJ24B11/005` = Kampala campus
- `J24B11/005` = Mukono campus

## 3.3 Serial number criteria
The digits after the slash identify the student within that intake and program.

This means:

- `M23B38/005` and `S23B38/005` can both exist
- because they belong to different intakes

---

# 4. Progression and Duration Criteria

## 4.1 Program duration criteria
The project follows these duration assumptions:

- Diploma, Masters, and Postgraduate programs = 4 semesters
- Most Bachelor programs = 6 semesters
- Law and Engineering = 8 semesters
- Bachelor of Medicine and Bachelor of Surgery = 15 semesters

## 4.2 Annual semester progression criteria
Most students complete:

- 2 semesters per academic year

MBChB students complete:

- 3 semesters per academic year

## 4.3 Intake progression criteria

### January intake
A student starting in January typically studies:

- January semester as Year 1 Semester 1
- May semester as Year 1 Semester 2
- skips September
- returns in January of the following year

### May intake
A student starting in May typically studies:

- May semester as Year 1 Semester 1
- September semester as Year 1 Semester 2
- skips January
- returns in May of the following year

### September intake
A student starting in September typically studies:

- September semester as Year 1 Semester 1
- January semester as Year 1 Semester 2
- skips May
- returns in September of the following year

## 4.4 Total registrations criteria
`TOTAL REGISTRATIONS` depends on:

- admission year
- intake cycle
- program duration
- retake registrations
- the cut-off date of the simulation

This means a continuing student may have fewer registrations than the full program duration.

---

# 5. Student Master Data

## `students_list15_regenerated`
## `students_list16_regenerated`

These are the main student datasets.

Each row represents one student.

### Main fields
- `ACC. NO.` — unique student access number
- `REG. NO.` — unique registration number
- `NAME` — student name
- `PROGRAM` — enrolled program
- `FACULTY/SCHOOL` — faculty or school
- `DEPARTMENT` — department
- `PROGRAM ID` — program identifier
- `AWARD TYPE` — Bachelor, Diploma, or Masters code
- `ADMISSION YEAR` — year of admission
- `INTAKE` — J, M, or S intake
- `CAMPUS` — Kampala or Mukono
- `YEAR` — current year of study
- `SEMESTER` — current semester position
- `TOTAL REGISTRATIONS` — number of registrations completed
- `NATIONALITY` — nationality
- `RESIDENCE` — resident or non-resident
- `ACCOMMODATION Type` — room category
- `REGISTRATION TYPE` — normal or late registration
- `STUDENT STATUS` — active, continuing, finalist, or retake
- `FEES` — fees percentage indicator
- `EXPECTED FEES(%) - RAW` — raw payment percentage
- `EXPECTED FEES(%) - RANGE` — fee completion band
- `TOTAL EXPECTED FEES (UGX)` — total expected charges
- `AMOUNT PAID (UGX)` — amount already paid
- `TUITION BALANCE (UGX)` — outstanding balance
- `ACADEMIC OFFICER`
- `ACCOMMODATION OFFICER`
- `ACCOUNTS OFFICER`
- `FINANCIAL AID OFFICER`
- `SCHOLARSHIP TYPE`
- `SCHOLARSHIP NAME`
- `HIGH_SCHOOL`
- `DISTRICT`
- `SCHOOL_TIER`
- `OWNERSHIP`

### Student master data criteria
- no empty `REG. NO.`
- no empty `ACC. NO.`
- no empty `NAME`
- no empty `PROGRAM`
- unique `REG. NO.`
- unique `ACC. NO.`
- valid intake logic
- valid campus logic
- valid progression logic
- valid fee logic

---

# 6. Enrollment Data

## `enrollment_list15`
## `enrollment_list16`
## `enrollment_all`

These datasets are enrollment-oriented views of the student master data.

### Main use
- admissions analytics
- registration analytics
- enrollment by faculty, department, and program
- recruitment analysis
- student bio-data review

### Key fields
- `ACC_NO`
- `REG_NO`
- `NAME`
- `PROGRAM`
- `FACULTY_SCHOOL`
- `DEPARTMENT`
- `PROGRAM ID`
- `AWARD TYPE`
- `ADMISSION YEAR`
- `INTAKE`
- `CAMPUS`
- `YEAR`
- `SEMESTER`
- `TOTAL REGISTRATIONS`
- `NATIONALITY`
- `HIGH_SCHOOL`
- `DISTRICT`
- `SCHOOL_TIER`
- `OWNERSHIP`
- `SOURCE_LIST`

### Enrollment criteria
Enrollment records must preserve:

- identity integrity
- academic placement
- intake identity
- high school source
- student list origin

---

# 7. Academic Structure Data

## `faculties_departments`

This dataset defines the academic hierarchy.

### Main fields
- `faculty_id`
- `faculty_name`
- `department_id`
- `department_name`
- `program_id`
- `program_name`

### Academic coverage criteria
- every faculty represented
- every department represented
- every program represented

---

# 8. High School Dimension

## `high_schools_dimension`

This dataset contains the school reference table used in recruitment analytics.

### Main fields
- `SCHOOL_NAME`
- `DISTRICT`
- `SCHOOL_TIER`
- `OWNERSHIP`

### School criteria
The school dimension is used to support:

- feeder school analysis
- district analysis
- school performance analysis
- school-based retention analysis

---

# 9. Student High School Mapping

## `student_high_schools_list15`
## `student_high_schools_list16`
## `student_high_schools_all`

Each row links one student to one high school.

### Main fields
- `REG_NO`
- `ACC_NO`
- `PROGRAM`
- `HIGH_SCHOOL`
- `DISTRICT`
- `SCHOOL_TIER`
- `OWNERSHIP`
- `STUDENT_LIST` in combined dataset

### Mapping criteria
- each student must map to one school
- the mapping must remain joinable by `REG_NO`
- the mapping should support school-level recruitment analytics

---

# 10. Course Catalog

## `course_catalog_ucu_actual_titles`

Each row represents one course in one semester of a program.

### Main fields
- `PROGRAM`
- `SEMESTER_INDEX`
- `COURSE_CODE`
- `COURSE_TITLE`
- `COURSE_UNITS`
- `COURSE_TYPE`

### Catalog criteria
- course codes must remain stable
- courses must support joins with grades and progression
- most semesters should contain 6 to 7 courses

---

# 11. Grades Data

## `student_grades_list15_updated_titles`
## `student_grades_list16_updated_titles`

Each row represents one student in one course in one semester.

### Main fields
- `RECORD_ID`
- `REG_NO`
- `ACC_NO`
- `PROGRAM`
- `ACADEMIC_YEAR`
- `SEMESTER`
- `SEMESTER_INDEX`
- `COURSE_CODE`
- `COURSE_TITLE`
- `COURSE_UNITS`
- `CW_MARK_60`
- `EXAM_MARK_40`
- `FINAL_MARK_100`
- `STATUS`
- `MEX_REASON`
- `LETTER_GRADE`
- `GRADE_POINTS`

### Grading criteria
- coursework carries 60%
- exam carries 40%
- if coursework is below 17, status becomes `FCW`
- if the exam is missing, status becomes `MEX`
- if exam is below 17, status becomes `FEX`
- if total mark is below 50, status becomes `FEX`

### Status meaning
- `Completed`
- `FCW`
- `FEX`
- `MEX`

### Grade timeline criteria
No results should go beyond the latest completed semester before January 2026.

---

# 12. Transcript Data

## `student_transcript_list15`
## `student_transcript_list16`

Each row represents one student for one semester.

### Main fields
- `REG_NO`
- `ACC_NO`
- `PROGRAM`
- `ACADEMIC_YEAR`
- `SEMESTER`
- `SEMESTER_INDEX`
- `CREDITS_ATTEMPTED`
- `QUALITY_POINTS`
- `COURSES_COUNT`
- `PASSED_COURSES`
- `FAILED_COURSES`
- `FCW_COUNT`
- `FEX_COUNT`
- `MEX_COUNT`
- `CREDITS_PASSED`
- `CREDITS_FAILED`
- `SEMESTER_GPA`
- `CUM_CREDITS_ATTEMPTED`
- `CUM_CREDITS_PASSED`
- `CUM_QUALITY_POINTS`
- `CGPA`

### Transcript criteria
- GPA must be derived from grade points and course units
- CGPA must be cumulative
- credits attempted and passed must align with course results

---

# 13. Academic Performance Fact Table

## `fact_student_academic_performance_list15`
## `fact_student_academic_performance_list16`

Each row represents one student in one semester.

### Main fields
- `REG_NO`
- `ACC_NO`
- `PROGRAM`
- `ACADEMIC_YEAR`
- `SEMESTER`
- `SEMESTER_INDEX`
- `COURSES_REGISTERED`
- `TOTAL_CREDITS`
- `QUALITY_POINTS`
- `PASSED_COURSES`
- `FAILED_COURSES`
- `FCW_COUNT`
- `FEX_COUNT`
- `MEX_COUNT`
- `SEMESTER_GPA`

### Performance criteria
This dataset must be consistent with transcript and grades datasets.

---

# 14. Academic Progression Data

## `academic_progression_list15`
## `academic_progression_list16`

Each row represents one student-course progression attempt.

### Main fields
- `PROGRESSION_ID`
- `REG_NO`
- `COURSE_CODE`
- `SEMESTER_INDEX`
- `STATUS`
- `ATTEMPT_NUMBER`
- `RETAKE_FLAG`
- `PROGRESSION_STATUS`

### Progression criteria
- repeated attempts must increment `ATTEMPT_NUMBER`
- retake logic must align with failed or missed courses

---

# 15. Payments Data

## `student_payments_list15_realistic`
## `student_payments_list16_realistic`

Each row represents one payment transaction.

### Main fields
- `PAYMENT_ID`
- `REG_NO`
- `ACC_NO`
- `ACADEMIC_YEAR`
- `SEMESTER`
- `SEMESTER_INDEX`
- `PAYMENT_DATE`
- `AMOUNT_UGX`
- `PAYMENT_METHOD`
- `BANK_NAME`
- `MOBILE_PROVIDER`
- `CHANNEL`
- `PAYMENT_SOURCE`
- `TRANSACTION_REFERENCE`
- `PAYMENT_STATUS`

### Payment criteria
- all payment dates must be January 2026 and earlier
- payment dates must align with admission year and semester sequence
- students may make multiple payments in one semester

---

# 16. Sponsorship Data

## `student_sponsorships_list15`
## `student_sponsorships_list16`

Each row represents one sponsorship disbursement.

### Main fields
- `SPONSOR_PAYMENT_ID`
- `REG_NO`
- `ACC_NO`
- `SPONSOR_NAME`
- `SCHOLARSHIP_TYPE`
- `SEMESTER_INDEX`
- `ACADEMIC_YEAR`
- `AMOUNT_SPONSORED_UGX`
- `DISBURSEMENT_DATE`
- `SPONSOR_REFERENCE`
- `STATUS`

### Sponsorship criteria
- sponsorships must remain joinable to students
- sponsorship amounts should be analytically meaningful for finance reporting

---

# 17. Attendance Data

## `student_attendance_list15`
## `student_attendance_list16`

Each row represents one student on one date.

### Main fields
- `REG_NO`
- `ACC_NO`
- `DATE`
- `SEMESTER_INDEX`
- `STATUS`

### Attendance criteria
- weekdays only
- weekends excluded
- attendance extends up to March 15, 2026
- attendance must align with valid semester progression

---

# 18. Date Dimension

## `dim_date_2022_2026`

This is the calendar dimension table.

### Main fields
- `date_key`
- `full_date`
- `day`
- `day_name`
- `day_of_week_num`
- `is_weekend`
- `week_of_year`
- `month_num`
- `month_name`
- `month_short`
- `quarter`
- `year`
- `year_month`
- `academic_year`
- `academic_term`
- `intake_window`

### Date dimension criteria
The date dimension must support:
- payment trend analysis
- attendance trend analysis
- semester trend analysis
- time intelligence in BI dashboards

---

# 19. Data Relationships

Main join keys:

- `REG_NO` links student-level datasets
- `ACC_NO` supports identity cross-checking
- `COURSE_CODE` links grades, progression, and course catalog
- `PROGRAM` links students to course catalog and academic structure
- date fields link to `dim_date`

### Example joins
- students ↔ transcript via `REG_NO`
- students ↔ payments via `REG_NO`
- students ↔ attendance via `REG_NO`
- students ↔ student_high_schools via `REG_NO`
- grades ↔ course_catalog via `COURSE_CODE`
- students ↔ faculties_departments via `PROGRAM`

---

# 20. Recommended Use Cases

These datasets support:

- enrollment analytics
- academic performance analytics
- course difficulty analysis
- student risk detection
- tuition and finance analytics
- sponsorship analytics
- attendance analytics
- feeder school analysis
- recruitment marketing analytics
- executive institutional reporting

---

# 21. Final Note

The dataset family was designed to simulate a realistic university analytics environment with consistent registration logic, academic timelines, finance behavior, recruitment intelligence, and strong data quality criteria.

It is suitable for:
- Power BI dashboards
- SQL analytics
- final year project demonstrations
- institutional BI modeling
- advanced analytics experimentation
