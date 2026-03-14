## NextGen MIS / Analytics Platform Hardening — Master Plan

### Overall Objective

Upgrade the platform into a **production-grade institutional analytics system** (Power BI / Tableau / enterprise SaaS style) with:

- **Enterprise UI/UX**
- **Strict RBAC and scoped visibility**
- **PostgreSQL‑first data and performance**
- **Modular, domain‑driven architecture**
- **Full alignment with all master documentation in `Data_info/*` and recruitment docs**

---

### Phase 0 — Documentation & Domain Alignment ✅

- **0.1 Read and summarise all domain docs**:
  - `Data_info/data_architecture.md`, `data_description.md`, `overall.md`, `advanced_bi_analytics.md`
  - `analytics_recommendations.md`, `university_analytics_complete_documentation.md`, `data_shema.md`
  - `school_recruitment_analytics_complete.md`
  - `NextGen Analytics System – Master Technical Documentation`
  - `Data Description – University Analytics System`
- **0.2 Extract hard rules and semantics**:
  - Grading and progression: coursework 60% / exam 40%, FCW/FEX/MEX rules, GPA/CGPA, semester/academic year, intake logic.
  - Dim/fact model: `dim_student`, `dim_program`, `dim_department`, `dim_faculty`, `dim_course`, `dim_date`, etc., and `fact_grades`, `fact_payments`, `fact_sponsorships`, `fact_attendance`, `fact_transcript`, `fact_academic_performance`, `fact_progression`.
  - KPI catalogue and dashboard themes per role (academic, finance, attendance, risk, recruitment).
- **0.3 Gap list**: Document where the current implementation diverges from the master docs to drive later phases. *(Initial pass complete; refine per phase as implementation progresses.)*

---

### Phase 1 — Architecture & Modularisation

- **1.1 Define feature modules** (files/folders and imports):
  - `auth`, `rbac`, `users`, `admin`, `etl`, `audit`
  - `dashboard-core`, `dashboard-builder`, `chart-library`
  - `nextgen-query`, `analytics-academic`, `analytics-finance`, `analytics-attendance`, `analytics-recruitment`, `analytics-risk`
  - `shared-ui`, `shared-types`, `shared-utils`, `database`, `services`
- **1.2 Enforce separation of concerns**:
  - Presentation vs. containers vs. reusable UI vs. chart components.
  - Service/API layer vs. repository/PostgreSQL query layer.
  - ETL/settings/admin isolated from user‑facing analytics UIs.
- **1.3 Central configuration**:
  - Single source for env/config, RBAC role constants and route maps, KPI IDs, academic calendar/time logic.

---

### Phase 2 — PostgreSQL & ETL Hardening

- **2.1 Schema alignment**:
  - Ensure all documented dims/facts exist with correct keys/constraints and match the master docs.
  - Create analyst‑safe **views** that expose only allowed columns and join logic.
- **2.2 Performance & indexing**:
  - Add indexes on common join/filter keys (student_id, faculty_id, department_id, program_id, semester, academic_year, exam_status, FCW/MEX/FEX flags).
  - Introduce materialised views where needed for heavy dashboards and risk analytics.
- **2.3 ETL verification**:
  - Validate Bronze → Silver → Gold flows against data‑quality expectations (unique reg/access numbers, full faculty/department/program coverage).
  - Ensure FCW/MEX/FEX flags, grade points, GPA/CGPA and progression/retake markers are computed in ETL and stored in facts.

---

### Phase 3 — RBAC & Scope Enforcement Everywhere

- **3.1 Roles enforced exactly**:
  - Student, Staff, HOD, Dean, Senate, Analyst, HR, Finance, Sysadmin.
- **3.2 Enforcement layers**:
  - **Routes/pages**: Navigation and routing gated by role.
  - **APIs**: Every analytics, admin, dashboard, and NextGen Query endpoint checks role and scope.
  - **Queries**: SQL adds WHERE clauses for department/faculty/self scope as per role.
  - **Dashboards/charts/actions**: Buttons, filters, and visualisations hidden or disabled if role is not allowed.
