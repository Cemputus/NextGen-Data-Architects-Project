# 08 — Operations and Non-Functional Aspects

This section records **only what the repository supports** (config, deployment docs, and code). Items not documented here should be stated as *project assumptions* during your presentation.

---

## Hosting

| Concern | As implemented |
|---------|----------------|
| **API** | Dockerized Flask service (`backend/Dockerfile`), deployable on **Render** per [`render.yaml`](../render.yaml) (web service, Oregon region in the sample file). |
| **Database** | **Render PostgreSQL** blueprint in `render.yaml` (`nextgen-db`); connection string injected as `DATABASE_URL`. |
| **Frontend** | Static build (`npm run build`), publish `build/` — e.g. Render static site or **Vercel** ([`docs/deployment/RENDER_DEPLOYMENT.md`](../docs/deployment/RENDER_DEPLOYMENT.md)). |
| **Health check** | Render uses `/api/user-mgmt/ping` ([`render.yaml`](../render.yaml)). |

Production URL split (Vercel + Render) and CORS/session notes are described in [`docs/deployment/PRODUCTION_URLS_AND_SESSIONS.md`](../docs/deployment/PRODUCTION_URLS_AND_SESSIONS.md) when that file is present in the repo.

---

## Environment variables (representative)

| Variable | Role |
|----------|------|
| `DATABASE_URL` | Render-injected Postgres URL; backend uses it to derive or override DB connectivity. |
| `SECRET_KEY`, `JWT_SECRET_KEY` | Flask and JWT signing; generated in Render blueprint. |
| `FRONTEND_URL` | CORS / operational reference for the live SPA. |
| `DISABLE_SESSION_EXPIRY` | Token/session behaviour (0 = normal expiry rules in production). |
| `PYTHONUNBUFFERED` | `1` for logging in containers. |
| `REACT_APP_API_URL` | Base URL of the API for the SPA build. |
| `REACT_APP_DISABLE_SESSION_EXPIRY` | Client-side session handling alignment. |

---

## Scalability and performance (code-visible)

- **Shared DB engines** and **JSON response caching** are used in [`backend/app.py`](../backend/app.py) to reduce repeated warehouse queries under concurrent dashboard loads.
- **Gunicorn** runs the app in Docker (see `Dockerfile`); horizontal scaling would require multiple instances behind a load balancer and shared session/token semantics — *not detailed in the repo*.

---

## Backups and migrations

- **Render** documentation describes PostgreSQL provisioning and optional manual DB creation ([`docs/deployment/RENDER_DEPLOYMENT.md`](../docs/deployment/RENDER_DEPLOYMENT.md)). **Automated backup policies** are a **platform concern** (Render/Vercel); the repo does not define backup schedules.
- **Schema migrations** are delivered as SQL scripts under [`backend/sql/`](../backend/sql/) and runtime `CREATE TABLE IF NOT EXISTS` / `ALTER` in application code; there is no separate migration runner named in the root README.

---

## Observability

- **Audit:** `audit_logs` table and auth audit hooks where enabled ([`backend/api/auth.py`](../backend/api/auth.py)).
- **Admin:** ETL logs and system status endpoints under `/api/admin/*` ([`backend/api/admin.py`](../backend/api/admin.py)).

---

## Related documents

- [Architecture](./02-architecture.md)
- [API](./07-api-and-integrations.md)
