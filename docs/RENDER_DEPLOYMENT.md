# Deploy NextGen Data Architects to Render

Step-by-step guide to deploy the **backend** and all related services (PostgreSQL, optional Airflow, frontend) on [Render](https://render.com).

**Quick option:** Use the **Blueprint** (`render.yaml` in the repo root): in Render Dashboard go to **Blueprints** → **New Blueprint Instance** → connect your repo and apply. Then set `REACT_APP_API_URL` on the frontend service to your backend URL (e.g. `https://nextgen-backend.onrender.com`). See [Step 7: Using a Blueprint](#step-7-using-a-blueprint-renderyaml) below.

---

## Overview

| Service | Render type | Purpose |
|--------|-------------|--------|
| **PostgreSQL** | Managed PostgreSQL | Warehouse DB, source DBs, RBAC, Airflow metadata |
| **Backend** | Web Service (Docker or Native) | Flask API + ETL entrypoints |
| **Frontend** | Static Site or Web Service | React SPA |
| **Airflow** (optional) | Web Service (Docker) | ETL orchestration; can be skipped and use Render Cron instead |

---

## Prerequisites

- [Render account](https://dashboard.render.com/register)
- Code in a **GitHub** or **GitLab** repo (Render deploys from Git)
- (Optional) [Render CLI](https://render.com/docs/cli) for `render.yaml` blueprints

---

## Step 1: Create a PostgreSQL Database

1. In [Render Dashboard](https://dashboard.render.com) → **New +** → **PostgreSQL**.
2. **Name**: e.g. `nextgen-db`.
3. **Region**: Choose closest to your users.
4. **Plan**: Free (dev) or Starter/Standard (production).
5. Click **Create Database**.
6. Wait until **Available**. Then:
   - Copy the **Internal Database URL** (use this for Backend and Airflow from the same Render account).
   - Copy the **External Database URL** only if you need to connect from your laptop (e.g. migrations).

**Create extra databases (optional):**  
Render gives one database per instance. Your app expects multiple DBs (`ucu_datawarehouse`, `ucu_rbac`, `ucu_sourcedb1`, `ucu_sourcedb2`). Two options:

- **A) Let the app create them:**  
  Connect the backend using the **default** database in the Internal URL (often `nextgen_db` or the name you gave). The backend and ETL call `ensure_database()` and will create `ucu_datawarehouse`, `ucu_rbac`, etc., on first run. Use the same Internal URL and only change the path when your code explicitly uses a different DB name.

- **B) Create DBs manually:**  
  From **Shell** (or `psql` via External URL), run:
  ```sql
  CREATE DATABASE ucu_datawarehouse;
  CREATE DATABASE ucu_rbac;
  CREATE DATABASE ucu_sourcedb1;
  CREATE DATABASE ucu_sourcedb2;
  ```
  If you use Airflow, also:
  ```sql
  CREATE DATABASE airflow_meta;
  ```
  Then in the backend, point `PG_HOST` etc. to the same instance; the app uses the same host with different `dbname`.

**Note:** Render’s free Postgres has one database; creating more may require a paid plan or using schemas in one DB. The app creates `ucu_datawarehouse`, `ucu_rbac`, etc., on first run via `ensure_database()` when connected to the same instance (same host/user/password). The backend supports **`DATABASE_URL`** (e.g. from Render’s “Link PostgreSQL” or Blueprint `fromDatabase.connectionString`); when set, it overrides `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD` so you only need one env var.

---

## Step 2: Deploy the Backend (Web Service)

1. **New +** → **Web Service**.
2. **Connect** your repo (e.g. GitHub) and select the `NextGen-Data-Architects-Project` repo.
3. **Configure:**
   - **Name**: e.g. `nextgen-backend`.
   - **Region**: Same as the database.
   - **Branch**: `main` (or your default).
   - **Root Directory**: leave empty (repo root).
   - **Runtime**: **Docker**.
   - **Dockerfile Path**: `backend/Dockerfile`.
   - **Docker Context**: leave empty or `backend` if you set Dockerfile path to `Dockerfile` and root to `backend`.
   - **Instance Type**: Free or Starter.

4. **Environment variables** (use **Internal** URL from Step 1):

   | Key | Value |
   |-----|--------|
   | `PG_HOST` | From Internal URL host (e.g. `dpg-xxx-a.oregon-postgres.render.com`) |
   | `PG_PORT` | `5432` (or from URL) |
   | `PG_USER` | User from Internal URL |
   | `PG_PASSWORD` | Password from Internal URL |
   | `SECRET_KEY` | Long random string (e.g. `openssl rand -hex 32`) |
   | `JWT_SECRET_KEY` | Another long random string |
   | `PYTHONUNBUFFERED` | `1` |

   **If using Render’s “Link PostgreSQL”:**  
   Render can inject `DATABASE_URL`. Your app uses `PG_*`. Add a **Pre-Deploy** or **Start Command** that exports `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD` from `DATABASE_URL`, or set them manually from the Internal URL.

5. **Build & Deploy:**
   - **Build Command**: (leave empty for Docker; Dockerfile handles it).
   - **Start Command**: (leave empty; image uses `gunicorn ... app:app`).

6. **Health Check (optional):**  
   Path: `/api/health` or `/api/user-mgmt/ping` if you have it. Render will mark the service healthy.

7. Click **Create Web Service**. Note the URL, e.g. `https://nextgen-backend.onrender.com`.

---

## Step 3: Deploy the Frontend

You can deploy as a **Static Site** (recommended) or as a **Web Service**.

### Option A: Static Site (recommended)

1. **New +** → **Static Site**.
2. **Connect** the same repo.
3. **Configure:**
   - **Name**: e.g. `nextgen-frontend`.
   - **Branch**: `main`.
   - **Root Directory**: `frontend`.
   - **Build Command**: `npm install && npm run build`.
   - **Publish Directory**: `build` (Create React App output).

4. **Environment (build-time):**
   - `REACT_APP_API_URL` = `https://nextgen-backend.onrender.com` (your backend URL from Step 2).  
   This sets `axios.defaults.baseURL` so all `/api/...` requests go to the backend.

5. **Create Static Site**. Use the given URL, e.g. `https://nextgen-frontend.onrender.com`.

### Option B: Web Service (Node server)

If you prefer to run `npm start` or a small Node server:

1. **New +** → **Web Service**.
2. **Root Directory**: `frontend`.
3. **Runtime**: Node.
4. **Build**: `npm install`.
5. **Start**: `npm run build && npx serve -s build -l 3000` (or your server).
6. Set `REACT_APP_API_URL` to the backend URL.

---

## Step 4: CORS and Security

- In the **Backend** service, ensure Flask-CORS allows your frontend origin, e.g. `https://nextgen-frontend.onrender.com`.  
  If you use `cors_origins` in code, add this origin; if you use a wildcard in dev, restrict it for production.
- Use strong `SECRET_KEY` and `JWT_SECRET_KEY`; never commit them.

---

## Step 5: Airflow (Optional)

If you want the full Airflow UI and DAGs on Render:

1. **New +** → **Web Service**.
2. **Runtime**: Docker.
3. **Dockerfile**: Create one in the repo (e.g. `airflow/Dockerfile`) that:
   - Uses `apache/airflow` image.
   - Sets `AIRFLOW__DATABASE__SQL_ALCHEMY_CONN` to a dedicated **Postgres DB** on the same Render instance (e.g. `airflow_meta`).
   - Mounts or copies `airflow/dags` into the image.
   - Runs both scheduler and webserver (e.g. in one Dockerfile with a script that starts both), or run two services (one scheduler, one webserver).

4. **Environment**: Same `PG_*` host/user/password; database name `airflow_meta`.  
5. **Internal URL**: Use Render’s Internal Database URL with `?options=-c%20search_path=airflow` if needed.

**Simpler alternative:**  
Skip Airflow on Render and use **Render Cron Jobs** to call your backend’s ETL endpoint on a schedule (e.g. `curl -X POST https://nextgen-backend.onrender.com/api/admin/run-etl` with auth). That way only the backend and DB need to run.

---

## Step 6: First-Time Setup After Deploy

1. **Backend:**  
   If you didn’t create DBs manually, trigger a one-off ETL or a setup script so the backend creates `ucu_datawarehouse`, `ucu_rbac`, etc., via `ensure_database()`. You can do this by:
   - Calling your ETL endpoint once (e.g. from Admin UI after login), or
   - Running a **one-off Shell** or **Background Worker** that executes `python -m etl_pipeline` or `python -m setup_databases` with the same env as the Web Service.

2. **Frontend:**  
   Open the static site URL and log in. Ensure `REACT_APP_API_URL` was set at build time so API calls hit the backend.

3. **Airflow (if used):**  
   Open the Airflow URL, log in (admin user created in Dockerfile or init), and unpause the `etl_auto_scheduler` DAG if you use it.

---

## Step 7: Using a Blueprint (`render.yaml`)

You can define services in a **Blueprint** so Render creates them from one place.

1. In the repo root, add `render.yaml` (see the included `render.yaml` in this repo).
2. In Render Dashboard → **Blueprints** → **New Blueprint Instance** → connect repo and select `render.yaml`.
3. Render will create PostgreSQL (if defined), Backend, and Frontend from the spec. Adjust **Environment** variables to match your secrets and DB URLs.

---

## Environment Variables Summary

**Backend (Web Service)**

| Variable | Example / Note |
|---------|-----------------|
| `PG_HOST` | From Render Postgres Internal URL |
| `PG_PORT` | `5432` |
| `PG_USER` | From Internal URL |
| `PG_PASSWORD` | From Internal URL |
| `SECRET_KEY` | Random string |
| `JWT_SECRET_KEY` | Random string |
| `PYTHONUNBUFFERED` | `1` |

**Frontend (Static Site build)**

| Variable | Example / Note |
|----------|-----------------|
| `REACT_APP_API_URL` | `https://nextgen-backend.onrender.com` |

---

## Troubleshooting

- **502 / Backend not responding:** Check Render logs; ensure `gunicorn` starts and listens on `0.0.0.0:5000`. Render assigns `PORT`; you can use `PORT=${PORT:-5000}` in start command if you switch to it.
- **DB connection refused:** Use the **Internal** Database URL (and correct host/port/user/password). Ensure the Backend and DB are in the same region and the DB is **Available**.
- **Frontend calls 404:** Confirm `REACT_APP_API_URL` was set at **build** time and matches the backend URL. Rebuild the Static Site after changing it.
- **ETL / Airflow:** If you don’t deploy Airflow, disable the “Run ETL automatically” or rely on Render Cron calling your backend ETL endpoint; the in-app timer is disabled when not using the Flask scheduler.

---

## Quick Checklist

- [ ] PostgreSQL created; Internal URL noted.
- [ ] Backend Web Service created with Dockerfile `backend/Dockerfile`; env vars set (PG_*, SECRET_KEY, JWT_SECRET_KEY).
- [ ] Frontend Static Site (or Web Service) with `REACT_APP_API_URL` pointing to backend.
- [ ] CORS on backend allows frontend origin.
- [ ] First ETL or DB setup run so warehouse (and optional source/RBAC DBs) exist.
- [ ] (Optional) Airflow or Render Cron configured for scheduled ETL.
