-- Source Database 2: ucu_sourcedb2 (ADMINISTRATION DATABASE)
-- PostgreSQL version

CREATE TABLE IF NOT EXISTS positions (
    PositionID SERIAL PRIMARY KEY,
    PositionTitle VARCHAR(200),
    DepartmentID INT,
    SalaryScale DECIMAL(15,2)
);
CREATE INDEX IF NOT EXISTS idx_positions_department ON positions(DepartmentID);

CREATE TABLE IF NOT EXISTS employees (
    EmployeeID SERIAL PRIMARY KEY,
    FullName VARCHAR(100),
    PositionID INT,
    DepartmentID INT,
    ContractType VARCHAR(50),
    Status VARCHAR(50),
    FOREIGN KEY (PositionID) REFERENCES positions(PositionID) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_employees_position ON employees(PositionID);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(DepartmentID);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(Status);

CREATE TABLE IF NOT EXISTS contracts (
    ContractID SERIAL PRIMARY KEY,
    EmployeeID INT,
    StartDate DATE,
    EndDate DATE,
    Status VARCHAR(50),
    FOREIGN KEY (EmployeeID) REFERENCES employees(EmployeeID) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_contracts_employee ON contracts(EmployeeID);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(Status);

CREATE TABLE IF NOT EXISTS employee_attendance (
    AttendanceID SERIAL PRIMARY KEY,
    EmployeeID INT,
    Date DATE,
    Status VARCHAR(20),
    FOREIGN KEY (EmployeeID) REFERENCES employees(EmployeeID) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_emp_attendance_employee ON employee_attendance(EmployeeID);
CREATE INDEX IF NOT EXISTS idx_emp_attendance_date ON employee_attendance(Date);

CREATE TABLE IF NOT EXISTS payroll (
    PayrollID SERIAL PRIMARY KEY,
    EmployeeID INT,
    PayPeriod VARCHAR(20),
    NetPay DECIMAL(15,2),
    FOREIGN KEY (EmployeeID) REFERENCES employees(EmployeeID) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_payroll_employee ON payroll(EmployeeID);
CREATE INDEX IF NOT EXISTS idx_payroll_pay_period ON payroll(PayPeriod);

CREATE TABLE IF NOT EXISTS assets (
    AssetID SERIAL PRIMARY KEY,
    AssetName VARCHAR(200),
    AssetTag VARCHAR(50),
    AssignedTo INT,
    Status VARCHAR(50),
    FOREIGN KEY (AssignedTo) REFERENCES employees(EmployeeID) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_assets_assigned_to ON assets(AssignedTo);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(Status);
CREATE INDEX IF NOT EXISTS idx_assets_tag ON assets(AssetTag);

CREATE TABLE IF NOT EXISTS suppliers (
    SupplierID SERIAL PRIMARY KEY,
    SupplierName VARCHAR(200),
    ContactPerson VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(SupplierName);

CREATE TABLE IF NOT EXISTS purchase_orders (
    OrderID SERIAL PRIMARY KEY,
    SupplierID INT,
    OrderNumber VARCHAR(50),
    Status VARCHAR(50),
    FOREIGN KEY (SupplierID) REFERENCES suppliers(SupplierID) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(SupplierID);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_number ON purchase_orders(OrderNumber);

CREATE TABLE IF NOT EXISTS maintenance_records (
    MaintenanceID SERIAL PRIMARY KEY,
    AssetID INT,
    Date DATE,
    Cost DECIMAL(15,2),
    FOREIGN KEY (AssetID) REFERENCES assets(AssetID) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_maintenance_asset ON maintenance_records(AssetID);
CREATE INDEX IF NOT EXISTS idx_maintenance_date ON maintenance_records(Date);
