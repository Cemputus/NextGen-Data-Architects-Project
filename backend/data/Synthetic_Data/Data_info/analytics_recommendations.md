# Advanced BI Analytics for University Analytics System

## Overview

This document outlines advanced Business Intelligence (BI) analytics that can be built using the university datasets.

The system integrates academic, financial, and behavioral student data to support institutional decision-making.

---

# Data Sources Used

The analytics platform integrates the following datasets:

| Dataset | Description |
|---|---|
| students |  student data |
| faculties_departments | Academic hierarchy |
| course_catalog | Courses per program |
| grades | Course assessment results |
| payments | Tuition payment transactions |
| sponsorships | Scholarship funding |
| attendance | Student attendance logs |
| academic_progression | Retake history |
| gpa_cgpa | Academic performance summary |

---

# Data Relationships
Faculty
↓
Department
↓
Program
↓
Students
↓
| Payments
| Sponsorships
| Grades
| Attendance
| Progression



---

# 1 Academic Performance Analytics

### Student Success Rate

Measure pass vs fail rates across programs.

Metrics:

- Pass Rate
- Fail Rate
- FCW Rate
- FEX Rate
- MEX Rate

Breakdown:

- By Program
- By Department
- By Faculty

---

### Course Difficulty Index

Identify courses with highest failure rates.

Metrics:

- % students failing
- average grade
- retake frequency

Dashboard:
Course Difficulty Ranking


---

### GPA Distribution

Analyze grade distribution.

Metrics:

- Average GPA
- GPA by faculty
- GPA by program
- GPA trend by semester

Visualization:

GPA Distribution Histogram


---

# 2 Student Risk Prediction

Early warning indicators.

Variables:

- attendance rate
- coursework score
- payment status
- previous GPA

Identify:


At Risk Students


Example rule:

  Attendance < 70%
AND
GPA < 2.5
→ High Risk


---

# 3 Attendance Analytics

Measure student engagement.

Metrics:

- Attendance rate
- Late arrivals
- Absenteeism

Insights:
Attendance vs GPA correlation


Questions answered:

- Do high attendance students perform better?
- Which programs have low attendance?

---

# 4 Financial Analytics

### Tuition Payment Tracking

Metrics:

- Total tuition collected
- Outstanding balances
- Payment completion rate

Breakdown:

- by faculty
- by program
- by semester

---

### Payment Behavior Analysis

Identify payment patterns.

Metrics:

- installment frequency
- payment method usage

Examples:
Mobile Money vs Bank Payments


---

### Sponsorship Analytics

Analyze scholarship coverage.

Metrics:

- % students sponsored
- total sponsorship funding
- sponsor contribution by faculty

Example question:
Which programs receive the most sponsorship?


---

# 5 Academic Progression Analytics

Track course retakes.

Metrics:

- retake rate
- repeated courses
- progression delays

Insights:
Courses with highest retake rates


---

# 6 Department and Faculty Performance

Using `faculties_departments.csv`.

Metrics:

- average GPA per faculty
- graduation readiness
- student success rate

Example dashboard:
Faculty Academic Performance Scorecard


---

# 7 Institutional Strategic Insights

Combine academic and financial data.

Examples:

### Program Profitability
Tuition Revenue - Program Costs


### High Risk Programs

Programs with:

- high failure rates
- low attendance
- low payment completion

---

# 8 Predictive Analytics Opportunities

Machine learning models can predict:

### Student Dropout Risk

Features:

- GPA trend
- attendance
- payment history

### Course Failure Prediction

Features:

- coursework marks
- attendance
- past performance

---

# 9 Recommended BI Dashboards

### Executive Dashboard

KPIs:

- Total students
- Total revenue
- Average GPA
- Sponsorship funding
- Attendance rate

---

### Academic Performance Dashboard

Charts:

- GPA by faculty
- Course failure heatmap
- Retake analysis

---

### Finance Dashboard

Charts:

- Tuition revenue trends
- Outstanding balances
- Payment channel distribution

---

### Student Engagement Dashboard

Charts:

- Attendance trends
- Attendance vs GPA
- Absenteeism heatmap

---

# Conclusion

This analytics platform enables:

- Data-driven academic management
- Financial monitoring
- Early student risk detection
- Institutional performance tracking

The integration of academic, financial, and behavioral datasets provides a **comprehensive university analytics system**.  

