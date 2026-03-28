# Production URLs, CORS, and session behavior

This document is the **canonical reference** for the live NextGen MIS deployment split across **Vercel** (frontend) and **Render** (API). It describes how authentication and sessions work in production so operations and developers stay aligned.

## Canonical production endpoints

| Role | URL | Notes |
|------|-----|--------|
| **Frontend (React SPA)** | [https://nextgen-mis.vercel.app](https://nextgen-mis.vercel.app) | Login: `/login` |
| **Backend (Flask API)** | [https://nextgen-mis.onrender.com](https://nextgen-mis.onrender.com) | Health: `/api/status`; JSON root documents entrypoints |

**How the browser reaches the API (canonical production setup)**

- **Recommended:** Set `REACT_APP_API_URL=https://nextgen-mis.onrender.com` at build time (see `frontend/.env.production`). Then `axios.defaults.baseURL` points at the Render API; the SPA at [https://nextgen-mis.vercel.app](https://nextgen-mis.vercel.app) calls the backend **directly** over HTTPS. CORS on the Flask app already allows the Vercel origin; JWTs are sent as `Authorization: Bearer …` (no shared cookies required).
- **Alternative:** Omit `REACT_APP_API_URL` and rely on `frontend/vercel.json` rewrites so `/api/*` on the Vercel host is proxied to Render (same-origin from the browser’s perspective for `/api` paths).

**Vercel** should keep `REACT_APP_API_URL` equal to the live Render service URL for consistent session and asset URLs.

## CORS (cross-origin)

The browser loads the SPA from `https://nextgen-mis.vercel.app` and issues API requests to `https://nextgen-mis.onrender.com`. That is **cross-origin**; the backend must allow the frontend origin.

In `backend/app.py`, the default CORS allowlist includes:

- `https://nextgen-mis.vercel.app`
- `https://www.nextgen-mis.vercel.app`

Additional origins can be appended via environment variables:

- `FRONTEND_URL` — single origin (e.g. a preview or custom domain)
- `FRONTEND_URLS` — comma-separated list (e.g. Vercel preview deployments)

`CORS(..., supports_credentials=True)` is enabled so future cookie-based flows remain compatible; **today the app uses JWTs in the `Authorization` header**, not cookies, which fits cross-origin deployment without shared cookies.

## Session model (professional / production-appropriate)

Sessions are implemented in a standard way for SPAs:

1. **Access token (JWT)** — Short-lived (default **60 minutes** when session expiry is enabled on the backend). Sent on each request as `Authorization: Bearer <token>`.

2. **Refresh token** — Longer-lived (default **12 hours** when expiry is enabled). Stored in `sessionStorage` with the access token; used to obtain a new access token without re-login.

3. **Silent refresh** — The frontend refreshes the access token on an interval **before** expiry so active users are not interrupted while navigating.

4. **Idle timeout** — **60 minutes** of no user activity (mouse, keyboard, scroll, focus, wheel) ends the session client-side for compliance and shared-terminal safety. Tab switches **reset the idle timer** without an extra profile API call, avoiding spurious logouts.

5. **401 handling** — Failed requests with an expired access token trigger **one** refresh-and-retry; only **confirmed HTTP 401/422** responses from the server clear the session (not transient network errors).

### Environment flags (align frontend and backend)

| Environment | Variable | Purpose |
|-------------|----------|---------|
| **Backend** | `DISABLE_SESSION_EXPIRY=0` (default in repo) | Enables 60-minute access tokens and 12-hour refresh tokens. Set to `1` only for long-lived JWT local/demo. |
| **Backend** | `JWT_SECRET_KEY`, `SECRET_KEY` | Must be strong, unique secrets in production. |
| **Frontend** | `REACT_APP_DISABLE_SESSION_EXPIRY` unset or anything other than `1` | Session rules (idle, 401 handling) **active**. Set to `1` only for local demo without idle rules. |
| **Frontend** | `REACT_APP_API_URL=https://nextgen-mis.onrender.com` | **Set at build time** for production so axios and absolute asset URLs target the Render API. |

Rebuild the frontend after changing `REACT_APP_*` variables.

## Dashboard Manager and RBAC APIs (production)

Role dashboards, **Dashboard Manager** (`/analyst/dashboards`), and related endpoints are **not** limited to localhost. In production they behave the same as locally, as long as the browser talks to the **Render** API and the database is available.

| Topic | Production behavior |
|-------|---------------------|
| **Base URL** | All dashboard calls use the same `axios.defaults.baseURL` as everything else: `REACT_APP_API_URL` (e.g. `https://nextgen-mis.onrender.com`). Relative paths like `/api/dashboard-manager/ensure-wired` resolve to that host. |
| **No hardcoded localhost** | Production builds should set `REACT_APP_API_URL` in `.env.production` (or Vercel env) so the SPA never falls back to `127.0.0.1:5000`. |
| **Auth** | Same JWT: `Authorization: Bearer …` after login to `https://nextgen-mis.onrender.com/api/auth/login`. Analyst/Sysadmin routes require that token. |
| **CORS** | Same as [CORS](#cors-cross-origin): Vercel origin must be allowed on the Flask app (defaults include `nextgen-mis.vercel.app`). |
| **Database** | `ucu_rbac` is on the **same** Render Postgres instance as the warehouse; `DATABASE_URL` / `PG_*` on the Web Service must match. Dashboard tables are created on first use. |
| **PostgreSQL** | Use a backend image that compares boolean columns correctly (`is_active IS TRUE`, not `= 1`). |

**Smoke test (production):** Log in as Analyst → open **Dashboard Manager** → **Refresh**. You should see **Current Dashboards** populate (or a clear error if the API cannot reach RBAC). That confirms `ensure-wired` and `GET /api/dashboard-manager/current` work on Render.

## Checklist for a new production deploy

- [ ] Backend URL is `https://nextgen-mis.onrender.com` (or your chosen Render service URL).
- [ ] Vercel (or other host) build has `REACT_APP_API_URL` pointing to that backend.
- [ ] Backend CORS includes your exact frontend origin (defaults cover `nextgen-mis.vercel.app`).
- [ ] `JWT_SECRET_KEY` and `SECRET_KEY` are set and not committed to git.
- [ ] Optional: set `FRONTEND_URL` or `FRONTEND_URLS` on Render if you use extra domains or Vercel preview URLs.
- [ ] **Dashboard Manager:** After deploy, open `/analyst/dashboards` on the Vercel URL and verify Current Dashboards or RBAC error banner (not silent failure).

## Related documentation

- [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) — Step-by-step Render setup and blueprints.
- Root [README.md](../../README.md) — Project overview and links.
- Frontend auth implementation: `frontend/src/context/AuthContext.js`
- Backend JWT configuration: `backend/app.py` (`JWT_ACCESS_TOKEN_EXPIRES`, `JWT_REFRESH_TOKEN_EXPIRES`, CORS)