- **3.3 Scope rules**:
  - Student → self only (profile, FCW/MEX/FEX, retakes, fees, attendance).
  - Staff → teaching / department scope only.
  - HOD → department‑wide analytics; no global admin.
  - Dean → faculty‑wide analytics; no global admin.
  - Senate → institution‑wide read‑only analytics.
  - Analyst → broad analytics across views, but no RBAC/admin powers.
  - HR/Finance → domain‑specific analytics only.
  - Sysadmin → full system/admin access.

---

### Phase 4 — Enterprise UI/UX & Design System

- **4.1 Design system**:
  - Unified typography, spacing scale, color tokens and chart palette.
  - Reusable components: page shell, metric card, analytic section header, filter bar, date/semester selector, faculty/department/program selectors, chart card, badges/chips, modals/drawers, tabs, alert banners, skeleton loaders, empty/unauthorised states.
- **4.2 Layouts & navigation**:
  - Consistent, responsive page shells for all roles.
  - Clear hierarchy: page title, sections (summary, trends, distributions, details, risk/alerts).
  - Sidebar, breadcrumbs, and header actions aligned across dashboards.
- **4.3 Tables and filters**:
  - Tables with sticky headers (where useful), sorting, search, pagination, filter chips, visible active filters and export‑ready patterns.

---

### Phase 5 — FCW/MEX/FEX Analytics, Risk & Retakes

- **5.1 FCW/MEX/FEX analytics**:
  - APIs and views for FCW, MEX, FEX counts and rates by:
    - Semester, academic year, faculty, department, program, course.
  - Derived metrics: retake rate, course difficulty, at‑risk student counts.
- **5.1.1 Semester focus rules**:
  - Treat the **current semester** and the **previous semester** as the primary analysis windows for all new student analytics.
  - Older semesters are considered **historical background** and are only pulled into long‑term trend views when explicitly needed.
  - Students with data in **only one semester** are treated as **new students** in analytics.
- **5.2 High‑school correlation**:
  - Extend high‑school analytics to show FCW/MEX/FEX incidence by:
    - High school, district, school tier, ownership.
  - Views for top high‑risk and low‑risk schools and districts.
- **5.3 Student‑level retake tracking**:
  - Student dashboard section showing:
    - Courses requiring retake, reason (FCW/MEX/FEX), attempt number, semester/year, status (pending/completed/outstanding).
  - Use existing grades, transcript, progression/performance facts—no new business rules.
- **5.4 Scoped retake & risk views**:
  - Staff/HOD/Dean/Senate/Analyst get scoped summaries of retakes and FCW/MEX/FEX trends within their allowed visibility.

---

### Global Analytics Rule — Enrollment Rate

- **E.1 Enrollment evaluation by year**:
  - When computing **enrollment rate by academic year**, restrict the population to students in **Year 1, Semester 1** for that year.
  - Use this rule consistently across dashboards and SQL/views that report “enrollment rate” or “new intake size”.

---

### Phase 6 — Role Dashboards (Rebuild with Storytelling)

Each dashboard follows: **top KPIs → trends → distributions/comparisons → details → risk/anomalies → optional narrative/insights**.

- **6.1 Student**: GPA/CGPA, pass/fail, attendance, fees/balance, retakes, progression.
- **6.2 Staff**: Class performance, attendance, at‑risk students for their courses.
- **6.3 HOD**: Department student counts, GPA distribution, course difficulty, FCW/MEX/FEX and retake concentrations, staffing summary where applicable.
- **6.4 Dean**: Faculty‑wide KPIs, department comparisons, enrollment and finance, risk distribution.
- **6.5 Senate**: Institution‑wide strategic KPIs, feeder‑school analytics, faculty comparisons, risk and outcomes.
- **6.6 Analyst**: Workspace view for custom dashboards, Saved Charts, shared charts, NextGen Query access.
- **6.7 Finance**: Tuition expected vs paid, outstanding balances, payment trends, revenue by faculty/program, sponsorship coverage.
- **6.8 HR**: Staff counts, distribution, staffing structure per department/faculty.
- **6.9 Sysadmin**: System health, user/role distribution, ETL status, audit logs, admin shortcuts.

