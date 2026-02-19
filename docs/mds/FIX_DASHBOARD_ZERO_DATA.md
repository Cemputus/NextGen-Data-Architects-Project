# Fix Dashboard "No Data Available" Issue

## Problem
Dashboard shows all zeros (0) for all metrics and "No data available" for all charts.

## Solution Steps

### Step 1: Verify Data Exists
✅ **Data is confirmed to exist in the database:**
- 997 students
- 73 high schools
- 437 courses
- 1000 enrollments
- 906 completed exams
- Payment records available

### Step 2: Start Backend Server

**Open a terminal in the `backend` folder and run:**

```powershell
cd "D:\final year project\backend"
.\.venv\Scripts\activate.ps1
python start_server.py
```

**OR if virtual environment is not activated:**

```powershell
cd "D:\final year project\backend"
python start_server.py
```

**You should see:**
```
============================================================
Starting NextGen Data Architects Backend Server
============================================================
Server will be available at: http://localhost:5000
Press Ctrl+C to stop the server
============================================================
```

### Step 3: Verify Backend is Running

**Open another terminal and test the API:**

```powershell
cd "D:\final year project\backend"
python test_dashboard_api.py
```

This will:
1. Test login
2. Test dashboard stats endpoint
3. Test other dashboard endpoints

### Step 4: Check Frontend Connection

1. **Make sure frontend is running:**
   ```powershell
   cd "D:\final year project\frontend"
   npm start
   ```

2. **Clear browser cache and localStorage:**
   - Open browser DevTools (F12)
   - Go to Application tab → Local Storage
   - Clear all entries
   - Refresh the page

3. **Login again:**
   - Use credentials: `senate` / `senate123` (or your admin credentials)
   - Check browser console (F12) for any errors

### Step 5: Check Browser Console

**Open browser DevTools (F12) and check:**
- **Console tab**: Look for JavaScript errors
- **Network tab**: 
  - Check if `/api/dashboard/stats` returns 200 status
  - Check if response has data (not all zeros)
  - Check if Authorization header is present

### Step 6: Common Issues & Fixes

#### Issue 1: Backend Not Running
**Symptom**: Network requests fail with "Connection refused"
**Fix**: Start backend server (Step 2)

#### Issue 2: Authentication Failed
**Symptom**: 401 Unauthorized errors
**Fix**: 
- Clear localStorage
- Login again
- Check JWT token in localStorage

#### Issue 3: CORS Errors
**Symptom**: CORS policy errors in console
**Fix**: Backend should handle CORS, but verify `flask-cors` is installed

#### Issue 4: Filters Too Restrictive
**Symptom**: Data exists but shows 0 with filters applied
**Fix**: 
- Clear all filters
- Reset filters to "All Faculties", "All Departments", etc.

### Step 7: Test Direct API Call

**In browser console, run:**
```javascript
fetch('http://localhost:5000/api/dashboard/stats', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
})
.then(r => r.json())
.then(data => console.log('Dashboard Stats:', data))
.catch(err => console.error('Error:', err));
```

**Expected output:**
```json
{
  "total_students": 997,
  "total_high_schools": 73,
  "avg_retention_rate": <some percentage>,
  "avg_graduation_rate": <some percentage>,
  ...
}
```

### Step 8: If Still Not Working

1. **Check backend logs** for errors
2. **Verify database connection** in `backend/config.py`
3. **Check MySQL is running**
4. **Verify environment variables** are set correctly

## Quick Diagnostic Commands

```powershell
# Check data exists
cd "D:\final year project\backend"
python check_dashboard_data.py

# Test API endpoints
python test_dashboard_api.py

# Check if server is running
curl http://localhost:5000/api/status
```

## Expected Results After Fix

✅ Dashboard should show:
- Total High Schools: **73**
- Total Students: **997**
- Avg Retention Rate: **> 0%**
- Avg Graduation Rate: **> 0%**
- Charts should display data
- All metrics should have values

---

**If you're still seeing zeros after following these steps, share:**
1. Backend server logs
2. Browser console errors
3. Network tab responses
4. Output from `test_dashboard_api.py`


