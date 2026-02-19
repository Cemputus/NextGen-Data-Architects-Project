# Quick API Check Guide

## Start Backend Server

**Option 1: Using batch file (Windows)**
```bash
cd backend
start_backend.bat
```

**Option 2: Manual start**
```bash
cd backend
.venv\Scripts\activate
python start_server.py
```

**Option 3: Direct Python**
```bash
cd backend
.venv\Scripts\python.exe start_server.py
```

## Test APIs

Once server is running (you'll see "Running on http://0.0.0.0:5000"), run:

```bash
python test_apis.py
```

## Expected Results

✅ **Backend Status**: Should return 200
✅ **Login**: Should return token for dean/dean123
✅ **Dashboard Stats**: Should return student/course counts
✅ **FEX Analytics**: Should return FEX counts > 0 (after ETL run)
✅ **All other endpoints**: Should return 200

## Common Issues

1. **ModuleNotFoundError**: Run `pip install -r requirements.txt` in venv
2. **Port 5000 in use**: Change port in `start_server.py` or kill existing process
3. **MySQL connection error**: Check MySQL is running and credentials in `config.py`

## API Endpoints Summary

- `/api/status` - Health check (no auth)
- `/api/auth/login` - Login (POST)
- `/api/dashboard/stats` - Dashboard stats (JWT required)
- `/api/analytics/fex` - FEX analytics (JWT required)
- `/api/analytics/filter-options` - Filter options (JWT required)
- `/api/dashboard/*` - Various dashboard endpoints (JWT required)

