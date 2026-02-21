# Analyst Role — Codebase Reference

This document summarizes where and how the **analyst** role is implemented across the frontend and backend so you can work on analyst features efficiently.

---

## 1. Routes & entry

| Location | What |
|----------|------|
| **App.js** | `/analyst/*` under `PrivateRoute requiredRole="analyst"`. Routes: `dashboard`, `analytics`, `fex`, `high-school`, `predictions`, `reports`, `profile`. Fallback: `Navigate to="/analyst/dashboard"`. |
| **Login.js** | On success, analyst → `navigate('/analyst/dashboard')`. |
| **utils/rbac.js** | `ANALYST: 'analyst'`, `getDefaultRoute('analyst')` → `/analyst/dashboard`, `canAccess` lists: dashboard, analytics, fex, high-school, reports, profile. |

---

## 2. Sidebar (LayoutModern.jsx)

Analyst nav items:

- `/analyst/dashboard` — Workspace
- `/analyst/analytics` — Analytics
- `/analyst/fex` — FEX Analysis
- `/analyst/high-school` — High School
- `/analyst/predictions` — Predictions
- `/analyst/reports` — Reports
- `/analyst/profile` — Profile

---

## 3. Frontend pages (analyst-specific or shared)

### 3.1 AnalystDashboard.js (`/analyst/dashboard`)

- **PageHeader**: title "Analytics Workspace", subtitle "Create and modify analytics dashboards".
- **Actions**: ExportButtons (filename `analyst_workspace`), Button "New Dashboard" (no handler yet).
- **GlobalFilterPanel**: `onFilterChange={setFilters}`; single filter state for the page.
- **Tabs** (default `fex`):
  - **FEX Analytics**: Card wrapping `<FEXAnalytics filters={filters} onFilterChange={setFilters} />` (controlled by dashboard filters).
  - **High School**: Card wrapping `<HighSchoolAnalytics filters={filters} onFilterChange={setFilters} />` (controlled).
  - **Custom**: "Custom Analytics Builder" — placeholder "Coming soon".
  - **Reports**: "Saved Reports" — placeholder "No saved reports yet".

So: **Workspace** = one filter bar + FEX tab + High School tab + placeholders for Custom and Saved Reports.

### 3.2 AnalyticsPage.js (`/analyst/analytics`)

- Used with **type="analyst"** (from route `element={<AnalyticsPage type="analyst" />}`).
- **Title**: `getTitle()` → "Analytics Workspace" for `type === 'analyst'`.
- **Data**: `loadAnalytics()` calls `/api/dashboard/stats` with `params: filters` (same as other roles).
- **UI**: GlobalFilterPanel, ModernStatsCards(stats, type="analyst"), RoleBasedCharts(filters, type="analyst").
- **Persistence**: `loadPageState('analyst_analytics', { filters: {} })`, `savePageState` on filter change.

So: **Analytics** = dashboard stats + role-based charts (analyst gets same chart set as other “institution” style roles where applicable).

### 3.3 FEXAnalytics.js

- **Used by**: AnalystDashboard (controlled: `filters` + `onFilterChange`) and route `/analyst/fex` (standalone, own state).
- **API**: `GET /api/analytics/fex` with `params: { ...filters, drilldown }`.
- **Props**: `filters` (optional), `onFilterChange` (optional). If `filters != null`, controlled: no internal filter panel, uses parent filters.
- **State**: drilldown (overall/faculty/department/program/course), activeTab (distribution/trends/comparison/table), loading, fexData.
- **Persistence**: When not controlled, `loadPageState('fex_analytics', { filters, drilldown, tab })`.
- **UI**: KPIs (Total FEX, FEX Rate, MEX, FCW), drilldown Select, ExportButtons, tabs (Distribution = bar chart + table, Trends/Comparison = “Coming soon”, Details = table). EmptyState when no data.

### 3.4 HighSchoolAnalytics.js

- **Used by**: AnalystDashboard (controlled) and route `/analyst/high-school` (standalone).
- **API**: `GET /api/analytics/high-school` with `params: filters`.
- **Props**: same pattern as FEX (`filters`, `onFilterChange`; controlled when used from dashboard).
- **State**: activeTab (enrollment, retention, performance, programs, tuition), loading, hsData.
- **Tabs**: Enrollment (bar), Retention & Graduation (line), Performance/Programs placeholders, Tuition (bar). Empty/debug UI when no data.

### 3.5 ReportsPage.js (`/analyst/reports`)

- **Used by**: Senate and Analyst (shared).
- **PageHeader**: "Reports", "Generate and download comprehensive reports"; actions = ExportButtons(stats={}, filters, filename `comprehensive_report`).
- **GlobalFilterPanel**: filters applied to export.
- **Content**: "Generate Report" card (Export Excel, Export PDF via `/api/export/${format}` with `params: filters`); "Report History" card (placeholder list, currently "No reports generated yet").

### 3.6 PredictionPage.js (`/analyst/predictions`)

- **Shared** with other roles; analyst-specific behavior:
  - **Scenario analysis**: `canUseScenarios = ['analyst', 'sysadmin', 'senate'].includes(user?.role)` — only these roles see scenario UI.
  - Message: "Scenario analysis is only available for Analysts, System Administrators, and Senate members."

### 3.7 ProfilePage.js

- Shared; no analyst-specific logic.

---

## 4. RoleBasedCharts and analyst

