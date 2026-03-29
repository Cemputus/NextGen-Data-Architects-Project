# 02 — Logical Architecture

## Technology stack (as implemented)

| Layer | Technology | Location |
|-------|------------|----------|
| **Presentation** | React (SPA), React Router | `frontend/` |
| **API** | Flask, Flask-JWT-Extended, CORS | `backend/app.py`, `backend/api/*.py` |
| **Business logic** | RBAC, analytics queries, ML predictors, ETL helpers | `backend/rbac.py`, `backend/api/`, `backend/ml_models.py`, `backend/enhanced_predictions.py`, `backend/etl_pipeline.py` |
| **Data** | PostgreSQL (warehouse + RBAC DB) | `config/connection.py`, `backend/sql/` |

*The repository README describes the stack as Flask + React + PostgreSQL; there is no FastAPI service in this project.*

## Logical architecture

```mermaid
flowchart TB
    subgraph Presentation["Presentation layer"]
        UI[React SPA\nRoutes per role]
    end

    subgraph API["API layer — Flask"]
        AUTH[auth_bp /api/auth]
        AN[analytics_bp /api/analytics]
        PR[predictions_bp /api/predictions]
        AD[admin_bp /api/admin]
        DB[dashboards_bp /api/dashboards]
        Q[nextgen_query_bp /api/query]
        EX[export_bp /api/export]
        HOD[hod_bp /api/hod]
    end

    subgraph Services["Services & engines"]
        RBAC[RBAC has_permission]
        ML[MultiModelPredictor\nEnhancedPredictor]
        ETL[ETL pipeline / Airflow DAGs]
    end

    subgraph Data["Data layer"]
        WH[(ucu_datawarehouse\nstar schema)]
        RB[(ucu_rbac\napp_users, audit)]
    end

    UI -->|HTTPS + JWT| AUTH
    UI --> AN
    UI --> PR
    UI --> AD
    UI --> DB
    UI --> Q
    UI --> EX
    UI --> HOD

    AUTH --> RB
    AN --> RBAC
    AN --> WH
    PR --> RBAC
    PR --> WH
    PR --> ML
    AD --> RB
    AD --> WH
    DB --> WH
    Q --> WH
    ETL --> WH
```

## Major components

| Component | Responsibility |
|-----------|----------------|
| **Auth blueprint** | Login, refresh, profile; issues JWT claims including `role`, `student_id`, `faculty_id`, `department_id` where applicable. |
| **Analytics blueprint** | Faculty/department/student/analytics endpoints; filter options; HR mirror queries where configured. |
| **Predictions blueprint** | Standard ML models + tuition–attendance model; scenario analysis; batch predict. |
| **Admin blueprint** | User management, ETL triggers, system status, audit exposure. |
| **Dashboards blueprint** | Role-configurable dashboard pages and shared chart management. |
| **NextGen Query** | Analyst SQL workspace against the warehouse (with safeguards). |
| **Export** | Data export for permitted roles. |

## Deployment architecture

Aligned with [`render.yaml`](../render.yaml) and [README production section](../README.md):

```mermaid
flowchart LR
    subgraph Clients["Clients"]
        B[Browser]
    end

    subgraph Vercel["Vercel SPA (optional)"]
        SPA[React build]
    end

    subgraph Render["Render"]
        API[Docker: Flask backend]
        ST[Static site service OR SPA from render.yaml]
        PG[(PostgreSQL nextgen-db)]
    end

    B --> SPA
    B --> API
    SPA -->|"/api/* proxy"| API
    API --> PG
```

**Environment highlights (Render):** `DATABASE_URL`, `JWT_SECRET_KEY`, `SECRET_KEY`, `FRONTEND_URL`, `DISABLE_SESSION_EXPIRY` — see `render.yaml` and deployment docs.

## Related documents

- [System context](./01-system-context.md)
- [Operations & NFRs](./08-operations-nfrs.md)
- [API map](./07-api-and-integrations.md)
