-- UCU Data Engineering System - RBAC (Role-Based Access Control) System
-- PostgreSQL version

-- Roles Table
CREATE TABLE IF NOT EXISTS roles (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    role_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rbac_role_name ON roles(role_name);

-- Permissions Table
CREATE TABLE IF NOT EXISTS permissions (
    permission_id SERIAL PRIMARY KEY,
    permission_name VARCHAR(100) UNIQUE NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rbac_resource_action ON permissions(resource, action);

-- Role-Permissions (Many-to-Many)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_rp_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_rp_permission ON role_permissions(permission_id);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    access_number VARCHAR(10) UNIQUE,
    reg_number VARCHAR(50),
    staff_number VARCHAR(50),
    full_name VARCHAR(200) NOT NULL,
    phone VARCHAR(20),
    profile_picture VARCHAR(500),
    role_id INT NOT NULL,
    student_id INT,
    staff_id INT,
    faculty_id INT,
    department_id INT,
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP,
    password_changed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_access_number ON users(access_number);
CREATE INDEX IF NOT EXISTS idx_users_reg_number ON users(reg_number);
CREATE INDEX IF NOT EXISTS idx_users_staff_number ON users(staff_number);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_student ON users(student_id);
CREATE INDEX IF NOT EXISTS idx_users_staff ON users(staff_id);
CREATE INDEX IF NOT EXISTS idx_users_faculty ON users(faculty_id);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- User Sessions (JWT Refresh Tokens)
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    user_id INT NOT NULL,
    refresh_token VARCHAR(500),
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON user_sessions(expires_at);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id BIGSERIAL PRIMARY KEY,
    user_id INT,
    username VARCHAR(100),
    role_name VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    resource_id VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    status VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_role ON audit_logs(role_name);

-- Filter Presets (For Analysts and Senate)
CREATE TABLE IF NOT EXISTS filter_presets (
    preset_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    preset_name VARCHAR(200) NOT NULL,
    filter_config TEXT NOT NULL,
    is_shared BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_presets_user ON filter_presets(user_id);
CREATE INDEX IF NOT EXISTS idx_presets_shared ON filter_presets(is_shared);

-- Insert Default Roles
INSERT INTO roles (role_name, role_description) VALUES
('senate', 'Senate members - can view all analytics and reports (read-only)'),
('sysadmin', 'System Administrator - full system control'),
('analyst', 'Analyst - create/modify analytics, dashboards, datasets, run advanced queries'),
('student', 'Student - view only their own analytics and profile'),
('staff', 'Staff - view own profile, classes taught, analytics for their classes'),
('dean', 'Dean - view all academic & administrative activities in their faculty'),
('hod', 'Head of Department - view all academic & administrative activities in their department'),
('hr', 'HR - view/edit HR-related analytics, staff lists'),
('finance', 'Finance - view finance analytics, payments, scholarships')
ON CONFLICT (role_name) DO UPDATE SET role_description = EXCLUDED.role_description;

-- Insert Default Permissions
INSERT INTO permissions (permission_name, resource, action, description) VALUES
('analytics.read.all', 'analytics', 'read', 'Read all analytics across the system'),
('analytics.read.own', 'analytics', 'read', 'Read own analytics only'),
('analytics.read.faculty', 'analytics', 'read', 'Read analytics for own faculty'),
('analytics.read.department', 'analytics', 'read', 'Read analytics for own department'),
('analytics.read.classes', 'analytics', 'read', 'Read analytics for classes taught'),
('analytics.write', 'analytics', 'write', 'Create/modify analytics and dashboards'),
('analytics.delete', 'analytics', 'delete', 'Delete analytics and dashboards'),
('reports.read.all', 'reports', 'read', 'Read all reports'),
('reports.read.own', 'reports', 'read', 'Read own reports only'),
('reports.write', 'reports', 'write', 'Create/modify reports'),
('reports.export', 'reports', 'execute', 'Export reports (CSV, Excel, PDF)'),
('reports.share', 'reports', 'write', 'Share report links'),
('users.read.all', 'users', 'read', 'Read all users'),
('users.read.own', 'users', 'read', 'Read own profile only'),
('users.write', 'users', 'write', 'Create/modify users'),
('users.delete', 'users', 'delete', 'Delete users'),
('users.manage_roles', 'users', 'manage', 'Assign/change user roles'),
('students.read.all', 'students', 'read', 'Read all student data'),
('students.read.own', 'students', 'read', 'Read own student data only'),
('students.read.classes', 'students', 'read', 'Read student data for classes taught'),
('students.read.department', 'students', 'read', 'Read student data for own department'),
('students.read.faculty', 'students', 'read', 'Read student data for own faculty'),
('students.write', 'students', 'write', 'Modify student data'),
('staff.read.all', 'staff', 'read', 'Read all staff data'),
('staff.read.own', 'staff', 'read', 'Read own staff data only'),
('staff.write', 'staff', 'write', 'Modify staff data'),
('system.manage', 'system', 'manage', 'Manage system settings, variables, ETL jobs'),
('system.etl', 'system', 'execute', 'Execute ETL jobs'),
('system.schema', 'system', 'manage', 'Manage database schema migrations'),
('hr.read', 'hr', 'read', 'Read HR-related data'),
('hr.write', 'hr', 'write', 'Modify HR-related data'),
('finance.read', 'finance', 'read', 'Read finance-related data'),
('finance.write', 'finance', 'write', 'Modify finance-related data')
ON CONFLICT (permission_name) DO UPDATE SET description = EXCLUDED.description;

-- Assign Permissions to Roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'senate'
AND p.permission_name IN ('analytics.read.all', 'reports.read.all', 'reports.export', 'reports.share')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'sysadmin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'analyst'
AND p.permission_name IN (
    'analytics.read.all', 'analytics.write', 'analytics.delete',
    'reports.read.all', 'reports.write', 'reports.export', 'reports.share',
    'students.read.all', 'staff.read.all'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'student'
AND p.permission_name IN ('analytics.read.own', 'reports.read.own', 'students.read.own', 'users.read.own')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'staff'
AND p.permission_name IN (
    'analytics.read.own', 'analytics.read.classes',
    'reports.read.own', 'reports.export',
    'students.read.classes', 'users.read.own', 'users.write'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'dean'
AND p.permission_name IN (
    'analytics.read.faculty', 'reports.read.all', 'reports.export',
    'students.read.faculty'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'hod'
AND p.permission_name IN (
    'analytics.read.department', 'reports.read.all', 'reports.export',
    'students.read.department'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'hr'
AND p.permission_name IN ('hr.read', 'hr.write', 'staff.read.all', 'reports.read.all', 'reports.export')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'finance'
AND p.permission_name IN ('finance.read', 'finance.write', 'reports.read.all', 'reports.export')
ON CONFLICT DO NOTHING;
