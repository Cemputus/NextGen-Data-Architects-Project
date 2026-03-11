# Project structure

High-level layout of the repository for development and deployment.

```
NextGen-Data-Architects-Project/
├── README.md                 # Project overview, quick start, architecture
├── PROJECT_STRUCTURE.md      # This file
├── .gitignore
├── docker-compose.yml       # Local/CI: Postgres, backend, frontend, Airflow
├── render.yaml              # Render Blueprint: DB, backend, frontend
│
├── backend/                 # Flask API, ETL, RBAC, dashboards
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── config.py            # Env-based config (PG_*, DATABASE_URL, secrets)
│   ├── app.py               # Flask app, routes, ETL trigger
│   ├── etl_pipeline.py      # Medallion ETL (Bronze → Silver → Gold)
│   ├── api/                 # Blueprints: admin, auth, dashboards, analytics, etc.
│   ├── sql/                 # DDL and reference SQL
│   ├── scripts/             # One-off and utility scripts
│   ├── Check_Scripts/       # Data and system checks
│   ├── verify_Scripts/      # Data verification
│   ├── test_scripts/        # API and integration tests
│   ├── etl_seeds/           # Versioned seeds (user snapshot, admin settings)
│   ├── data/                # Runtime data (Synthetic_Data, bronze/silver/gold, admin_settings.json)
│   └── logs/                # ETL run logs (gitignored; created at runtime)
│
├── frontend/                # React SPA (Create React App)
│   ├── Dockerfile
│   ├── package.json
│   ├── public/
│   └── src/
│       ├── components/     # Shared UI (Layout, Charts, admin, ui)
│       ├── pages/          # Role-specific and shared pages
│       ├── context/        # Auth, theme, toast
│       ├── hooks/
│       └── utils/
│
├── airflow/                 # Apache Airflow (ETL orchestration)
│   ├── airflow.cfg
│   ├── webserver_config.py
│   └── dags/
│       ├── etl_auto_scheduler.py   # Scheduled ETL (respects admin “Run automatically”)
│       └── etl_manual_run.py       # Manual ETL trigger from Admin UI
│
└── docs/                    # All project documentation
    ├── README.md            # Doc index (start here)
    ├── deployment/          # Render and other deployment guides
    ├── operations/          # Ops runbooks (e.g. password reset)
    ├── backend/             # Backend runbooks and API notes
    ├── frontend/            # UI/UX and migration docs
    └── mds/                 # Historical and reference markdown
```

## Key paths for deployment

| Purpose | Path |
|--------|------|
| Backend Docker image | `backend/Dockerfile` |
| Backend start (Gunicorn) | `backend/` → `gunicorn ... app:app` |
| Frontend build | `frontend/` → `npm run build` → `build/` |
| Airflow DAGs | `airflow/dags/` |
| Render Blueprint | `render.yaml` (root) |
| Deployment guide | `docs/deployment/RENDER_DEPLOYMENT.md` |

## What not to commit

- Secrets (`.env`, `config_local.py`, `secrets.json`).
- Build artifacts (`frontend/node_modules/`, `frontend/build/`, `*.pyc`, `__pycache__/`).
- Runtime logs and ETL trace files (`backend/logs/`, `backend/etl_*.txt`, root `stats*.txt`, `ps*.txt`).
- Large or generated data (`*.parquet`, `*.pkl`) unless required for reproducibility.

See `.gitignore` for the full list.
