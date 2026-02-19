-- Users and Roles Database
-- This will be part of the data warehouse or a separate auth database

USE UCU_DataWarehouse;

-- Roles Table
CREATE TABLE IF NOT EXISTS roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions TEXT,  -- JSON string
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    access_number VARCHAR(10) UNIQUE,  -- For students: A##### or B#####
    reg_number VARCHAR(50),  -- For students: RegNo
    staff_number VARCHAR(50),  -- For staff
    full_name VARCHAR(200),
    role_id INT NOT NULL,
    
    -- Role-specific associations
    student_id INT,  -- FK to dim_student if student
    staff_id INT,  -- FK to lecturers/employees if staff
    faculty_id INT,  -- FK to faculties if dean
    department_id INT,  -- FK to departments if HOD
    
    is_active BOOLEAN DEFAULT TRUE,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
    INDEX idx_username (username),
    INDEX idx_access_number (access_number),
    INDEX idx_email (email),
    INDEX idx_role (role_id),
    INDEX idx_student (student_id),
    INDEX idx_staff (staff_id),
    INDEX idx_faculty (faculty_id),
    INDEX idx_department (department_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    username VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(200),
    details TEXT,
    ip_address VARCHAR(45),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default roles
INSERT INTO roles (name, description, permissions) VALUES
('senate', 'Senate Members - View all analytics and reports', '{"read": ["*"], "export": ["*"], "reports": ["*"]}'),
('sysadmin', 'System Administrator - Full system control', '{"read": ["*"], "write": ["*"], "delete": ["*"], "manage_users": true, "manage_system": true, "manage_etl": true, "audit_logs": true}'),
('analyst', 'Data Analyst - Create/modify analytics and dashboards', '{"read": ["*"], "write": ["analytics", "dashboards", "reports", "queries"], "delete": ["analytics", "dashboards", "reports"], "export": ["*"], "create_queries": true, "create_dashboards": true}'),
('student', 'Student - View own analytics only', '{"read": ["own_data"], "write": ["own_profile"], "export": ["own_data"]}'),
('staff', 'Staff - View own evaluations and class analytics', '{"read": ["own_data", "own_classes", "own_students"], "write": ["own_profile", "own_evaluations"], "export": ["own_data", "own_classes"]}'),
('dean', 'Dean - View all faculty activities', '{"read": ["faculty_data", "faculty_staff", "faculty_students"], "write": ["faculty_reports"], "export": ["faculty_data"]}'),
('hod', 'Head of Department - View all department activities', '{"read": ["department_data", "department_staff", "department_students"], "write": ["department_reports"], "export": ["department_data"]}'),
('hr', 'HR - View HR analytics and staff data', '{"read": ["staff_data", "hr_analytics"], "write": ["staff_records", "hr_reports"], "export": ["staff_data", "hr_analytics"]}'),
('finance', 'Finance - View finance analytics and payments', '{"read": ["finance_data", "payments", "scholarships"], "write": ["finance_reports"], "export": ["finance_data"]}')
ON DUPLICATE KEY UPDATE description=VALUES(description), permissions=VALUES(permissions);

