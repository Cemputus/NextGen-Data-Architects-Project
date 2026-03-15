# Phase 3 — RBAC & Scope Enforcement

## 3.1 Canonical roles

Exactly nine roles (aligned with `backend/rbac.py` `Role` enum and `backend/config/constants.py` `RBAC_ROLES`):

| Role       | Description                          | UI note                    |
|-----------|--------------------------------------|----------------------------|
| Student   | Registered student                   | —                          |
| Staff     | Teaching / department staff         | —                          |
| HOD       | Head of Department                   | —                          |
| Dean      | Faculty Dean                         | —                          |
| Senate    | Senate / institution-level reader    | —                          |
| Analyst   | Data analyst (no user/admin powers)  | —                          |
| HR        | HR domain                            | —                          |
| Finance   | Finance domain                       | —                          |
| Sysadmin  | Full system access                   | UI may show as "Admin"     |

**Note:** The frontend and some endpoints treat `admin` as an alias for `sysadmin` (e.g. Admin Console, user management). The canonical role name in backend is `sysadmin`.

---

## 3.2 Enforcement layers

- **Routes/pages:** All role-specific paths are gated by `PrivateRoute` with `requiredRole` or `allowedRoles` (`frontend/src/App.js`). Unauthorised roles are redirected to their default route.
- **APIs:**
  - Every analytics endpoint: `@jwt_required()` and either scope applied (Student/HOD/Dean/Staff) or permission check (`has_permission(role, resource, Permission.READ)`). HR/Finance have domain-specific resources only (no FEX_ANALYTICS / HIGH_SCHOOL_ANALYTICS unless granted).
  - Dashboard endpoints: `@jwt_required()` and `_dashboard_role_scope()` in `app.py` (student = self, staff = assigned courses, HOD = department, Dean = faculty, Senate/Analyst/Sysadmin = no scope).
  - NextGen Query: `_require_analyst_or_sysadmin(role)` (analyst or sysadmin only).
  - User management / admin: `_require_sysadmin()` (sysadmin or admin only); analyst cannot access.
- **Queries:** SQL in analytics and dashboard code adds WHERE clauses using `get_user_scope(claims)` or `_dashboard_role_scope()` so that data is restricted by `student_id`, `department_id`, `faculty_id`, or assigned courses as per role.
- **Dashboards/charts/actions:** UI hides or disables actions by role (e.g. Dashboard Manager “Edit content”, “Add dashboard”) using `canManage` or `rbac.canAccess(userRole, resource)`.

---

## 3.3 Scope rules (data visibility)

| Role     | Scope rule                                                                 |
|----------|----------------------------------------------------------------------------|
| Student  | **Self only:** profile, own grades, FCW/MEX/FEX, retakes, fees, attendance. Queries restricted by `student_id` or `access_number` from JWT. |
| Staff    | **Teaching / department scope only:** assigned courses (from staff–course assignment). No global or department-wide student list beyond their classes. |
| HOD      | **Department-wide** analytics; no global admin. Queries restricted by `department_id` from JWT. |
| Dean     | **Faculty-wide** analytics; no global admin. Queries restricted by `faculty_id` from JWT. |
| Senate   | **Institution-wide read-only** analytics. No scope filter (can see all faculties/departments). No admin/user management. |
| Analyst  | **Broad analytics** across views (institution-wide). No RBAC/admin powers (no user management, no system settings). NextGen Query allowed. |
| HR       | **Domain-specific only:** HR analytics, staff, leave, payroll. No FEX/high-school/academic-risk analytics unless explicitly granted. |
| Finance  | **Domain-specific only:** finance analytics, payments, tuition. No FEX/high-school/academic-risk analytics unless explicitly granted. |
| Sysadmin | **Full system/admin** access: user management, ETL, audit logs, settings, all analytics. |

---

## Implementation references

- **Backend role enum and permissions:** `backend/rbac.py` (`Role`, `Resource`, `Permission`, `ROLE_PERMISSIONS`, `has_permission`).
- **Backend scope in analytics:** `backend/api/analytics.py` (`get_user_scope`, `build_filter_query`; HOD/Dean/Student scope applied in SQL).
- **Backend scope in dashboards:** `backend/app.py` (`_dashboard_role_scope`).
- **JWT claims:** Login sets `role`, `student_id`, `access_number` (students), `faculty_id`, `department_id` (app_users: Dean, HOD, Staff).
- **Frontend:** `frontend/src/utils/rbac.js` (`canAccess`, `getDefaultRoute`), `frontend/src/config/roles.js` (canonical role list).
