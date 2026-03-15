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

- **0.1 Read and summarise all domain docs** ✅:
  - `Data_info/data_architecture.md`, `data_description.md`, `overall.md`, `advanced_bi_analytics.md`
  - `analytics_recommendations.md`, `university_analytics_complete_documentation.md`, `data_shema.md`
  - `school_recruitment_analytics_complete.md`
  - `NextGen Analytics System – Master Technical Documentation`
  - `Data Description – University Analytics System`
- **0.2 Extract hard rules and semantics** ✅:
  - Grading and progression: coursework 60% / exam 40%, FCW/FEX/MEX rules, GPA/CGPA, semester/academic year, intake logic.
  - Dim/fact model: `dim_student`, `dim_program`, `dim_department`, `dim_faculty`, `dim_course`, `dim_date`, etc., and `fact_grades`, `fact_payments`, `fact_sponsorships`, `fact_attendance`, `fact_transcript`, `fact_academic_performance`, `fact_progression`.
  - KPI catalogue and dashboard themes per role (academic, finance, attendance, risk, recruitment).
- **0.3 Gap list** ✅: Document where the current implementation diverges from the master docs to drive later phases. *(Initial pass complete; refine per phase as implementation progresses.)*

---

### Phase 1 — Architecture & Modularisation ✅

- **1.1 Define feature modules** ✅ (files/folders and imports):
  - `auth`, `rbac`, `users`, `admin`, `etl`, `audit`
  - `dashboard-core`, `dashboard-builder`, `chart-library`
  - `nextgen-query`, `analytics-academic`, `analytics-finance`, `analytics-attendance`, `analytics-recruitment`, `analytics-risk`
  - `shared-ui`, `shared-types`, `shared-utils`, `database`, `services`
  - *Implemented:* Module map and locations documented in `docs/ARCHITECTURE.md`; frontend `config/` and `services/api.js`; backend `config/` (constants, academic).
- **1.2 Enforce separation of concerns** ✅:
  - Presentation vs. containers vs. reusable UI vs. chart components.
  - Service/API layer vs. repository/PostgreSQL query layer.
  - ETL/settings/admin isolated from user‑facing analytics UIs.
  - *Implemented:* Boundaries documented in `docs/ARCHITECTURE.md`; frontend API service layer in `services/api.js` (auth, dashboards, user-mgmt).
- **1.3 Central configuration** ✅:
  - Single source for env/config, RBAC role constants and route maps, KPI IDs, academic calendar/time logic.
  - *Implemented:* Backend `config/constants.py` (RBAC_ROLES, KPI_IDS, CHART_IDS, PAGE_CONFIG_*), `config/academic.py` (ACADEMIC_YEARS, SEMESTERS, SEMESTER_START_RULES); frontend `config/roles.js`, `config/routes.js`, `config/kpis.js`, `config/index.js`. `utils/rbac.js` and `AnalystDashboardsPage` / `RoleDashboardRenderer` use config.

---

### Phase 2 — PostgreSQL & ETL Hardening ✅

- **2.1 Schema alignment** ✅:
  - Ensure all documented dims/facts exist with correct keys/constraints and match the master docs.
  - Create analyst‑safe **views** that expose only allowed columns and join logic.
  - *Implemented:* Added **grade_points** to fact_grade (DDL in `sql/create_data_warehouse.sql` and ETL); ETL computes grade_points from letter_grade in Silver (UCU bands: A=5.0, B+=4.5, … F/MEX/FCW/FEX=0/1.5). **Analyst views:** `sql/analyst_views.sql` — view_analyst_grade (grades + student/program/department/faculty/semester), view_fcw_mex_fex_summary, view_fcw_mex_fex_by_faculty; ETL runs this SQL after Gold load.
- **2.2 Performance & indexing** ✅:
  - Add indexes on common join/filter keys (student_id, faculty_id, department_id, program_id, semester, academic_year, exam_status, FCW/MEX/FEX flags).
  - Introduce materialised views where needed for heavy dashboards and risk analytics.
  - *Implemented:* Indexes on fact_grade: **exam_status**, **(student_id, semester_id)**; same in create_data_warehouse.sql. Materialised views left for later if needed (views are lightweight).
- **2.3 ETL verification** ✅:
  - Validate Bronze → Silver → Gold flows against data‑quality expectations (unique reg/access numbers, full faculty/department/program coverage).
  - Ensure FCW/MEX/FEX flags, grade points, GPA/CGPA and progression/retake markers are computed in ETL and stored in facts.
  - *Implemented:* FCW/MEX/FEX computed in Silver and stored in fact_grade (fcw, exam_status); grade_points computed in Silver and loaded into fact_grade. **Verification script:** `scripts/verify_etl_phase2.py` — checks Gold row counts, unique reg_no/access_number, exam_status distribution, grade_points populated, faculty/department/program coverage, and analyst views exist. Run: `python scripts/verify_etl_phase2.py` from backend/.

