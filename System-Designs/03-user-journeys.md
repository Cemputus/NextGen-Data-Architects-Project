# 03 — User Journeys

Navigation is implemented in [`frontend/src/App.js`](../frontend/src/App.js): each role has a dedicated path prefix (`/student`, `/staff`, `/hod`, `/dean`, `/senate`, `/analyst`, `/admin`, `/hr`, `/finance`) with `PrivateRoute` enforcing authentication and role alignment.

## Combined journey (swimlane-style)

```mermaid
flowchart TB
    START([User opens app]) --> LOGIN{Authenticated?}
    LOGIN -->|No| L[/login]
    L --> JWT[POST /api/auth/login\nJWT access + refresh]
    JWT --> DASH[/dashboard redirect by role]
    LOGIN -->|Yes| DASH

    DASH --> R{Role}

    R -->|student| SD[/student/*\ndashboard, grades, attendance, payments, predictions, profile]
    R -->|staff| SF[/staff/*\ndashboard, classes, predictions, profile]
    R -->|hod| HD[/hod/*\ndashboard, assign-classes, FEX, recruitment, risk, predictions]
    R -->|dean| DN[/dean/*\ndashboard, FEX, recruitment, risk, predictions]
    R -->|senate| SN[/senate/*\ndashboard, FEX, recruitment, risk, finance, reports, predictions]
    R -->|analyst| AN[/analyst/*\ndashboard, dashboards, FEX, reports, query, predictions]
    R -->|sysadmin / admin| AD[/admin/*\ndashboard, users, settings, ETL, audit, predictions]
    R -->|hr| HR[/hr/*\ndashboard, staff, employees, leave, payroll, evaluation, predictions]
    R -->|finance| FN[/finance/*\ndashboard, payments, predictions]
```

## Primary screens and actions by role

| Role | Route prefix | Primary actions (from `App.js`) |
|------|--------------|----------------------------------|
| **Student** | `/student/*` | Dashboard; grades; attendance; payments; performance prediction; profile; shared views. |
| **Staff** | `/staff/*` | Dashboard; class list/classes; predictions (class-scoped API); profile; leave requests. |
| **HOD** | `/hod/*` | Department dashboard; assign classes; FEX analytics; recruitment analytics; academic risk; predictions (department-scoped). |
| **Dean** | `/dean/*` | Faculty dashboard; FEX; recruitment; risk; predictions (faculty-scoped). |
| **Senate** | `/senate/*` | Senate dashboard; FEX; recruitment; risk; senate finance; reports; predictions. |
| **Analyst** | `/analyst/*` | Analyst dashboard; dashboard manager (with sysadmin); FEX; recruitment; risk; reports; **NextGen Query**; predictions. |
| **Sysadmin** | `/admin/*` | Admin dashboard; **user management**; settings; **ETL**; ETL notifications; **audit**; predictions. |
| **HR** | `/hr/*` | HR dashboard; staff directory; employees; leave; payroll; evaluation; predictions. |
| **Finance** | `/finance/*` | Finance dashboard; payments; predictions. |

*Shared:* `/login` for all unauthenticated users; `/dashboard` legacy redirect resolves to role default via `RoleRedirect` and [`frontend/src/config/routes.js`](../frontend/src/config/routes.js) / `getDefaultRoute`.

## Related documents

- [RBAC matrix](./06-rbac-security.md)
- [Architecture](./02-architecture.md)
