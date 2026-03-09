-- Users and Roles Database — PostgreSQL version

-- Roles Table
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    access_number VARCHAR(10) UNIQUE,
    reg_number VARCHAR(50),
    staff_number VARCHAR(50),
    full_name VARCHAR(200),
    role_id INT NOT NULL,
    student_id INT,
    staff_id INT,
    faculty_id INT,
    department_id INT,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_users_db_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_db_access_number ON users(access_number);
CREATE INDEX IF NOT EXISTS idx_users_db_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_db_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_db_student ON users(student_id);
CREATE INDEX IF NOT EXISTS idx_users_db_staff ON users(staff_id);
CREATE INDEX IF NOT EXISTS idx_users_db_faculty ON users(faculty_id);
CREATE INDEX IF NOT EXISTS idx_users_db_department ON users(department_id);

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INT,
    username VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(200),
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_logs(created_at);

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
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, permissions = EXCLUDED.permissions;