**Phase 2 completion checklist (code complete; DB aligned after one ETL run):**
- [x] 2.1 fact_grade.grade_points in DDL + ETL Silver/Gold; analyst_views.sql (view_analyst_grade, view_fcw_mex_fex_summary, view_fcw_mex_fex_by_faculty); ETL runs views after load.
- [x] 2.2 Indexes on fact_grade (exam_status, student_id+semester_id) in create_data_warehouse.sql and etl_pipeline.py.
- [x] 2.3 FCW/MEX/FEX in Silver → fact_grade; grade_points in Silver → fact_grade; verify_etl_phase2.py. *To get all checks green:* run full ETL once (adds grade_points column and creates views) or apply ALTER + sql/analyst_views.sql manually.

---

### Phase 3 — RBAC & Scope Enforcement Everywhere ✅

- **3.1 Roles enforced exactly** ✅:
  - Student, Staff, HOD, Dean, Senate, Analyst, HR, Finance, Sysadmin.
  - *Implemented:* Canonical list in `backend/rbac.py` (Role enum), `backend/config/constants.py` (RBAC_ROLES), `frontend/src/config/roles.js`. Documented in `docs/PHASE3_SCOPE_RULES.md`. Admin is UI alias for sysadmin.
- **3.2 Enforcement layers** ✅:
  - **Routes/pages**: Navigation and routing gated by role.
  - *Implemented:* All paths under `frontend/src/App.js` use `PrivateRoute` with `requiredRole` or `allowedRoles`; redirect to default route when unauthorised. `RoleRoute` compares roles in lower case.
  - **APIs**: Every analytics, admin, dashboard, and NextGen Query endpoint checks role and scope.
  - *Implemented:* Analytics: `get_user_scope(claims)` + `has_permission(role, resource, READ)` on FEX, high-school, academic-risk, retakes, staff/classes; HR/Finance get 403 on FEX and high-school (domain-specific only). Dashboards: `@jwt_required()` + `_dashboard_role_scope()` in `app.py`. NextGen Query: `_require_analyst_or_sysadmin`. User management: `_require_sysadmin()` (analyst cannot access).
  - **Queries**: SQL adds WHERE clauses for department/faculty/self scope as per role.
  - *Implemented:* `backend/api/analytics.py` `build_filter_query` and scope logic; `app.py` `_dashboard_role_scope()` (student = self, staff = assigned courses, HOD = department_id, Dean = faculty_id, Senate/Analyst/Sysadmin = no scope).
  - **Dashboards/charts/actions**: Buttons, filters, and visualisations hidden or disabled if role is not allowed.
  - *Implemented:* Dashboard Manager uses `canManage` (analyst/sysadmin); role-specific pages only reachable via role routes.
- **3.3 Scope rules** ✅:
  - Student → self only (profile, FCW/MEX/FEX, retakes, fees, attendance).
  - Staff → teaching / department scope only.
  - HOD → department‑wide analytics; no global admin.
  - Dean → faculty‑wide analytics; no global admin.
  - Senate → institution‑wide read‑only analytics.
  - Analyst → broad analytics across views, but no RBAC/admin powers.
  - HR/Finance → domain‑specific analytics only.
  - Sysadmin → full system/admin access.
  - *Implemented:* Documented in `docs/PHASE3_SCOPE_RULES.md`. JWT claims set on login (student_id, access_number for students; faculty_id, department_id for app_users). Scope applied in analytics and dashboard SQL.

**Phase 3 completion checklist:**
- [x] 3.1 Canonical roles (9) in rbac.py, config, frontend config; PHASE3_SCOPE_RULES.md.
- [x] 3.2 Routes gated by PrivateRoute/RoleRoute; APIs use jwt_required + role/scope or has_permission; queries use get_user_scope / _dashboard_role_scope; UI uses canManage/canAccess.
- [x] 3.3 Scope rules documented; Student=self, Staff=classes, HOD=dept, Dean=faculty, Senate/Analyst=institution, HR/Finance=domain-only, Sysadmin=full.

---

### Phase 4 — Enterprise UI/UX & Design System ✅

- **4.1 Design system** ✅:
  - Unified typography, spacing scale, color tokens and chart palette.
  - *Implemented:* Typography in `frontend/src/index.css` (`.text-page-title`, `.text-section-title`, etc.). Color tokens in `:root`/`.dark`. **Design tokens:** `frontend/src/config/designTokens.js` — SPACING, CHART_PALETTE, CHART_PALETTE_SEQUENTIAL, SEMANTIC_COLORS; exported from `config/index.js`. **Reusable components:** PageShell, MetricCard, AnalyticSection, FilterBar (with date/semester and faculty/department/program selectors), ChartCard, Badge, Modal, Tabs (ui/), **AlertBanner** (`components/ui/alert-banner.jsx`), **Skeleton** (`components/ui/skeleton.jsx` — SkeletonLine, SkeletonCard, SkeletonTable), EmptyState, UnauthorizedState, state-messages (LoadingState, ErrorState). **Design system doc:** `docs/DESIGN_SYSTEM.md`.
