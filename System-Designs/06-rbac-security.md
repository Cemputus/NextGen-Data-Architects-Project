# 06 — RBAC and Security

## Sources of truth

| Artifact | Purpose |
|----------|---------|
| [`backend/rbac.py`](../backend/rbac.py) | `Role`, `Resource`, `Permission`, `ROLE_PERMISSIONS`, `has_permission()` |
| [`frontend/src/config/roles.js`](../frontend/src/config/roles.js) | Same role string constants for the SPA (`ROLES`, `ROLE_LIST`) |
| JWT claims | `role`, `username`, optional `faculty_id` / `department_id` — used by route handlers to scope queries |

The UI routes administrative users to `/admin/*` while the backend role value remains **`sysadmin`** (see [`frontend/src/App.js`](../frontend/src/App.js) and `roles.js`).

---

## Authentication (JWT)

1. **Login:** `POST /api/auth/login` with `identifier` and `password` ([`backend/api/auth.py`](../backend/api/auth.py)).
2. **Credential sources:** Built-in demo accounts (fixed password), then **`app_users`** in `ucu_rbac` with `pbkdf2:sha256` hashes, then student/staff resolution paths as implemented in the same module.
3. **Tokens:** **Flask-JWT-Extended** issues an **access token** and **refresh token**; refresh via `POST /api/auth/refresh`.
4. **Client:** The React app stores tokens (typically `localStorage`) and sends `Authorization: Bearer <access_token>` on API calls.
5. **Logout / audit:** `POST /api/auth/logout`; login success/failure may write to **`audit_logs`** when the table is available.

Session idle behaviour and production URLs are documented in [`docs/deployment/PRODUCTION_URLS_AND_SESSIONS.md`](../docs/deployment/PRODUCTION_URLS_AND_SESSIONS.md) (*if present in your clone*).

---

## Role × resource matrix (authoritative)

Permissions are defined in **`ROLE_PERMISSIONS`** in [`rbac.py`](../backend/rbac.py). The table below summarizes **resource** access by **role** (R = read, W = write/update where applicable, M = manage, E = export; **—** = not granted in the matrix). **Scope** (`own`, `classes`, `department`, `faculty`, `finance`) is enforced in API/query code, not only by this table.

| Resource | Student | Staff | HOD | Dean | Senate | Analyst | Sysadmin | HR | Finance |
|----------|---------|-------|-----|------|--------|---------|----------|-----|---------|
| dashboard | R (own) | R | R | R | R | R/W | R | R | R |
| analytics | R (own) | — | R/E (dept) | R/E (faculty) | R/E | R/W/E | R/W/E | — | — |
| class_analytics | — | R/E | — | — | — | — | — | — | — |
| department_analytics | — | — | R/E | — | — | — | — | — | — |
| faculty_analytics | — | — | — | R/E | — | — | — | — | — |
| fex_analytics | — | — | R/E (dept) | R/E (faculty) | R/E | R/W/E | R/W/E | — | — |
| high_school_analytics | — | — | R/E (dept) | R/E (faculty) | R/E | R/W/E | R/W/E | — | — |
| reports | — | — | — | — | R/E/share | R/W/E/share | R/W/E | — | — |
| students | — | R (classes) | R (dept) | R (faculty) | R | R | — | — | R (finance) |
| staff | — | — | R (dept) | R (faculty) | R | R | — | R/W | — |
| grades | R (own) | R/W (classes) | — | — | — | — | — | — | — |
| attendance | R (own) | R/W (classes) | — | — | — | — | — | — | — |
| payments | R (own) | — | — | — | — | — | — | — | R/W/E |
| enrollments | R (own) | — | — | — | — | — | — | — | — |
| predictions | R (own) | R (classes) | R/E (dept) | R/E (faculty) | R/E | R/W/E | R/W/E/M | — | — |
| user_management | — | — | — | — | — | — | M | — | — |
| system_settings | — | — | — | — | — | — | R/U/M | — | — |
| etl_jobs | — | — | — | — | — | — | R/U/M | — | — |
| audit_logs | — | — | — | — | — | — | R/E | — | — |
| profile | R/U (own) | R/U (own) | R/U | R/U | R/U | R/U | R/U | R/U | R/U |
| hr_analytics | — | — | — | — | — | — | — | R/W/E | — |
| finance_analytics | — | — | — | — | — | — | — | — | R/W/E |

For exact permission sets (including `Permission` enum values per cell), refer to **`ROLE_PERMISSIONS`** in code.

---

## Frontend alignment

[`roles.js`](../frontend/src/config/roles.js) exports the same nine role strings the backend expects. Route guards (`PrivateRoute`) ensure users only reach role-prefixed paths that match their JWT role.

---

## Related documents

- [Architecture](./02-architecture.md)
- [API surface](./07-api-and-integrations.md)
