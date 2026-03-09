# Fix Database Access Denied Error

## Problem
You're seeing: `FATAL: password authentication failed for user "postgres"`

## Solution

The connection test passed, which means your credentials are correct. The issue is that **your backend server needs to be restarted** to pick up the correct database credentials.

### Step 1: Stop the Backend Server

If the backend server is running:
- **Find the terminal/command prompt** where the backend is running
- Press `Ctrl+C` to stop it
- Wait for it to fully stop

### Step 2: Verify Your Credentials

Run this to verify your database connection:
```powershell
cd backend
.\.venv\Scripts\activate
python test_scripts\test_db_connection.py
```

You should see: `✓ All connection tests passed!`

### Step 3: Restart the Backend Server

**Option A: Using the batch file (Windows)**
```powershell
cd backend
.\start_backend.bat
```

**Option B: Manual start**
```powershell
cd backend
.\.venv\Scripts\activate
python start_server.py
```

**Option C: Direct Python**
```powershell
cd backend
.\.venv\Scripts\python.exe start_server.py
```

### Step 4: Verify the Server Started Correctly

You should see:
```
Starting NextGen Data Architects Backend Server
Server will be available at: http://localhost:5000
 * Running on http://0.0.0.0:5000
```

### Step 5: Test the Dashboard

1. Open your browser
2. Go to `http://localhost:3000` (or your frontend URL)
3. Log in as Senate user
4. Navigate to the Senate Dashboard
5. The "No data available" error should be resolved

## If It Still Doesn't Work

### Check Environment Variables

The backend reads credentials from environment variables. Make sure they're set:

**Windows PowerShell:**
```powershell
$env:PG_USER='postgres'
$env:PG_PASSWORD='your_password'
```

**Windows CMD:**
```cmd
set PG_USER=postgres
set PG_PASSWORD=your_password
```

**Or edit `backend/config.py` directly:**
```python
PG_USER = 'postgres'
PG_PASSWORD = 'your_actual_password'  # Change this
```

### Verify PostgreSQL is Running

1. If using Docker: `docker-compose ps` should show postgres service running
2. If local install: try connecting with `psql -U postgres`
3. If that works, use the same password in your config

### Check Connection Settings

Make sure you're connecting to the correct PostgreSQL instance:
- Check `PG_HOST` in `config.py` (should be `localhost` or `127.0.0.1`)
- Check `PG_PORT` (default is `5432`)

## Quick Test

After restarting, test the API:
```powershell
python test_dashboard_api.py
```

This will test the dashboard endpoints and show if the connection is working.
