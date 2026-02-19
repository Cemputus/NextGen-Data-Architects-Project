-- Source Database 2: UCU_SourceDB2 (ADMINISTRATION DATABASE)
-- Contains: Employees, Positions, Contracts, Employee Attendance, Payroll, Assets, Suppliers, Purchase Orders, Maintenance Records

CREATE DATABASE IF NOT EXISTS UCU_SourceDB2;
USE UCU_SourceDB2;

-- Positions Table (must be created before Employees)
CREATE TABLE IF NOT EXISTS positions (
    PositionID INT PRIMARY KEY AUTO_INCREMENT,
    PositionTitle VARCHAR(200),
    DepartmentID INT,
    SalaryScale DECIMAL(15,2),
    INDEX idx_department (DepartmentID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Employees Table
CREATE TABLE IF NOT EXISTS employees (
    EmployeeID INT PRIMARY KEY AUTO_INCREMENT,
    FullName VARCHAR(100),
    PositionID INT,
    DepartmentID INT,
    ContractType VARCHAR(50),
    Status VARCHAR(50),
    FOREIGN KEY (PositionID) REFERENCES positions(PositionID) ON DELETE CASCADE,
    INDEX idx_position (PositionID),
    INDEX idx_department (DepartmentID),
    INDEX idx_status (Status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contracts Table
CREATE TABLE IF NOT EXISTS contracts (
    ContractID INT PRIMARY KEY AUTO_INCREMENT,
    EmployeeID INT,
    StartDate DATE,
    EndDate DATE,
    Status VARCHAR(50),
    FOREIGN KEY (EmployeeID) REFERENCES employees(EmployeeID) ON DELETE CASCADE,
    INDEX idx_employee (EmployeeID),
    INDEX idx_status (Status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Employee Attendance Table
CREATE TABLE IF NOT EXISTS employee_attendance (
    AttendanceID INT PRIMARY KEY AUTO_INCREMENT,
    EmployeeID INT,
    Date DATE,
    Status VARCHAR(20),
    FOREIGN KEY (EmployeeID) REFERENCES employees(EmployeeID) ON DELETE CASCADE,
    INDEX idx_employee (EmployeeID),
    INDEX idx_date (Date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payroll Table
CREATE TABLE IF NOT EXISTS payroll (
    PayrollID INT PRIMARY KEY AUTO_INCREMENT,
    EmployeeID INT,
    PayPeriod VARCHAR(20),
    NetPay DECIMAL(15,2),
    FOREIGN KEY (EmployeeID) REFERENCES employees(EmployeeID) ON DELETE CASCADE,
    INDEX idx_employee (EmployeeID),
    INDEX idx_pay_period (PayPeriod)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Assets Table
CREATE TABLE IF NOT EXISTS assets (
    AssetID INT PRIMARY KEY AUTO_INCREMENT,
    AssetName VARCHAR(200),
    AssetTag VARCHAR(50),
    AssignedTo INT,
    Status VARCHAR(50),
    FOREIGN KEY (AssignedTo) REFERENCES employees(EmployeeID) ON DELETE SET NULL,
    INDEX idx_assigned_to (AssignedTo),
    INDEX idx_status (Status),
    INDEX idx_asset_tag (AssetTag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
    SupplierID INT PRIMARY KEY AUTO_INCREMENT,
    SupplierName VARCHAR(200),
    ContactPerson VARCHAR(100),
    INDEX idx_supplier_name (SupplierName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Purchase Orders Table
CREATE TABLE IF NOT EXISTS purchase_orders (
    OrderID INT PRIMARY KEY AUTO_INCREMENT,
    SupplierID INT,
    OrderNumber VARCHAR(50),
    Status VARCHAR(50),
    FOREIGN KEY (SupplierID) REFERENCES suppliers(SupplierID) ON DELETE CASCADE,
    INDEX idx_supplier (SupplierID),
    INDEX idx_order_number (OrderNumber)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Maintenance Records Table
CREATE TABLE IF NOT EXISTS maintenance_records (
    MaintenanceID INT PRIMARY KEY AUTO_INCREMENT,
    AssetID INT,
    Date DATE,
    Cost DECIMAL(15,2),
    FOREIGN KEY (AssetID) REFERENCES assets(AssetID) ON DELETE CASCADE,
    INDEX idx_asset (AssetID),
    INDEX idx_date (Date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
