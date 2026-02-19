# API Endpoint Test Summary

## Quick Test Command
```bash
# Make sure backend server is running first:
python app.py

# Then in another terminal:
python test_apis.py
```

## API Endpoints to Test

### 1. Authentication APIs
- **POST** `/api/auth/login` - User login
  - Test with: `{"identifier": "dean", "password": "dean123"}`
  - Expected: 200 with `access_token` and `user` object

### 2. Dashboard APIs (All require JWT)
- **GET** `/api/dashboard/stats` - Overall dashboard statistics
  - Returns: total_students, total_courses, avg_grade, etc.
  
- **GET** `/api/dashboard/students-by-department` - Student distribution
  - Supports filters: faculty_id, department_id, program_id
  
- **GET** `/api/dashboard/grades-over-time` - Grade trends
  - Supports filters and role-based scoping
  
- **GET** `/api/dashboard/payment-status` - Payment status distribution
  - Role-specific: Dean (faculty), HOD (department), Student (own)
  
- **GET** `/api/dashboard/grade-distribution` - Grade distribution chart
  - Returns: grades array with counts
  
- **GET** `/api/dashboard/top-students` - Top 10 students
  - Role-scoped: Senate (overall), Dean (faculty), HOD (department), Staff (class)
  
- **GET** `/api/dashboard/attendance-trends` - Attendance over time
  - Role-scoped data
  
- **GET** `/api/dashboard/payment-trends` - Payment trends (Finance only)
  
- **GET** `/api/dashboard/student-payment-breakdown` - Student payment details

### 3. Analytics APIs (All require JWT)
- **GET** `/api/analytics/fex` - FEX Analytics ⚠ **FIXED**
  - Returns: `{data: [], summary: {total_fex, total_mex, total_fcw, fex_rate}}`
  - Supports drilldown: overall, faculty, department, program, course
  - **Status**: Fixed to always return summary from simple query
  
- **GET** `/api/analytics/high-school` - High school analytics
  - Enrollment, retention, graduation rates
  
- **GET** `/api/analytics/filter-options` - Get available filter options
  - Supports synced filters (cascading based on parent selection)

### 4. Export APIs (All require JWT)
- **GET** `/api/export/excel` - Export data to Excel
  - Params: type (dashboard/fex), filters
  
- **GET** `/api/export/pdf` - Export data to PDF
  - Params: type, filters

### 5. Predictions APIs (All require JWT)
- **POST** `/api/predictions/student-performance` - Predict student performance
- **POST** `/api/predictions/scenario` - Scenario analysis
- **POST** `/api/predictions/batch` - Batch predictions

## Common Issues to Check

1. **FEX Analytics showing zeros**
   - ✅ Fixed: Summary now calculated from simple query
   - Verify: Check that `fact_grade` has records with `exam_status = 'FEX'`

2. **Login issues**
   - Verify: Token generation, role extraction
   - Check: `backend/api/auth.py` login endpoint

3. **Filter sync not working**
   - Verify: `/api/analytics/filter-options` with parent filter params
   - Check: `build_filter_query` function

4. **Role-based data scoping**
   - Verify: Each role sees only their scope
   - Check: `get_user_scope` function

## Test Results Expected

When backend is running, you should see:
- ✓ Backend Status: Status 200
- ✓ Login: Status 200 with token
- ✓ Dashboard Stats: Status 200 with data
- ✓ FEX Analytics: Status 200 with summary showing FEX counts > 0
- ✓ All other endpoints: Status 200