- **Invocation**: `RoleBasedCharts filters={filters} type={type}`. For analyst, `type` is `'analyst'` when used from AnalyticsPage.
- **Role**: `role = user?.role || 'student'` from useAuth(); so when user is analyst, `role === 'analyst'`.
- **Charts shown for analyst** (same as senate/staff/dean/hod where applicable):
  - Student Distribution by Department (senate, dean, hod, staff, **analyst**).
  - Trend Analysis of Grades Over Time (all non-finance, including analyst).
  - Payment Status / Payment Trends (by page type and role).
  - Grade Distribution (donut), Top 10 Students, Attendance Trends (all non-finance, including analyst).
- **Data fetching**: All dashboard chart APIs receive `filters` (and sometimes `role`). For analyst there is no extra backend role scope; filters alone narrow data (institution-wide when filters empty).

---

## 5. Backend — analyst in RBAC and APIs

### 5.1 rbac.py

- **Role.ANALYST**
- **ROLE_PERMISSIONS[Role.ANALYST]**:
  - DASHBOARD: READ, WRITE
  - ANALYTICS: READ, WRITE, UPDATE, EXPORT, SHARE
  - REPORTS: READ, WRITE, EXPORT, SHARE
  - STUDENTS, STAFF: READ
  - FEX_ANALYTICS, HIGH_SCHOOL_ANALYTICS: READ, WRITE, EXPORT
  - PREDICTIONS: READ, WRITE, EXPORT
  - PROFILE: READ, UPDATE

### 5.2 api/analytics.py

- **get_fex_analytics()**: `has_permission(role, Resource.FEX_ANALYTICS, Permission.READ)`. Analyst has permission; no role-based WHERE scope for analyst in `build_filter_query` (only STUDENT, STAFF, HOD, DEAN). So analyst sees **institution-wide** FEX data, filtered only by request `filters`.
- **get_high_school_analytics()**: `has_permission(role, Resource.HIGH_SCHOOL_ANALYTICS, Permission.READ)`. Same idea: no analyst-specific scope; filters from request only.
- **get_filter_options()**: For faculties/departments/programs/courses, Analyst is grouped with "Staff, Senate, Analyst, Finance, HR, SYSADMIN" — sees all faculties; "Other roles (Dean, HOD, Senate, **Analyst**, Finance, HR)" for course filtering. No extra restriction for analyst.

### 5.3 api/predictions.py

- Scenario analysis endpoint checks: `user_scope['role'] in [Role.ANALYST, Role.SYSADMIN, Role.SENATE]`. Only these three can run scenario analysis.

### 5.4 app.py (dashboard stats, auth, admin)

- **get_dashboard_stats()**: Uses role scope from JWT; for senate/analyst there is no role_where, so stats are institution-wide unless request args (filters) add faculty/department/program.
- **Auth / demo user**: e.g. `analyst` / `analyst123`.
- **Admin create user**: allowed_roles includes `'analyst'`.

---

## 6. Export & reporting

- **ExportButtons**: Used on AnalystDashboard (filename `analyst_workspace`), AnalyticsPage (`analyst_analytics`), ReportsPage (`comprehensive_report`), FEXAnalytics, HighSchoolAnalytics. All pass `filters` where applicable.
- **ReportsPage**: Calls `/api/export/${format}` (Excel/PDF) with `params: filters`.

---

## 7. State persistence (analyst)

- **AnalystDashboard**: No persistence of its own; filter state is in memory.
- **AnalyticsPage**: `loadPageState('analyst_analytics', { filters: {} })`, `savePageState` when filters change.
- **FEXAnalytics**: When standalone, `loadPageState('fex_analytics', { filters, drilldown, tab })`.
- **HighSchoolAnalytics**: When standalone, `loadPageState('high_school_analytics', { filters, tab })`.

---

## 8. Gaps / placeholders (for your analyst work)

- **AnalystDashboard**: "New Dashboard" button has no handler. "Custom Analytics Builder" and "Saved Reports" are placeholders.
- **FEXAnalytics**: "Trends" and "Comparison" tabs are "Coming soon".
- **HighSchoolAnalytics**: "Performance" and "Programs" tabs are "Coming soon".
- **ReportsPage**: "Report History" is static empty state; no API for saved reports.
- **AnalyticsPage** for analyst: Uses `/api/dashboard/stats` and RoleBasedCharts; no analyst-only endpoints.

---

## 9. File checklist (analyst-related)

| Area | Files |
|------|--------|
| Routes & layout | `App.js`, `LayoutModern.jsx`, `Login.js` |
| RBAC (frontend) | `utils/rbac.js` |
| Dashboards & pages | `AnalystDashboard.js`, `AnalyticsPage.js`, `FEXAnalytics.js`, `HighSchoolAnalytics.js`, `ReportsPage.js`, `PredictionPage.js`, `ProfilePage.js` |
| Charts & filters | `RoleBasedCharts.jsx`, `GlobalFilterPanel.js` |
| Backend RBAC | `backend/rbac.py` |
| Backend analytics | `backend/api/analytics.py` (fex, high-school, filter-options) |
| Backend predictions | `backend/api/predictions.py` (scenario) |
| Backend app | `backend/app.py` (dashboard/stats, auth, admin) |
| Export | `ExportButtons.jsx`, `exportUtils.js` |
| Persistence | `utils/statePersistence.js` |

Use this doc as the single reference when you work on the analyst role next.
