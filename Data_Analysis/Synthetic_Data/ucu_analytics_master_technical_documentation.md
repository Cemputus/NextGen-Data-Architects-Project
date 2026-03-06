# NextGen Analytics System
## Master Technical Documentation 
---

## Document Intent

This document merges and expands the content from:

- `Data_info/data_architecture.md`
- `Data_info/data_description.md`
- `Data_info/overall.md`
- `Data_info/advanced_bi_analytics.md`
- `Data_info/analytics_recommendations.md`
- `Data_info/university_analytics_complete_documentation.md`
- `Data_info/data_shema.md`

The goal is to provide one professional reference for:

- data architecture and warehouse design
- data dictionary and schema constraints
- BI dashboard design and metrics
- grading rules and academic business logic
- advanced analytics and predictive opportunities
- implementation readiness for ETL and analytics teams

No domain information from the source documents is intentionally removed; overlapping sections are harmonized and expanded.

---

## 1) System Overview

The University Analytics System is an integrated institutional analytics platform designed for:

- academic performance intelligence
- finance and tuition monitoring
- attendance and engagement analysis
- student risk detection and intervention support
- SQL-first exploration via NextGen Query

The platform models university operations with anonymized synthetic data aligned to UCU-style policies and supports BI, decision support, and predictive analytics workflows.

Core operating domains:

- **Academic:** grades, progression, GPA/CGPA, course structure
- **Financial:** tuition payments, sponsorships/scholarships, balances
- **Engagement:** attendance and behavioral proxies
- **Reference hierarchy:** faculty -> department -> program
- **Time intelligence:** semester, academic year, date-driven slicing

---

## 2) End-to-End Analytics Architecture

### 2.1 Logical Flow

```text
Operational/Generated Source Data
            ↓
     ETL / Data Preparation
            ↓
   Warehouse Dimensions + Facts
            ↓
  BI Dashboards + Query Layer
            ↓
 Strategic Insights / Interventions
```

### 2.2 Architecture Style

Hybrid analytical model:

- **Dimension tables** for stable descriptive context
- **Fact tables** for measurable events and outcomes
- star-schema-inspired modeling for BI performance and semantic simplicity

Suitable for:

- Power BI semantic models
- SQL warehouse reporting
- institutional scorecards
- feature engineering for machine learning

---

## 3) Data Asset Inventory (Current Folder Context)

Current `Synthetic_Data` folder includes the following major assets:

- `students_list15.xlsx`
- `students_list16.xlsx`
- `student_payments_list15.csv`
- `student_payments_list16.csv`
- `student_sponsorships_list15.csv`
- `student_sponsorships_list16.csv`
- `student_grades_list15.csv`
- `student_grades_list16.csv`
- `student_grades_summary_list15.xlsx`
- `student_grades_summary_list16.xlsx`
- `academic_progression_list15.xlsx`
- `academic_progression_list16.xlsx`
- `student_attendance_list15.csv`
- `student_attendance_list16.csv`
- `student_transcript_list15.csv`
- `student_transcript_list16.csv`
- `fact_student_academic_performance_list15.csv`
- `fact_student_academic_performance_list16.csv`
- `course_catalog_ucu.csv`
- `course_catalog_ucu.xlsx`
- `faculties_departments.csv`
- `dim_date_2022_2026.xlsx`
- `data_generation.py`
Supporting documentation:

- `Data_info/data_shema.md` and `Data_info/data_shema.pdf`
- `Data_info/data_description.md` and `Data_info/data_description.pdf`
- plus additional BI/overall docs merged in this master reference

---

## 4) Canonical Data Model

### 4.1 Entity Relationship Backbone

```text
faculties_departments (faculty -> department -> program)
                |
                v
             students (REG_NO)
     +----------+----------+----------+-----------+
     v          v          v          v           v
 payments   sponsorships  attendance  grades   transcript/performance
                                    |
                                    v
                              academic_progression
```

### 4.2 Core Relationships

- One student -> many payments
- One student -> many sponsorship events
- One student -> many attendance events
- One student -> many grade records
- One student -> many progression events
- One student -> many semester GPA records
- One student -> one CGPA record (latest cumulative state)
- Course catalog constrains valid course offerings by program and semester
- Faculty/department/program hierarchy supports scoped analytics and drill-down

---

## 5) Grain, Keys, and Constraints by Dataset

### 5.1 Students (dimension-like)

- **Tables/files:** `students_list15.xlsx`, `students_list16.xlsx`
- **Grain:** one row per student snapshot
- **Primary key:** `REG_NO`
- **Alternate key:** `ACC_NO`
- **Critical columns:** `PROGRAM`, `TOTAL_REGISTRATIONS`, residence/accommodation, fee expectation fields

### 5.2 Payments

- **Tables/files:** `student_payments_list15.csv`, `student_payments_list16.csv`
- **Grain:** one row per payment transaction
- **Primary key:** `PAYMENT_ID`
- **Foreign keys:** `REG_NO` -> students, optional `ACC_NO`
- **Important fields:** `ACADEMIC_YEAR`, `SEMESTER`, `SEMESTER_INDEX`, `AMOUNT_UGX`, `PAYMENT_METHOD`, `PAYMENT_STATUS`

