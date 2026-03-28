## NextGen UCU Analytics – Business Model

### 1. Overview

NextGen UCU Analytics is a data warehouse and analytics platform tailored for Ugandan universities (starting with Uganda Christian University). It unifies academic, finance, and HR data into a single system that powers dashboards for Deans, HODs, Senate, HR, Finance, and Students, plus prediction models for performance and tuition risk.

This document summarises the business model in a way that can be shared as a PDF with stakeholders (VC, DVC, Deans, ICT, Finance, HR).

---

### 2. Customer Segments

- **Public & private universities in Uganda**
  - e.g. UCU, Makerere, Kyambogo, Mbarara, Ndejje, Uganda Martyrs, Kampala International.
  - Pain points: siloed systems (Academic Registrar, Finance, HR, Library), manual Excel reporting for NCHE/DIRECTORATE, late visibility into performance and fee collections.

- **Faculties, Schools & Departments**
  - Deans and HODs who need faculty/department dashboards (students, lecturers, tuition, retention, FEX/MEX, high‑school pipelines, HR analytics).

- **Central university governance (Senate, Council, NCHE liaison)**
  - Senate members who want institution‑wide dashboards for performance, completion, programme viability, and fee trends to support policy and accreditation.

- **Operational directorates**
  - **Finance**: fee collection trends, ageing, programme profitability, high‑risk students.
  - **HR**: staff workload, lecturer performance indicators, attendance, payroll analytics, part‑time vs full‑time ratios.
  - **ICT / MIS**: wants a standardised data platform rather than ad‑hoc scripts and reports.

- **Students (end‑users)**
  - Self‑service academic dashboards (grades, tuition, attendance, predictions), but they are **not payers**; they are part of the value proposition to the institution.

---

### 3. Value Proposition

#### For Universities (VC, DVC, Council)
- **Single source of truth** for academics, finance, and HR, built on a proper warehouse (star schema, ETL pipeline).
- **Regulatory reporting readiness** for NCHE and other bodies with consistent, auditable metrics.
- **Better resource allocation**: see which programmes, faculties, and campuses are under‑ or over‑performing in real time.

#### For Faculties & Departments (Deans, HODs)
- **Role‑based dashboards**:
  - Deans see only their faculty (students, lecturers, tuition, performance, retention, fee status).
  - HODs see only their department.
- **Granular student analytics**:
  - Performance by programme, course unit, gender, high‑school, resident vs non‑resident.
  - Early warning from FEX/MEX trends and predictive models.
- **Lecturer analytics**:
  - Performance indicators per lecturer / assistant lecturer, broken down by department, programme, gender, and now **full‑time vs part‑time**.

#### For HR
- **Complete staff directory** from HR + app users, with:
  - Senate members, Deans, HODs, Lecturers, Assistant Lecturers, Finance staff, HR staff, other employees.
  - Filters by faculty, department, and role group.
- **Attendance & payroll analytics**:
  - Attendance trends by rank (Senate, Deans, HODs, Lecturers, Assistant Lecturers, Finance, HR, Other).
  - Payroll totals and averages per rank, faculty, department.
- **Lecturer employment type**:
  - Breakdown of lecturers as **Full‑time vs Part‑time vs Other**, filtered by faculty and department.

#### For Finance
- **End‑to‑end tuition analytics**:
  - Payment distributions and trends by programme, faculty, gender, high‑school, and year.
  - Identification of high‑risk cohorts (e.g. certain programmes, high‑schools, or years with chronic arrears).

#### For Students
- **Personalised academic cockpit**:
  - Only their own grades, trends over time, attendance, tuition status, and predictions.
  - Clear, friendly error messages and explanations (no raw backend errors).

---

### 4. Revenue Model

- **Institution‑level annual subscription (SaaS licence)**
  - Tiered by size (number of students / faculties):
    - Tier 1: small private universities & colleges.
    - Tier 2: mid‑size universities.
    - Tier 3: large public universities.
  - Includes:
    - Access to the platform (dashboards + APIs).
    - Security, RBAC, and updates.

- **Implementation & onboarding fees**
  - One‑time fee per institution for:
    - Data mapping from existing SIS, finance, HR systems.
    - ETL setup and validation for UCU_SourceDB1/2 equivalents.
    - Dashboards customisation (branding, additional KPIs).

- **Training & capacity building**
  - Paid training packages for:
    - Deans, HODs, Senate, Finance, HR.
    - ICT / MIS teams on ETL, data governance, and advanced analytics.

- **Premium analytics & prediction add‑ons**
  - Advanced machine learning models (drop‑out prediction, fee default risk, scenario planning) sold as extra modules.
  - Custom reports for NCHE submissions, Council packs, or donor projects.

- **Support & managed hosting**
  - Optional managed cloud hosting (e.g. on local data centre or cloud region compliant with Ugandan data rules).
  - SLA tiers (standard, premium 24/7) priced separately.

---

### 5. Cost Structure (“Constructor”)

- **Core development & maintenance**
  - Software engineers (backend Flask, React frontend, ETL, data engineering).
  - Data scientists / ML engineers maintaining the prediction models.

- **Infrastructure**
  - Databases (MySQL warehouse, RBAC DB).
  - Application servers and storage (cloud or on‑prem).
  - Monitoring, backups, security tooling (firewalls, VPNs, SSL, IAM).

- **Implementation & support**
  - Field engineers / implementation consultants for on‑site visits at Ugandan campuses.
  - Support team handling tickets, upgrades, bug‑fixes.

- **Sales, training, and partnerships**
  - Account managers and pre‑sales engineers.
  - Training materials, workshops, certification programmes.
  - Partnerships with:
    - Local ISPs / hosting providers.
    - Payment providers (MTN Mobile Money, Airtel Money, banks) where fee data integration is needed.
    - National IT bodies (e.g. NITA‑U) for data governance alignment.

---

### 6. Channels & Customer Relationships

- **Direct sales to universities**
  - ICT/MIS directorates, Academic Registrar, Finance, and VC’s office.
  - Pilots/POCs at one faculty (e.g. Business & Administration) before rollout.

- **Partner‑led deployments**
  - Collaboration with local software vendors and system integrators that already serve universities (SIS, ERP, LMS).

- **Ongoing relationships**
  - Quarterly business reviews with data packs (key trends, risks, opportunities).
  - Joint innovation projects (new models, new KPIs) with early‑adopter universities.

---

### 7. How to Use This Document as a PDF

- To produce a PDF for presentations or approvals:
  1. Open this file (`BUSINESS_MODEL.md`) in a markdown viewer (e.g. VS Code, a markdown preview plugin, or GitHub).
  2. Use “Print to PDF” or an export‑to‑PDF option from your editor or browser.
  3. Share the resulting PDF with university leadership, project supervisors, or potential partner institutions.

