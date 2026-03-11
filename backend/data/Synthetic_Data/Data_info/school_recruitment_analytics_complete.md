
# School Recruitment & Analytics Documentation
## University Analytics System

This document merges all school-related analytics documentation into one comprehensive guide.

Included sections:
1. High School Analytics Overview
2. Recruitment Insights
3. Marketing & Recruitment Dashboard

---
# 1. High School Analytics
## University Recruitment Intelligence

This dataset links each student to their **previous high school and district**.

It enables analysis such as:

- feeder schools
- recruitment regions
- academic preparedness
- retention patterns
- graduation outcomes
- financial behavior by recruitment pipeline

This type of analysis is widely used in universities for:

- recruitment strategy
- marketing targeting
- school partnership programs
- regional expansion planning

---
## Dataset Structure

### High School Dimension

Dataset:
`high_schools_dimension`

Columns:

| Column | Description |
|------|------|
| SCHOOL_NAME | Name of the high school |
| DISTRICT | District where the school is located |
| SCHOOL_TIER | Classification of school prestige |
| OWNERSHIP | School ownership type |

Purpose:
Acts as a **dimension table** for school analytics.

---
### Student High School Dataset

Datasets:

- `student_high_schools_list15`
- `student_high_schools_list16`
- `student_high_schools_all`

Columns:

| Column | Description |
|------|------|
| REG_NO | Student registration number |
| ACC_NO | Student account number |
| PROGRAM | Degree program |
| HIGH_SCHOOL | Student's previous school |
| DISTRICT | School district |
| SCHOOL_TIER | School ranking |
| OWNERSHIP | School ownership |
| STUDENT_LIST | Source dataset |

Granularity:

1 row = 1 student

---
# Data Warehouse Integration

Primary join field:

`REG_NO`

Joinable datasets:

- students
- student_grades
- student_transcript
- fact_student_academic_performance
- student_attendance
- student_payments
- student_sponsorships

---
# 2. School Recruitment Insights

## Insight 1: Top Feeder Schools

Purpose:
Identify schools that send the most students.

SQL Example:

SELECT HIGH_SCHOOL, COUNT(*) AS students
FROM student_high_schools_all
GROUP BY HIGH_SCHOOL
ORDER BY students DESC;

Strategic value:
Focus recruitment visits on these schools.

---
## Insight 2: Recruitment by District

Purpose:
Understand geographic recruitment patterns.

SELECT DISTRICT, COUNT(*)
FROM student_high_schools_all
GROUP BY DISTRICT;

Strategic value:
Target districts with high potential.

---
## Insight 3: Academic Performance by School

SELECT s.HIGH_SCHOOL, AVG(t.SEMESTER_GPA)
FROM student_high_schools_all s
JOIN student_transcript t
ON s.REG_NO = t.REG_NO
GROUP BY s.HIGH_SCHOOL;

Insight:
Some schools produce stronger academic performers.

---
## Insight 4: Failure Rate by School

SELECT s.HIGH_SCHOOL,
AVG(CASE WHEN g.STATUS='FEX' THEN 1 ELSE 0 END)
FROM student_high_schools_all s
JOIN student_grades g
ON s.REG_NO = g.REG_NO
GROUP BY s.HIGH_SCHOOL;

Insight:
Identify schools whose graduates struggle academically.

---
## Insight 5: Attendance Behavior

SELECT s.HIGH_SCHOOL,
AVG(CASE WHEN a.STATUS='PRESENT' THEN 1 ELSE 0 END)
FROM student_high_schools_all s
JOIN student_attendance a
ON s.REG_NO = a.REG_NO
GROUP BY s.HIGH_SCHOOL;

Insight:
Measure engagement levels.

---
## Insight 6: Scholarship Distribution

SELECT s.HIGH_SCHOOL,
COUNT(sp.SPONSOR_PAYMENT_ID)
FROM student_high_schools_all s
JOIN student_sponsorships sp
ON s.REG_NO = sp.REG_NO
GROUP BY s.HIGH_SCHOOL;

Insight:
Some schools produce more scholarship recipients.

---
# 3. Marketing & Recruitment Dashboard

## Purpose

Provide admissions teams with data-driven recruitment intelligence.

The dashboard integrates:

- students
- high school data
- transcripts
- payments
- attendance
- sponsorships

---
## Key Recruitment KPIs

| KPI | Description |
|-----|-------------|
| Total Students | Total enrolled |
| Schools Represented | Number of feeder schools |
| District Coverage | Geographic reach |
| Average GPA | Academic performance |
| Attendance Rate | Engagement |
| Scholarship Students | Sponsored students |

---
## Dashboard Sections

### Recruitment Source Analysis

Top feeder schools.

SELECT HIGH_SCHOOL, COUNT(REG_NO)
FROM student_high_schools_all
GROUP BY HIGH_SCHOOL
ORDER BY COUNT(REG_NO) DESC;

---
### Geographic Recruitment Map

Students by district.

SELECT DISTRICT, COUNT(*)
FROM student_high_schools_all
GROUP BY DISTRICT;

---
### Academic Performance by School

SELECT s.HIGH_SCHOOL, AVG(t.SEMESTER_GPA)
FROM student_high_schools_all s
JOIN student_transcript t
ON s.REG_NO = t.REG_NO
GROUP BY s.HIGH_SCHOOL;

---
### Program Preference by School

SELECT HIGH_SCHOOL, PROGRAM, COUNT(*)
FROM student_high_schools_all
GROUP BY HIGH_SCHOOL, PROGRAM;

---
### Financial Stability by School

SELECT s.HIGH_SCHOOL, AVG(p.AMOUNT_UGX)
FROM student_high_schools_all s
JOIN student_payments p
ON s.REG_NO = p.REG_NO
GROUP BY s.HIGH_SCHOOL;

---
### Retention Analysis

SELECT s.HIGH_SCHOOL,
AVG(CASE WHEN t.CGPA >= 2 THEN 1 ELSE 0 END)
FROM student_high_schools_all s
JOIN student_transcript t
ON s.REG_NO = t.REG_NO
GROUP BY s.HIGH_SCHOOL;

---
# Advanced Analytics Opportunities

Recruitment Efficiency Score

Combine:

- GPA
- attendance
- retention

to rank feeder schools.

---
# Strategic Value

High school analytics allows the university to:

- optimize recruitment strategy
- identify top feeder schools
- improve marketing targeting
- strengthen school partnerships
- improve student success outcomes

---
# Conclusion

The integration of high school recruitment data with academic and financial data creates a **complete recruitment intelligence system**.

This mirrors how modern universities use analytics to guide:

- admissions strategy
- marketing campaigns
- academic planning
- institutional growth
