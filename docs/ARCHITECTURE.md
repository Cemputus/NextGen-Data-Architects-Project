# NextGen Analytics Platform — Architecture (Phase 1)

## 1. Feature modules

Single source and boundaries for each domain. Align with `PROJECT_STATUS.md` master plan.

### Backend

| Module | Location | Responsibility |
|--------|----------|----------------|
| **auth** | `api/auth.py` | Login, JWT, refresh, profile, app_users, RBAC DB (ucu_rbac), profile photo |
| **rbac** | `rbac.py` | Role enum, Resource/Permission, ROLE_PERMISSIONS, has_permission, get_allowed_resources |
| **users / admin** | `api/admin.py`, `app.py` (user-mgmt routes) | User CRUD, console KPIs, user-mgmt list/get/create/update/delete |
| **etl** | `etl_pipeline.py` | Bronze → Silver → Gold, RBAC seed, ETL phases and logging |
| **audit** | `audit_log.py` | Central log to ucu_rbac.audit_logs; used by auth, admin, export, ETL |
| **dashboard-core** | `api/dashboards.py` (dashboards_bp, get current for role) | Role’s current dashboard, definition, rendering data |
| **dashboard-builder** | `api/dashboards.py` (dashboard_manager_bp, page_config_bp) | Custom dashboards, swap, page config, edit content |
| **chart-library** | Frontend `components/charts/`, `components/ui/kpi-card` | ECharts components, KPI cards; backend: assigned-visualizations |
| **nextgen-query** | `api/nextgen_query.py` | Read-only SQL execution, assigned visualizations, save/share |
| **analytics-academic** | `api/analytics.py` (academic, grades, risk) | Faculty/dept/program-scoped analytics, filters, options |
| **analytics-finance** | `api/analytics.py`, payment/export endpoints | Payments, revenue, balances |
| **analytics-attendance** | `api/analytics.py`, attendance facts | Attendance metrics and filters |
| **analytics-recruitment** | `api/analytics.py`, high-school/feeder | Feeder schools, recruitment analytics |
| **analytics-risk** | `api/analytics.py`, risk endpoints | FCW/MEX/FEX, at-risk, retakes |
| **shared-utils** | `config/`, `config/constants.py`, `config/academic.py` | RBAC roles, KPI/chart/page IDs, academic calendar |
| **database** | `config.py` (conn strings), `pg_helpers.py`, `create_rbac_tables.py` | PostgreSQL connections, warehouse name, RBAC DB |

### Frontend

| Module | Location | Responsibility |
|--------|----------|----------------|
| **auth** | `context/AuthContext.js` | Session, token refresh, logout, idle/session expiry |
| **rbac** | `utils/rbac.js` (uses `config/`) | canAccess, getDefaultRoute; roles/routes from config |
| **shared-ui** | `components/ui/`, `components/shared/` | Buttons, cards, tables, modals, FilterBar, MetricCard, PageShell |
| **chart-library** | `components/charts/` (EChartsComponents), RoleBasedCharts | Bar, Line, Area, Pie, Stacked; role-based chart config |
| **dashboard-core** | RoleDashboardRenderer, dashboards/current API | Render current dashboard definition, KPIs, pinned viz |
| **dashboard-builder** | `pages/AnalystDashboardsPage.js` | Custom dashboards, swap, edit content, page config |
| **nextgen-query** | `pages/NextGenQueryPage.js`, assigned-visualizations API | SQL editor, results, chart config, save/share |
| **analytics-*** | Role dashboards (Student, Staff, HOD, Dean, Senate, Finance, HR), FEXAnalytics, etc. | Role-specific pages and filters |
| **shared-types** | Implicit (prop types / JSDoc) | No dedicated folder yet; document in components |
| **shared-utils** | `utils/`, `config/` | rbac, audit, exportUtils; central config (roles, routes, KPIs) |
| **services** | `services/api.js` (Phase 1) | API client wrappers; pages/containers call services, not raw axios in bulk |

---

## 2. Separation of concerns

- **Presentation** — Presentational components in `components/ui/` and `components/shared/`: no direct API calls; receive data and callbacks as props.
- **Containers / pages** — Pages and container components (e.g. AnalystDashboardsPage, AdminDashboard) handle state, side effects, and call **services** (or axios) for API access.
- **Reusable UI** — Buttons, cards, inputs, tables, modals in `ui/`; FilterBar, MetricCard, PageShell in `shared/`.
- **Chart components** — `charts/` and KPI/chart usage in RoleBasedCharts and RoleDashboardRenderer; data shape contract (e.g. category/value) documented.
- **Service / API layer** — Backend: Flask routes in `api/*.py` and `app.py`; business logic can move into `services/` or stay in api. Frontend: `services/api.js` (and optional per-domain files) wrap axios and export functions for auth, dashboards, user-mgmt, analytics.
- **Repository / query layer** — Backend: SQL and pandas in api modules and pg_helpers; analyst-safe views and scoped queries by role. No separate repository folder yet; documented as “query logic in api and config”.
- **ETL / settings / admin** — Isolated from user-facing analytics: ETL in `etl_pipeline.py` and admin triggers; user-mgmt and system settings under `/admin` and `/api/user-mgmt`, `/api/admin`; audit in `audit_log.py`.

---

## 3. Central configuration

Single source for env/config, RBAC role constants and route maps, KPI IDs, academic calendar/time logic.

### Backend

- **Env / app config**: `config.py` — DATABASE_URL/PG_*, DATA_WAREHOUSE_NAME, BRONZE/SILVER/GOLD paths, SECRET_KEY, JWT_SECRET_KEY, USE_SYNTHETIC_DATA.
- **RBAC roles**: `rbac.py` (Role enum); `config/constants.py` — RBAC_ROLES list, KPI_IDS, CHART_IDS, PAGE_CONFIG_KEYS, PAGE_CONFIG_LABELS.
- **Academic calendar**: `config/academic.py` — ACADEMIC_YEARS, SEMESTERS, SEMESTER_START_RULES.

### Frontend

- **Roles**: `config/roles.js` — ROLES, ROLE_LIST, ROLE_FILTER_OPTIONS.
- **Routes**: `config/routes.js` — getDefaultRoute(role), DEFAULT_ROUTE_BY_ROLE.
- **KPIs / charts / pages**: `config/kpis.js` — KPI_OPTIONS, CHART_OPTIONS, PAGE_CONFIG_KEYS, PAGE_CONFIG_LABELS, KPI_DEFINITIONS.
- **Entry**: `config/index.js` — re-exports all for `import { ... } from '../config'`.

`utils/rbac.js` uses `config` for roles and default route so that route and role lists are not duplicated.

---

## 4. Naming and conventions

- **Backend**: Python modules under `api/` are feature-named (auth, dashboards, nextgen_query, analytics). Config lives under `config/` with constants and academic calendar.
- **Frontend**: Pages under `pages/`; shared UI under `components/ui/` and `components/shared/`; domain components (e.g. admin) under `components/admin/`. Config under `config/`; API access via `services/api.js` where applicable.
- **RBAC**: Backend enforces on every analytics, admin, dashboard, and NextGen Query endpoint; frontend uses config and `rbac.canAccess` for UI visibility and redirects.
