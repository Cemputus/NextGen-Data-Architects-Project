-- HR administration mirror on ucu_datawarehouse (schemas ucu_sourcedb1 / ucu_sourcedb2).
-- Keeps PascalCase column names expected by backend/api/analytics.py HR queries.
-- Applied by hr_warehouse_mirror.py (ETL or: python -m hr_warehouse_mirror).

CREATE SCHEMA IF NOT EXISTS ucu_sourcedb1;
CREATE SCHEMA IF NOT EXISTS ucu_sourcedb2;

CREATE TABLE IF NOT EXISTS ucu_sourcedb1.faculties (
    "FacultyID" INT PRIMARY KEY,
    "FacultyName" VARCHAR(200),
    "DeanName" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS ucu_sourcedb1.departments (
    "DepartmentID" INT PRIMARY KEY,
    "DepartmentName" VARCHAR(200),
    "FacultyID" INT NOT NULL REFERENCES ucu_sourcedb1.faculties ("FacultyID") ON DELETE CASCADE,
    "HeadOfDepartment" VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS idx_hr_dept_faculty ON ucu_sourcedb1.departments ("FacultyID");

CREATE TABLE IF NOT EXISTS ucu_sourcedb2.positions (
    "PositionID" INT PRIMARY KEY,
    "PositionTitle" VARCHAR(200),
    "DepartmentID" INT,
    "SalaryScale" DECIMAL(15, 2)
);

CREATE TABLE IF NOT EXISTS ucu_sourcedb2.employees (
    "EmployeeID" INT PRIMARY KEY,
    "FullName" VARCHAR(200),
    "PositionID" INT NOT NULL REFERENCES ucu_sourcedb2.positions ("PositionID") ON DELETE CASCADE,
    "DepartmentID" INT NOT NULL,
    "ContractType" VARCHAR(50),
    "Status" VARCHAR(50)
);
CREATE INDEX IF NOT EXISTS idx_hr_emp_dept ON ucu_sourcedb2.employees ("DepartmentID");
CREATE INDEX IF NOT EXISTS idx_hr_emp_position ON ucu_sourcedb2.employees ("PositionID");

CREATE TABLE IF NOT EXISTS ucu_sourcedb2.employee_attendance (
    "AttendanceID" SERIAL PRIMARY KEY,
    "EmployeeID" INT NOT NULL REFERENCES ucu_sourcedb2.employees ("EmployeeID") ON DELETE CASCADE,
    "Date" DATE NOT NULL,
    "Status" VARCHAR(20) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hr_att_date ON ucu_sourcedb2.employee_attendance ("Date");
CREATE INDEX IF NOT EXISTS idx_hr_att_emp ON ucu_sourcedb2.employee_attendance ("EmployeeID");