### 5.3 Sponsorships

- **Tables/files:** `student_sponsorships_list15.csv`, `student_sponsorships_list16.csv`
- **Grain:** one row per sponsor disbursement
- **Primary key:** `SPONSOR_PAYMENT_ID`
- **Foreign key:** `REG_NO` -> students
- **Important fields:** sponsor metadata, disbursement date, semester alignment, sponsored amount

### 5.4 Grades

- **Tables/files:** `student_grades_list15.csv`, `student_grades_list16.csv`
- **Grain:** one row per student x course x semester
- **Recommended composite key:** (`REG_NO`, `SEMESTER_INDEX`, `COURSE_CODE`)
- **Alternate record key:** `RECORD_ID` (if present in generated variants)
- **Key fields:** `CW_MARK_60`, `EXAM_MARK_40`, `FINAL_MARK_100`, `STATUS`, `MEX_REASON`, `LETTER_GRADE`, `GRADE_POINTS`

### 5.5 Course Catalog

- **Tables/files:** `course_catalog_ucu.csv`, `course_catalog_ucu.xlsx`
- **Grain:** one row per program x semester x course
- **Recommended key:** (`PROGRAM`, `SEMESTER_INDEX`, `COURSE_CODE`)
- **Fields:** `COURSE_TITLE`, `COURSE_UNITS`, `COURSE_TYPE`

### 5.6 Semester GPA / Student CGPA

- **Files:** `student_grades_summary_list15.xlsx`, `student_grades_summary_list16.xlsx`
- **Sheets/entities:** `SEMESTER_GPA`, `STUDENT_CGPA`
- **Grain (semester):** one row per student x semester
- **Grain (cgpa):** one row per student

### 5.7 Academic Progression

- **Files:** `academic_progression_list15.xlsx`, `academic_progression_list16.xlsx`
- **Grain:** one row per student x course x attempt
- **Primary key:** `PROGRESSION_ID`
- **Core fields:** `ATTEMPT_NUMBER`, `RETAKE_FLAG`, `PROGRESSION_STATUS`, course/semester linkage

### 5.8 Attendance

- **Files:** `student_attendance_list15.csv`, `student_attendance_list16.csv`
- **Grain:** one row per student x date (and optionally course)
- **Recommended key:** (`REG_NO`, `DATE`)
- **Field:** `STATUS` in `PRESENT | LATE | ABSENT`
- **Quality rule:** weekdays-only generation unless explicitly configured otherwise

### 5.9 Faculty-Department-Program Mapping

- **File:** `faculties_departments.csv`
- **Grain:** one row per faculty x department x program
- **Fields:** `faculty_id`, `faculty_name`, `department_id`, `department_name`, `program_id`, `program_name`

---

## 6) Academic Assessment and Grading Rules

### 6.1 Assessment Weights

- Coursework contributes **60%**
- Final exam contributes **40%**

### 6.2 Threshold Rules

- If coursework < 17/60 -> `FCW` (Failed Coursework), exam not qualified
- If exam missing for a registered candidate -> `MEX` (Missed Exam), with `MEX_REASON`
- If exam < 17/40 -> `FEX` (Failed Exam)
- If total mark < 50 -> fail outcome (commonly `FEX` classed as failure state)
- Otherwise -> `Completed` with pass/fail derived from total and grading band

### 6.3 Final Mark

```text
FINAL_MARK_100 = CW_MARK_60 + EXAM_MARK_40
```

### 6.4 Grade Band and GPA Mapping

| Letter | Score Range | Grade Points |
|---|---|---|
| A | 80-100 | 5.0 |
| B+ | 75-79 | 4.5 |
| B | 70-74 | 4.0 |
| C+ | 65-69 | 3.5 |
| C | 60-64 | 3.0 |
| D+ | 55-59 | 2.5 |
| D | 50-54 | 2.0 |
| F | 0-49 | 1.5 |

### 6.5 GPA and CGPA Logic

- **Semester GPA**:

```text
SUM(COURSE_UNITS x GRADE_POINTS) / SUM(COURSE_UNITS)
```

- **CGPA**:

```text
Average of semester GPAs (or cumulative weighted quality-points method where configured)
```

- Maximum CGPA benchmark: **5.0**

---

## 7) Warehouse and Star-Schema Recommendation

### 7.1 Recommended Dimensions

- `dim_student`
- `dim_program`
- `dim_department` / `dim_faculty` (or combined `dim_faculty_department`)
- `dim_course`
- `dim_date`

### 7.2 Recommended Facts

- `fact_grades`
- `fact_payments`
- `fact_sponsorships`
- `fact_attendance`
- `fact_academic_performance`
- `fact_transcript`
- `fact_progression`

### 7.3 Semantic Principles

- Use conformed dimensions (`dim_student`, `dim_date`, `dim_course`) across facts
- Preserve raw status values (`Completed`, `FCW`, `FEX`, `MEX`) for explainable analytics
- Publish curated KPI views for BI tools to avoid repeated complex SQL in dashboards

