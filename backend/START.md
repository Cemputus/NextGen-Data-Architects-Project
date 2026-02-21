# Running the backend

Backend runs at **http://localhost:5000**. The frontend expects this URL.

## Easiest (Windows)

Double-click **run_backend.bat** (in the `backend` folder, or the one in project root).  
It creates venv and installs deps on first run, then starts the server.

## Manual

**Windows:** `cd backend` → `venv\Scripts\activate` → `python start_server.py`  
**Mac/Linux:** `cd backend` → `source venv/bin/activate` → `python start_server.py`

First time? Create venv: `python -m venv venv`. Then: `pip install -r requirements.txt`

## Script folders

Utility scripts are grouped under `backend`:

- **Check_Scripts** — Data and system checks (e.g. `check_databases.py`, `check_fex_data.py`, `system_check.py`).  
  Run from backend: `python Check_Scripts/check_databases.py` (or from `Check_Scripts`: `python check_databases.py`).
- **test_scripts** — API and query tests (e.g. `test_apis.py`, `test_all_logins.py`, `test_db_connection.py`).  
  Run from backend: `python test_scripts/test_apis.py` (or from `test_scripts`: `python test_apis.py`).
- **verify_Scripts** — Data verification (e.g. `verify_data.py`, `verify_fex_data.py`).  
  Run from backend: `python verify_Scripts/verify_data.py` (or from `verify_Scripts`: `python verify_data.py`).