---

### Phase 7 — Custom Dashboards & Chart Library

- **7.1 Chart asset model**:
  - Each chart has id, title, description, owner, source query/metric definition, chart type, allowed scopes, visibility (roles/users), tags, last updated timestamp.
- **7.2 Manage Charts refactor**:
  - **Saved Charts**: All created charts.
  - **Manage Charts | Shared**: Subset actively shared with roles/users.
  - Clear list, filter, edit, and unshare workflows.
- **7.3 Dashboard Manager**:
  - Separate **Current Dashboards by Role** from **Custom Dashboards**.
  - Swapping, assigning, previewing, and editing workflows for analysts/sysadmins.
- **7.4 Dashboard builder UX**:
  - Left: saved chart list; center: grid/canvas; right: properties + assignment.
  - Preview mode and validation before publishing/updating.
 - **7.5 NextGen Query visualizations in dashboards/pages**:
   - In Dashboard Manager’s **Edit content** modal (for current dashboards and page configs), add a section to attach **visualizations created in NextGen Query**.
   - Allow analysts to browse/select from their **assigned/saved visualizations** (via `/api/query/assigned-visualizations`) and pin them into role dashboards and any page with visuals.
   - Page/dash definitions should store lightweight **references** to these visualizations (id, title, chart type) so `RoleDashboardRenderer` can render them alongside built-in KPIs/charts.

---

### Phase 8 — NextGen Query Workspace (Read‑Only SQL Studio)

- **8.1 Safety & access**:
  - Analyst/sysadmin only.
  - Backend enforces **read‑only queries**: only `SELECT`/`WITH` allowed; destructive or DDL statements blocked.
  - Limits and timeouts applied; clear, user‑friendly error messages returned.
- **8.2 Layout**:
  - SQL editor, result grid, visualization preview, chart configuration, save/share controls, query history, validation/error panel.
- **8.3 Chart lifecycle**:
  - From query → chart → **Saved Chart asset** with metadata and visibility.
  - Saved Charts available to dashboard builder and Manage Charts.

---

### Phase 9 — Recruitment / Feeder‑School Analytics

- **9.1 Analytics capabilities**:
  - Top feeder schools; district recruitment distribution.
  - Academic performance by school; FCW/MEX/FEX by school.
  - Sponsorship distribution; program preferences; retention/persistence by school.
- **9.2 Dashboards/sections**:
  - Recruitment source analysis; district/geographic analysis; feeder‑school ranking and performance; school‑to‑finance/scholarship patterns; school‑based targeting insights.
- **9.3 RBAC**:
  - Expose to Senate, Dean, HOD, Analyst, Sysadmin with appropriate scope; not to general students/staff unless explicitly allowed.

---

### Phase 10 — Seed Users & Admin/Sysadmin Experience

- **10.1 User seeding**:
  - Seed all core roles (student, staff, HOD, Dean, Senate, Analyst, HR, Finance, Sysadmin).
  - For each department, seed 4–5 lecturer/staff accounts with correct faculty/department/scope.
  - Use default demo password `ChangeMe123` (overridable per environment).
- **10.2 Admin console**:
  - Professional sysadmin UI for:
    - User management, role assignment, faculty/department mapping, password resets.
    - ETL settings/visibility, audit logs, system settings.
    - Oversight of dashboard access where appropriate.
- **10.3 Security & auditability**:
  - All admin actions must be role‑protected, validated, and logged to audit tables where possible.

---

### Phase 11 — Testing, Performance & Final Standard

- **11.1 Functional and RBAC tests**:
  - Verify flows for all roles (dashboards, retakes, NextGen Query, admin actions) and confirm no scope leakage.
- **11.2 Performance**:
  - Key dashboards load in \< 1 second on realistic data volumes.
  - ETL runs complete successfully with counts and KPIs aligned to documentation.
