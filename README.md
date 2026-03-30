# NextGen Analytics Platform

Analytics, BI, and prediction platform for Uganda Christian University (UCU).

## Live deployment

| | URL |
|---|---|
| **Frontend** | [https://nextgen-mis.vercel.app](https://nextgen-mis.vercel.app) |
| **Backend API** | [https://nextgen-mis.onrender.com](https://nextgen-mis.onrender.com) |
| **Database** | Render PostgreSQL (Frankfurt) |

Vercel rewrites `/api/*` to the Render API (`frontend/vercel.json`). JWT access/refresh tokens and idle timeout are documented in [docs/deployment/PRODUCTION_URLS_AND_SESSIONS.md](docs/deployment/PRODUCTION_URLS_AND_SESSIONS.md).

---

## Repository structure

| Area | Purpose |
|------|---------|
| `backend/` | Flask API, ETL pipeline, RBAC, ML models |
| `frontend/` | React 18 SPA — dashboards, analytics, admin |
| `airflow/` | Apache Airflow DAGs for ETL orchestration |
| `docs/` | Deployment guides and architecture docs |
| `render.yaml` | Render Blueprint for one-click deploy |
| `docker-compose.yml` | Local stack (Postgres, backend, frontend, Airflow) |

---

## Architecture

```
React SPA (Vercel)
       │
       ▼
Flask API (Render) — JWT + RBAC
       │
       ▼
PostgreSQL (Render managed DB)
       ▲
       │
ETL Pipeline (CSV/XLSX → medallion layers → warehouse)
```

### Backend structure

```
backend/
├── app.py                  Flask entry point, dashboard routes, KPI cache
├── api/
│   ├── auth.py             Authentication (login, logout, refresh, profile)
│   ├── analytics.py        Analytics endpoints (FEX, high-school, risk, HR)
│   ├── admin.py            Admin console (ETL, audit logs, settings)
│   ├── dashboards.py       Dashboard builder (role/user assignments)
│   ├── predictions.py      ML prediction endpoints
│   ├── export.py           Data export (Excel, CSV)
│   ├── hod.py              Head of Department endpoints
│   ├── hr.py               HR endpoints (leave, payroll, staff)
│   ├── user_mgmt.py        User management (CRUD, faculties, departments)
│   └── nextgen_query.py    Analyst SQL workspace
├── config/
│   ├── connection.py       Database connection strings and env config
│   ├── constants.py        RBAC roles, KPI/chart IDs
│   └── academic.py         Academic calendar
├── etl_pipeline.py         Medallion ETL (bronze → silver → gold → warehouse)
├── ml_models.py            Prediction model classes
├── db_engines.py           SQLAlchemy engine pool
├── cache.py                In-memory TTL cache
└── audit_log.py            Audit event logger
```

---

## Roles

| Role | Access |
|------|--------|
| `sysadmin` | Full access, user management |
| `analyst` | All analytics, SQL workspace, dashboard builder |
| `dean` | Faculty-scoped dashboards and analytics |
| `hod` | Department-scoped dashboards, staff assignments |
| `staff` | Course-assigned student data only |
| `hr` | HR analytics, staff list, leave management |
| `finance` | Finance dashboards and payment analytics |
| `senate` | Institutional-level read-only dashboards |
| `student` | Own academic record only |

---

## Quick start (local)

**Prerequisites:** Python 3.11+, Node 18+, PostgreSQL 14+

```bash
# Backend
cd backend
pip install -r requirements.txt
python setup_databases.py      # create schemas
python etl_pipeline.py         # load warehouse
python app.py                  # http://localhost:5000

# Frontend
cd frontend
npm install
npm start                      # http://localhost:3000
```

**Default credentials** (after `setup_databases.py`):

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | sysadmin |
| `analyst` | `analyst123` | analyst |
| `hr` | `hr123` | hr |
| `finance` | `finance123` | finance |

---

## Deploy to Render

See [docs/deployment/RENDER_DEPLOYMENT.md](docs/deployment/RENDER_DEPLOYMENT.md).

Environment variables required on Render:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Auto-injected from Render PostgreSQL |
| `SECRET_KEY` | Auto-generated |
| `JWT_SECRET_KEY` | Auto-generated |
| `FRONTEND_URL` | `https://nextgen-mis.vercel.app` |

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Render deployment](docs/deployment/RENDER_DEPLOYMENT.md)
- [Running backend locally](docs/backend/RUNNING.md)
- [Production URLs and sessions](docs/deployment/PRODUCTION_URLS_AND_SESSIONS.md)
- [Login credentials](docs/mds/LOGIN_CREDENTIALS.md)

---

## Contributors

Emmanuel Nsubuga and the NextGen Data Architects team.
