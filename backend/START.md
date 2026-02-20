# Running the backend

Backend runs at **http://localhost:5000**. The frontend expects this URL.

## Easiest (Windows)

Double-click **run_backend.bat** (in the `backend` folder, or the one in project root).  
It creates venv and installs deps on first run, then starts the server.

## Manual

**Windows:** `cd backend` → `venv\Scripts\activate` → `python start_server.py`  
**Mac/Linux:** `cd backend` → `source venv/bin/activate` → `python start_server.py`

First time? Create venv: `python -m venv venv`. Then: `pip install -r requirements.txt`