- **11.3 Final acceptance**:
  - **Visual**: looks and feels like a modern enterprise BI/MIS, not a prototype.
  - **Analytical**: KPIs and logic match the merged docs (FCW/MEX/FEX, GPA/CGPA, recruitment, finance, attendance, risk).
  - **Security**: strict RBAC at all layers; no unintended access.
  - **Modularity**: architecture is maintainable, scalable, and clearly organised by domain and feature.
# NextGen MIS / Analytics Platform Hardening — master plan

## Platform Objective

Upgrade to a production-grade institutional analytics platform with enterprise UI/UX (Power BI/Tableau style), strict RBAC, PostgreSQL optimization, and modular architecture.

---

## 🏗️ Phase 1 — Enterprise Design System (UI Foundations)

**Objective**: Establish a premium visual language and reusable components.

- **1.1 Design Tokens**: Unified HSL system in `index.css` (Deep Navy, Indigo Accent).
- **1.2 Component Library**:
  - `MetricCard`: KPI tiles with trends.
  - `ChartCard`: Chart container with skeleton/error states.
  - `FilterBar`: Cascading Faculty → Dept dropdowns.
  - `DataTable`: Enterprise-grade sorting/pagination.
  - `StatusBadge`: Semantic status chips (FCW/FEX/MEX/Completed).
  - `PageShell`: Standardized page layout component.
- **1.3 Shell Upgrade**: Breadcrumbs, sidebar groups, and mobile responsiveness.
- **1.4 Chart Registry**: Global theme and color palette for ECharts/Recharts.

---

## 🧠 Phase 2 — Analytics Backend & Data Hardening

**Objective**: Implement analytical logic for fails, retakes, and backgrounds.

- **2.1 FCW/MEX/FEX Logic**: Integrated into ETL for `fact_grade`.
- **2.2 High School Integration**: Synthetic HS data mapped to students.
- **2.3 Risk Endpoints**:
  - `GET /api/analytics/academic-risk`
  - `GET /api/analytics/high-school-risk-correlation`
  - `GET /api/analytics/my-retakes`
- **2.4 Seed System**: Comprehensive user seeding across all roles (`seed_users.py`).

---

## 📊 Phase 3 & 4 — Dashboard Rebuilds & Risk Visualization

**Objective**: Build role-specific dashboards with documented KPIs.

- **3.1 Senate Dashboard**: Strategic institution-wide visibility.
- **3.2 Dean Dashboard**: Faculty-level BI.
- **3.3 HOD Dashboard**: Departmental performance & course risk.
- **3.4 Student Dashboard**: Personal grades & retake tracker.
- **3.5 Staff Dashboard**: Teaching load & class risk.
- **3.6 Finance/HR Dashboards**: Payment collection & staffing trends.
- **4.1 Risk Correlation**: Visualizing HS background vs. academic failure.

---

## � Phase 5 & 6 — NextGen Query & Custom Dashboards

**Objective**: Provide self-service analytics and dashboard authoring.

- **5.1 Query Workspace**: Monaco-based SQL editor with chart preview.
- **5.2 Chart Library**: "Saved Charts" and "Charts I Shared" system.
- **6.1 Board Builder**: Drag-and-drop / Grid assignment of chart assets.
- **6.2 Dashboard CRUD**: Persistent layouts for custom roles.

---

## ⚡ Phase 7 — PostgreSQL & ETL Optimization

**Objective**: Production-grade data warehousing performance.

- **7.1 Analytical Views**: Academic summary, risk summary, and HS correlation views.
- **7.2 Indexing Audit**: High-query-volume columns on fact tables.
- **7.3 ETL Verification**: Validating Medalion layers (Bronze → Silver → Gold).

---

## 🏁 Success Criteria

- **Visual Impact**: Platform feels professional, clean, and TRUSTWORTHY.
- **Data Accuracy**: Counts match UCU documentation (FCW/MEX/FEX rules).
- **RBAC Security**: No data leakage between faculty/dept scopes.
- **Performance**: Dashboard charts load in < 1 second.