- **4.2 Layouts & navigation** ✅:
  - Consistent, responsive page shells for all roles.
  - *Implemented:* `LayoutModern.jsx` used for all authenticated routes; `PageShell` and `PageHeader`/`PageContent` (with Breadcrumbs) available for pages. Hierarchy (page title → sections) and sidebar/breadcrumbs/header alignment documented in `docs/DESIGN_SYSTEM.md`.
- **4.3 Tables and filters** ✅:
  - Tables with sticky headers (where useful), sorting, search, pagination, filter chips, visible active filters and export‑ready patterns.
  - *Implemented:* **DataTable** (`components/shared/DataTable.jsx`): sticky header, column sort, pagination, optional **search** (`searchable` prop), optional **onExport** (Export button), optional **toolbar** slot. **FilterChips** (`components/shared/FilterChips.jsx`): active filters as chips with remove-one and clear-all. Use FilterBar + FilterChips + DataTable for full filter/table/export pattern; `utils/exportUtils.js` for CSV/Excel/PDF.
- **4.4 Profile route** ✅:
  - Each role’s `/profile` route renders **ProfilePage** (account and profile picture). User-info (employment, leave, payroll) remains at `/user-info`.

**Phase 4 completion checklist:**
- [x] 4.1 Design tokens (spacing, chart palette) in config/designTokens.js; typography/colors in index.css and tailwind; AlertBanner, Skeleton; DESIGN_SYSTEM.md.
- [x] 4.2 PageShell, PageHeader/Breadcrumbs; LayoutModern; hierarchy and navigation documented.
- [x] 4.3 DataTable: sticky header, sort, pagination, search, onExport, toolbar; FilterChips; FilterBar; exportUtils.
- [x] 4.4 Profile route and ProfilePage (pre-existing).

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

- **7.1 Chart asset model** ✅:
  - Each chart has id, title, description, owner, source query/metric definition, chart type, allowed scopes, visibility (roles/users), tags, last updated timestamp. *(Implemented: `assigned_query_visualizations` has description, tags, updated_at; API returns them; PATCH for metadata; visibility = target_type/target_value.)*
- **7.2 Manage Charts refactor** ✅:
  - **Saved Charts**: All created charts. *(Section loads `?created_by=me`; shows description, tags, updatedAt.)*
  - **Manage Charts | Shared**: Subset actively shared with roles/users. *(Section loads `/my-shared`.)*
  - Clear list, filter, edit, and unshare workflows. *(Filter by title/description/tags/target; Edit opens NextGen Query; Delete unshares.)*
- **7.3 Dashboard Manager** ✅:
  - Separate **Current Dashboards by Role** from **Custom Dashboards**.
  - Swapping, assigning, previewing, and editing workflows for analysts/sysadmins.
- **7.4 Dashboard builder UX** ✅:
  - Left: saved chart list; center: grid/canvas; right: properties + assignment. *(Implemented: Edit content modal is three-panel; center shows canvas preview.)*
  - Preview mode and validation before publishing/updating. *(Implemented: Preview shows banner "This is a preview. No changes will be saved."; validation message when nothing selected; Save disabled until at least one asset chosen.)*
- **7.5 NextGen Query visualizations in dashboards/pages** ✅:
  - In Dashboard Manager’s **Edit content** modal (for current dashboards and page configs), add a section to attach **visualizations created in NextGen Query**.
  - Allow analysts to browse/select from their **assigned/saved visualizations** (via `/api/query/assigned-visualizations`) and pin them into role dashboards and any page with visuals.
  - Page/dash definitions store **visualization_ids**; `RoleDashboardRenderer` renders them alongside built-in KPIs/charts.

---

### Phase 8 — NextGen Query Workspace (Read‑Only SQL Studio)

- **8.1 Safety & access** ✅:
  - Analyst/sysadmin only.
  - Backend enforces **read‑only queries**: only `SELECT`/`WITH` allowed; destructive or DDL statements blocked.
  - Limits and timeouts applied; clear, user‑friendly error messages returned. *(Timeout errors surfaced as "Query timed out after 8 seconds…" in API and frontend.)*
- **8.2 Layout** ✅:
  - SQL editor, result grid, visualization preview, chart configuration, save/share controls, query history *(labeled in header)*, validation/error panel *(labeled "Validation / errors" below editor)*.
- **8.3 Chart lifecycle** ✅:
  - From query → chart → **Saved Chart asset** with metadata and visibility.
  - Saved Charts available to dashboard builder and Manage Charts. *(In-app note on NextGen Query page: "To pin visualizations into role dashboards: Analyst → Dashboards → Edit content → NextGen Query visualizations.")*

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

