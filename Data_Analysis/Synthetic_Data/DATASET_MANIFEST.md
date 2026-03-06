# NextGen Analytics Dataset Manifest

## Scope

This manifest is the technical index of datasets currently available in:

- `backend/data/Synthetic_Data/`

It provides a quick reference for ETL, analytics engineering, dashboard modeling, and quality validation.

---

## 1) Dataset Inventory (Current)

### Academic Structure

| File | Domain | Grain | Primary Key / Unique |
|---|---|---|---|
| `faculties_departments.csv` | Reference hierarchy | 1 row per faculty x department x program | (`faculty_id`, `department_id`, `program_id`) |
| `course_catalog_ucu.csv` | Course reference | 1 row per program x semester x course | (`PROGRAM`, `SEMESTER_INDEX`, `COURSE_CODE`) |

### Student Master

| File | Domain | Grain | Primary Key / Unique |
|---|---|---|---|
| `students_list15.xlsx` | Student dimension snapshot | 1 row per student | `REG_NO` (alt: `ACC_NO`) |
| `students_list16.xlsx` | Student dimension snapshot | 1 row per student | `REG_NO` (alt: `ACC_NO`) |

### Academic Outcomes

| File | Domain | Grain | Primary Key / Unique |
|---|---|---|---|
| `student_grades_list15.csv` | Course-level outcomes | 1 row per student x course x semester | `RECORD_ID` (recommended composite: `REG_NO`,`SEMESTER_INDEX`,`COURSE_CODE`) |
| `student_grades_list16.csv` | Course-level outcomes | 1 row per student x course x semester | `RECORD_ID` (recommended composite: `REG_NO`,`SEMESTER_INDEX`,`COURSE_CODE`) |
| `student_transcript_list15.csv` | Semester transcript | 1 row per student x semester | (`REG_NO`, `SEMESTER_INDEX`) |
| `student_transcript_list16.csv` | Semester transcript | 1 row per student x semester | (`REG_NO`, `SEMESTER_INDEX`) |
| `fact_student_academic_performance_list15.csv` | Semester performance fact | 1 row per student x semester | (`REG_NO`, `SEMESTER_INDEX`) |
| `fact_student_academic_performance_list16.csv` | Semester performance fact | 1 row per student x semester | (`REG_NO`, `SEMESTER_INDEX`) |
| `student_grades_summary_list15.xlsx` | GPA/CGPA summaries | Multi-sheet summary by student | sheet-specific keys (`SEMESTER_GPA`, `STUDENT_CGPA`) |
| `student_grades_summary_list16.xlsx` | GPA/CGPA summaries | Multi-sheet summary by student | sheet-specific keys (`SEMESTER_GPA`, `STUDENT_CGPA`) |
| `academic_progression_list15.xlsx` | Progression/retake history | 1 row per student x course x attempt | `PROGRESSION_ID` |
| `academic_progression_list16.xlsx` | Progression/retake history | 1 row per student x course x attempt | `PROGRESSION_ID` |

### Engagement

| File | Domain | Grain | Primary Key / Unique |
|---|---|---|---|
| `student_attendance_list15.csv` | Attendance events | 1 row per student x day | (recommended) (`REG_NO`, `DATE`) |
| `student_attendance_list16.csv` | Attendance events | 1 row per student x day | (recommended) (`REG_NO`, `DATE`) |

### Financials

| File | Domain | Grain | Primary Key / Unique |
|---|---|---|---|
| `student_payments_list15.csv` | Tuition payment transactions | 1 row per payment transaction | `PAYMENT_ID` |
| `student_payments_list16.csv` | Tuition payment transactions | 1 row per payment transaction | `PAYMENT_ID` |
| `student_sponsorships_list15.csv` | Scholarship/sponsor disbursements | 1 row per sponsor event | `SPONSOR_PAYMENT_ID` |
| `student_sponsorships_list16.csv` | Scholarship/sponsor disbursements | 1 row per sponsor event | `SPONSOR_PAYMENT_ID` |

### Documentation

| File | Purpose |
|---|---|
| `ucu_analytics_master_technical_documentation.md` | Unified technical documentation (architecture, schema, BI, analytics) |
| `Data_info/data_description.pdf` | Supporting narrative description |
| `Data_info/data_shema.pdf` | Supporting schema document |

---

## 2) Join Map (Operational)

Core student joins:

- `REG_NO` is the principal join key across students, grades, attendance, payments, sponsorships, progression, transcript, and semester performance facts.
- `ACC_NO` is an alternate student identifier where present.

Course joins:

- `COURSE_CODE` joins grades/progression to `course_catalog_ucu.csv`.
- Use `PROGRAM` + `SEMESTER_INDEX` + `COURSE_CODE` for strict catalog validation.

Hierarchy joins:

- `PROGRAM` from student/course datasets maps to `program_name` in `faculties_departments.csv`.
- `faculty_id`/`department_id`/`program_id` can be used for dimensional conformance in warehouse loads.

---

## 3) Business Rule Anchors (Grades)

Expected rule behavior encoded in datasets and downstream ETL:

- Coursework threshold: `CW_MARK_60 < 17` -> `FCW`
- Exam missing with registration context -> `MEX` (+ reason where available)
- Exam threshold: `EXAM_MARK_40 < 17` -> `FEX`
- `FINAL_MARK_100 < 50` -> fail outcome

Grade bands / points:

- A (80-100) -> 5.0
- B+ (75-79) -> 4.5
- B (70-74) -> 4.0
- C+ (65-69) -> 3.5
- C (60-64) -> 3.0
- D+ (55-59) -> 2.5
- D (50-54) -> 2.0
- F (0-49) -> 1.5

---

## 4) ETL Readiness Notes

Recommended processing order:

1. `faculties_departments.csv` (hierarchy dimensions)
2. student master (`students_list15/16`)
3. `course_catalog_ucu.csv`
4. transactional facts (`student_grades`, `student_attendance`, `student_payments`, `student_sponsorships`)
5. progression/transcript/performance summary layers

Validation checks before load:

- duplicate keys (`REG_NO`, `PAYMENT_ID`, `SPONSOR_PAYMENT_ID`, `RECORD_ID`, `PROGRESSION_ID`)
- null key rates
- orphan records (facts without matching students or course catalog)
- grade rule consistency (`STATUS` vs score thresholds)

---

## 5) Versioning / Governance

- Treat this folder as the canonical demo data package for analytics testing.
- Keep schema or naming changes reflected in:
  - `ucu_analytics_master_technical_documentation.md`
  - this `DATASET_MANIFEST.md`
- For reproducibility, tag dataset versions if regenerating synthetic data.

---

