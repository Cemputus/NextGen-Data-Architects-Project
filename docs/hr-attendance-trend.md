# HR Attendance trend (`employee_attendance_trend`)

## What the graph uses

- API field: `employee_attendance_trend` from `GET /api/analytics/hr`.
- **Primary data:** `ucu_sourcedb2.employee_attendance` (mirrored/seeded from dims when possible).
- **Fallback:** If that table is missing or returns no rows, the API **builds the same JSON shape from `dim_employee`**: for each weekday it assigns each employee in scope a synthetic status (Present / Absent / Late / On Leave) with fixed weights and a stable RNG seed, so the stacked chart and `present_rate` still work without administration tables.
- **Attendance rate** KPI and **`attendance_by_role`** follow the same source (administration when present, else synthetic from dims). Faculty/department filters apply; employee-role filter does not apply to the trend.
- Warehouse table: `ucu_sourcedb2.employee_attendance` (status values: `Present`, `Absent`, `Late`, `On Leave`).
- Joins: `employee_attendance` → `ucu_sourcedb2.employees` → `ucu_sourcedb1.departments` → `ucu_sourcedb1.faculties` so **faculty/department filters** match the same IDs as `dim_faculty` / `dim_department`.

## How data stays aligned with the rest of the warehouse

1. **Faculties & departments** are copied from `dim_faculty` and `dim_department` (same `faculty_id` / `department_id` as everywhere else).
2. **Employees** are copied only from `dim_employee` rows whose `department_id` exists in `dim_department` and whose faculty chain exists in `dim_faculty`. Orphan `dim_employee` rows are skipped and counted in ETL logs (`dim_employees_excluded_orphans`).
3. **Dates** for the daily series end at the latest meaningful warehouse date when possible: `MAX(dim_time.date)`, then fact tables’ `date_key`, otherwise **today**. The window is the last **N** weekdays (default **65**) ending at that date.
4. **ETL order**: the mirror runs **after** `dim_time` and **facts** are loaded so the end date can reflect real fact dates in the same run.

## Regenerating data

- Full pipeline: `cd backend && python etl_pipeline.py`
- Mirror only: `cd backend && python -m hr_warehouse_mirror`
- Disable: set `SKIP_HR_ADMIN_MIRROR=1`.

The first HR dashboard request also calls `ensure_hr_admin_mirror_for_attendance` if attendance is empty but dims have staff.

## Payroll by role (`payroll_by_role`)

- **Primary data:** `ucu_sourcedb2.payroll` joined to employees/positions (legacy HR path), same faculty/department/role filters as other HR aggregates.
- **Fallback:** If the payroll query returns no rows (or the table is missing), the API fills **`payroll_by_role`** and **`total_payroll`** with **estimated monthly net pay per employee** from `dim_employee` (warehouse path) or from mirror `employees` + `positions` (legacy path), using the same role buckets as administration SQL (Senate, Dean, HOD, Lecturer, etc.). The HR dashboard shows a **3D-style full pie chart** (`Sci3DFullPieChart` + `MODERN_CHART_PALETTE`) of total net pay by `role_category`.