---

## 8) BI Layer: KPI Catalog

### 8.1 Academic KPIs

- average GPA
- pass rate / fail rate
- FCW/FEX/MEX rates
- retake rate
- GPA trend by semester
- GPA by faculty/department/program

### 8.2 Financial KPIs

- total tuition expected
- total tuition paid
- outstanding balance
- payment completion rate
- sponsorship coverage percent
- sponsorship concentration by faculty/program

### 8.3 Engagement KPIs

- attendance rate
- lateness rate
- absenteeism rate
- attendance vs GPA correlation

### 8.4 Strategic KPIs

- at-risk students count
- high-risk program index
- course difficulty index
- revenue contribution by faculty/program

---

## 9) Dashboard Blueprint (Enterprise BI)

### 9.1 Executive Overview Dashboard

KPIs:

- total students
- average GPA
- total tuition collected
- outstanding fees
- sponsorship totals
- attendance rate

### 9.2 Academic Performance Dashboard

- GPA by faculty/program
- pass/fail trend
- semester progression
- retake analytics

### 9.3 Course Difficulty Dashboard

- top hardest courses
- failure and retake heatmaps
- average score by course and semester

### 9.4 Student Finance Dashboard

- expected vs paid tuition
- payment trend and seasonality
- payment method/channel distribution
- outstanding balances by segment

### 9.5 Attendance Dashboard

- attendance trend
- absenteeism hotspots
- attendance vs performance relationship

### 9.6 Student Risk Dashboard

Rule-driven and model-assisted risk segmentation:

- low GPA + low attendance + low payment completion
- repeated FEX/FCW outcomes
- program-level risk concentration

---

## 10) Advanced Analytics and Predictive Opportunities

### 10.1 Predictive Use Cases

- dropout risk prediction
- course failure prediction
- payment default risk prediction
- attendance deterioration prediction

### 10.2 Feature Groups

- academic trend features (GPA trajectory, fail patterns)
- financial behavior features (payment timing, completeness)
- engagement features (attendance and lateness patterns)
- progression features (retake pressure and attempt counts)

### 10.3 Institutional Optimization

- curriculum bottleneck identification
- scholarship allocation effectiveness
- faculty/department workload and performance planning
- early intervention targeting

---

## 11) Data Quality and Validation Rules

### 11.1 Key Integrity

- `REG_NO` and `ACC_NO` uniqueness in student dimension
- FK consistency from all facts into student and course dimensions
- valid faculty->department->program hierarchy

### 11.2 Rule Validation

- FCW/FEX/MEX consistency with score thresholds and exam presence
- grade-to-points mapping conformance
- semester and academic year consistency

### 11.3 Temporal Consistency

- attendance dates align to valid semester windows where configured
- payment and sponsorship dates align to academic periods
- date dimension keys resolvable for all event facts

---

## 12) Governance and Privacy

- Dataset is synthetic/anonymized
- No direct real-student identifiers beyond project-safe generated keys
- Use role-based access in downstream apps for faculty/department scoped analytics
- Keep published extracts versioned and documented

---

## 13) Implementation Notes for ETL + Query Layer

1. Normalize all file inputs to canonical names before transform stage.
2. Build deterministic surrogate keys in warehouse if needed.
3. Enforce grading rules in transform step (not only at report layer).
4. Materialize high-frequency aggregates (GPA trend, payment status, attendance trend).
5. Expose warehouse views to NextGen Query for analyst-safe SQL exploration.

---

## 14) Source Name Harmonization (Preserved Aliases)

To preserve all source documentation references, these aliases are recognized as equivalent where applicable:

- `students_list15` / `students_list16`  
  -> `students_list15.xlsx`, `students_list16.xlsx`

- `student_payments_list15_realistic` / `student_payments_list16_realistic`  
  -> `student_payments_list15.csv`, `student_payments_list16.csv`

- `course_catalog_ucu_actual_titles`  
  -> `course_catalog_ucu.csv` / `course_catalog_ucu.xlsx`

- `student_grades_list15_updated_titles` / `student_grades_list16_updated_titles`  
  -> `student_grades_list15.csv`, `student_grades_list16.csv`

- `student_attendance`  
  -> `student_attendance_list15.csv`, `student_attendance_list16.csv`

- `student_transcript_list15/list16` and `fact_student_academic_performance_list15/list16`
  -> `student_transcript_list15.csv`, `student_transcript_list16.csv`,
     `fact_student_academic_performance_list15.csv`, `fact_student_academic_performance_list16.csv`

This preserves naming references from all merged docs without losing technical continuity.

---

## 15) Final Summary

The NextGen Analytics System documentation is now unified into a single technical narrative covering:

- complete dataset inventory and schema logic
- grading and transcript computation policy
- warehouse/star-schema modeling guidance
- BI KPI and dashboard architecture
- advanced analytics and predictive strategy
- implementation and governance guidance

This master document is suitable for:

- project handover
- technical defense/demo
- BI implementation planning
- ETL and analytics engineering reference

---

