# NextGen MIS / Analytics Platform Hardening — master plan

## Platform Objective
Upgrade to a production-grade institutional analytics platform with enterprise UI/UX (Power BI/Tableau style), strict RBAC, PostgreSQL optimization, and modular architecture.

---

## 🏗️ Phase 1 — Enterprise Design System (UI Foundations)
**Objective**: Establish a premium visual language and reusable components.

- [x] **1.1 Design Tokens**: Unified HSL system in `index.css` (Deep Navy, Indigo Accent).
- [x] **1.2 Component Library**:
  - [x] `MetricCard`: KPI tiles with trends.
  - [x] `ChartCard`: Chart container with skeleton/error states.
  - [x] `FilterBar`: Cascading Faculty → Dept dropdowns.
  - [x] `DataTable`: Enterprise-grade sorting/pagination.
  - [x] `StatusBadge`: Semantic status chips (FCW/FEX/MEX/Completed).
  - [x] `PageShell`: Standardized page layout component.
- [ ] **1.3 Shell Upgrade**: Breadcrumbs, sidebar groups, and mobile responsiveness.
- [ ] **1.4 Chart Registry**: Global theme and color palette for ECharts/Recharts.

---

## 🧠 Phase 2 — Analytics Backend & Data Hardening
**Objective**: Implement analytical logic for fails, retakes, and backgrounds.

- [x] **2.1 FCW/MEX/FEX Logic**: Integrated into ETL for `fact_grade`.
- [x] **2.2 High School Integration**: Synthetic HS data mapped to students.
- [x] **2.3 Risk Endpoints**:
  - [x] `GET /api/analytics/academic-risk`
  - [x] `GET /api/analytics/high-school-risk-correlation`
  - [ ] `GET /api/analytics/my-retakes`
- [x] **2.4 Seed System**: Comprehensive user seeding across all roles (`seed_users.py`).

---

## 📊 Phase 3 & 4 — Dashboard Rebuilds & Risk Visualization
**Objective**: Build role-specific dashboards with documented KPIs.

- [ ] **3.1 Senate Dashboard**: Strategic institution-wide visibility.
- [ ] **3.2 Dean Dashboard**: Faculty-level BI.
- [ ] **3.3 HOD Dashboard**: Departmental performance & course risk.
- [ ] **3.4 Student Dashboard**: Personal grades & retake tracker.
- [ ] **3.5 Staff Dashboard**: Teaching load & class risk.
- [ ] **3.6 Finance/HR Dashboards**: Payment collection & staffing trends.
- [ ] **4.1 Risk Correlation**: Visualizing HS background vs. academic failure.

---

## � Phase 5 & 6 — NextGen Query & Custom Dashboards
**Objective**: Provide self-service analytics and dashboard authoring.

- [ ] **5.1 Query Workspace**: Monaco-based SQL editor with chart preview.
- [ ] **5.2 Chart Library**: "Saved Charts" and "Charts I Shared" system.
- [ ] **6.1 Board Builder**: Drag-and-drop / Grid assignment of chart assets.
- [ ] **6.2 Dashboard CRUD**: Persistent layouts for custom roles.

---

## ⚡ Phase 7 — PostgreSQL & ETL Optimization
**Objective**: Production-grade data warehousing performance.

- [x] **7.1 Analytical Views**: Academic summary, risk summary, and HS correlation views.
- [ ] **7.2 Indexing Audit**: High-query-volume columns on fact tables.
- [x] **7.3 ETL Verification**: Validating Medalion layers (Bronze → Silver → Gold).

---

## 🏁 Success Criteria
- [ ] **Visual Impact**: Platform feels professional, clean, and TRUSTWORTHY.
- [ ] **Data Accuracy**: Counts match UCU documentation (FCW/MEX/FEX rules).
- [ ] **RBAC Security**: No data leakage between faculty/dept scopes.
- [ ] **Performance**: Dashboard charts load in < 1 second.
