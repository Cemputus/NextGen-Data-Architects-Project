# UCU Analytics Anonymized Dataset

## data_description.md

## Overview

This dataset collection was created to simulate a **realistic university academic and financial data environment** for analytics, BI dashboards, and data warehouse experimentation.

The data is **fully anonymized** and modeled after operational policies used at **Uganda Christian University (UCU)**.

The datasets support analytics across:

* Student administration
* Finance and payments
* Academic performance
* Attendance monitoring
* Sponsorship and scholarships
* Course progression
* Retake tracking

The datasets are structured to resemble **an institutional ERP / Student Information System (SIS)**.

---

# Dataset Architecture

The system currently contains **8 linked datasets**:

1. Students
2. Payments
3. Sponsorships
4. Grades
5. Course Catalog
6. GPA / CGPA summaries
7. Academic Progression / Retake History
8. Attendance Records

These datasets are designed to support **data warehouse modelling and BI analytics**.

---

# 1. Students Dataset

Represents the **master student record**.

### Key Fields

| Column              | Description                          |
| ------------------- | ------------------------------------ |
| ACC_NO              | Student access number                |
| REG_NO              | Registration number                  |
| NAME                | Anonymized student name              |
| PROGRAM             | Academic program                     |
| YEAR                | Academic year                        |
| SEMESTER            | Current semester                     |
| TOTAL_REGISTRATIONS | Total number of semesters registered |
| RESIDENCE           | Resident / Non-resident              |
| ACCOMMODATION_TYPE  | Hall type                            |
| FEES                | Percentage of fees paid              |
| EXPECTED_FEES_RAW   | Fee percentage                       |
| EXPECTED_FEES_RANGE | Fee bracket                          |

### REG_NO Format

Example:

```
M23B38/005
```

Meaning:

| Part | Meaning                  |
| ---- | ------------------------ |
| M    | May intake               |
| 23   | Year of admission        |
| B    | Program level (Bachelor) |
| 38   | Program code             |
| 005  | Student number           |

If REG_NO begins with **K**, the student belongs to **Kampala Campus**.

---

# 2. Payments Dataset

Contains **tuition payment transactions** made by students.

Students may make **multiple payments per semester**.

### Fields

| Column                | Description                       |
| --------------------- | --------------------------------- |
| PAYMENT_ID            | Unique transaction ID             |
| REG_NO                | Student registration number       |
| ACC_NO                | Student access number             |
| ACADEMIC_YEAR         | Academic year                     |
| SEMESTER              | Semester                          |
| PAYMENT_DATE          | Date of transaction               |
| AMOUNT_UGX            | Amount paid                       |
| PAYMENT_METHOD        | Bank / Mobile Money / Card / Cash |
| BANK_NAME             | Bank used                         |
| MOBILE_PROVIDER       | Mobile money provider             |
| CHANNEL               | Payment channel                   |
| PAYMENT_SOURCE        | Parent / Sponsor / Student        |
| TRANSACTION_REFERENCE | Payment reference                 |
| PAYMENT_STATUS        | SUCCESS / FAILED                  |

### Payment Rules

* Students may pay in **installments**
* 1–5 payments per semester
* **1–2% of students fail to complete payments**

---

# 3. Sponsorship Dataset

Tracks **scholarship and sponsor payments**.

### Fields

| Column               | Description                 |
| -------------------- | --------------------------- |
| SPONSOR_PAYMENT_ID   | Sponsor transaction ID      |
| REG_NO               | Student registration number |
| SPONSOR_NAME         | Sponsoring organization     |
| SCHOLARSHIP_TYPE     | Type of scholarship         |
| SEMESTER_INDEX       | Semester funded             |
| AMOUNT_SPONSORED_UGX | Amount sponsored            |
| DISBURSEMENT_DATE    | Date funds released         |
| STATUS               | APPROVED / PENDING          |

### Sponsorship Rules

* Only **15–25% of students receive sponsorship**
* Sponsors may cover **20–100% of tuition**

---

# 4. Grades Dataset

Stores **course-level academic results**.

Each semester contains **6–7 courses per program**.

### Fields

| Column         | Description                 |
| -------------- | --------------------------- |
| REG_NO         | Student registration number |
| COURSE_CODE    | Course identifier           |
| COURSE_TITLE   | Course name                 |
| COURSE_UNITS   | Credit units                |
| CW_MARK_60     | Coursework mark             |
| EXAM_MARK_40   | Exam mark                   |
| FINAL_MARK_100 | Total mark                  |
| STATUS         | Completed / FCW / FEX / MEX |
| LETTER_GRADE   | Final letter grade          |
| GRADE_POINTS   | GPA points                  |

---

# Grading Policy

Coursework weight:

```
60%
```

Exam weight:

```
40%
```

### Coursework Rule

If:

```
CW < 17 / 60
```

Student receives:

```
FCW (Failed Coursework)
```

Student **does not qualify for the exam**.

---

### Exam Rule

If:

```
Exam < 17 / 40
```

Student receives:

```
FEX (Failed Exam)
```

---

### Missed Exam

If student does not sit the exam:

```
MEX (Missed Exam)
```

Possible reasons:

* Financial hold
* Medical
* No-show
* Timetable clash
* Disciplinary issue

---

### Pass Rule

Final mark is computed as:

```
Final Mark = Coursework + Exam
```

If:

```
Final Mark < 50
```

Result:

```
FAIL
```

---

# Grade Bands

| Grade | Score  | GPA |
| ----- | ------ | --- |
| A     | 80–100 | 5.0 |
| B+    | 75–79  | 4.5 |
| B     | 70–74  | 4.0 |
| C+    | 65–69  | 3.5 |
| C     | 60–64  | 3.0 |
| D+    | 55–59  | 2.5 |
| D     | 50–54  | 2.0 |
| F     | 0–49   | 1.5 |

---

# GPA Calculation

Semester GPA:

```
Σ (Course Units × Grade Points)
--------------------------------
Σ Course Units
```

---

# CGPA Calculation

CGPA is calculated as the **average of all semester GPAs**.

```
CGPA = Average(Semester GPA)
```

Maximum CGPA:

```
5.0
```

---

# 5. Course Catalog Dataset

Defines **courses per program per semester**.

Each semester includes:

```
6–7 courses
```

### Fields

| Column         | Description      |
| -------------- | ---------------- |
| PROGRAM        | Academic program |
| SEMESTER_INDEX | Semester         |
| COURSE_CODE    | Course code      |
| COURSE_TITLE   | Course name      |
| COURSE_UNITS   | Credit units     |
| COURSE_TYPE    | Core / Elective  |

---

# 6. GPA / CGPA Dataset

Contains computed academic performance metrics.

### Fields

| Column          | Description                   |
| --------------- | ----------------------------- |
| REG_NO          | Student registration number   |
| SEMESTER_GPA    | GPA per semester              |
| CGPA            | Overall GPA                   |
| SEMESTERS_COUNT | Number of semesters completed |

---

# 7. Academic Progression Dataset

Tracks **course attempts and retakes**.

### Fields

| Column             | Description                 |
| ------------------ | --------------------------- |
| PROGRESSION_ID     | Unique record               |
| REG_NO             | Student registration        |
| COURSE_CODE        | Course                      |
| SEMESTER_INDEX     | Semester                    |
| STATUS             | Completed / FEX / FCW / MEX |
| ATTEMPT_NUMBER     | Course attempt              |
| RETAKE_FLAG        | True if retake required     |
| PROGRESSION_STATUS | NORMAL / RETAKE_REQUIRED    |

---

# 8. Attendance Dataset

Tracks **daily class attendance**.

### Attendance Period

Example semester:

```
10 January 2026 – 15 March 2026
```

Rules:

* **Monday–Friday only**
* **No Saturday or Sunday attendance**

### Fields

| Column         | Description             |
| -------------- | ----------------------- |
| REG_NO         | Student registration    |
| ACC_NO         | Student access number   |
| DATE           | Attendance date         |
| SEMESTER_INDEX | Semester                |
| STATUS         | PRESENT / LATE / ABSENT |

---

# Intended Use

This dataset is designed for:

* Business Intelligence dashboards
* Data warehouse modelling
* SQL analytics
* Power BI dashboards
* Academic performance analytics
* Student risk prediction
* Financial analysis

---

# Privacy

All records are **synthetic and anonymized**.

No real student data is included.

---

# Author

Dataset generated for:

**University Analytics System Project**

Final Year Project – Data Engineering / Analytics.

---
