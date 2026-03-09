-- Users and Roles Management System — PostgreSQL version
-- UCU Analytics Platform - RBAC Implementation

-- Roles Table
CREATE TABLE IF NOT EXISTS roles (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ur_role_name ON roles(role_name);

-- Permissions Table
CREATE TABLE IF NOT EXISTS permissions (
    permission_id SERIAL PRIMARY KEY,
    permission_name VARCHAR(100) UNIQUE NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT
);
CREATE INDEX IF NOT EXISTS idx_ur_resource_action ON permissions(resource, action);

-- Role-Permission Mapping
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT,
    permission_id INT,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE
);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    access_number VARCHAR(10) UNIQUE,
    staff_number VARCHAR(50) UNIQUE,
    student_id INT,
    staff_id INT,
    role_id INT NOT NULL,
    faculty_id INT,
    department_id INT,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(role_id)
);
CREATE INDEX IF NOT EXISTS idx_ur_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_ur_access_number ON users(access_number);
CREATE INDEX IF NOT EXISTS idx_ur_staff_number ON users(staff_number);
CREATE INDEX IF NOT EXISTS idx_ur_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_ur_role ON users(role_id);

-- User Sessions (for JWT refresh tokens)
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    user_id INT NOT NULL,
    refresh_token VARCHAR(500),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ur_sess_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ur_sess_expires_at ON user_sessions(expires_at);

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id BIGSERIAL PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    resource_id VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_ur_audit_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ur_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_ur_audit_created_at ON audit_logs(created_at);

-- User Profiles
CREATE TABLE IF NOT EXISTS user_profiles (
    profile_id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    profile_picture VARCHAR(255),
    bio TEXT,
    preferences JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Insert Default Roles
INSERT INTO roles (role_name, description) VALUES
('senate', 'Senate members - view all analytics & reports (read-only)'),
('sysadmin', 'System Administrator - full system control'),
('analyst', 'Analyst - create/modify analytics, dashboards, datasets, run advanced queries'),
('student', 'Student - view only their analytics and profile (login with Access number)'),
('staff', 'Staff - view/edit own profile; view evaluations and analytics for classes they teach'),
('dean', 'Dean - view all academic & administrative activities in their faculty'),
('hod', 'Head of Department - view all academic & administrative activities in their department'),
('hr', 'HR - view/edit HR-related analytics, staff lists'),
('finance', 'Finance - view finance analytics, payments, scholarships')
ON CONFLICT (role_name) DO UPDATE SET description = EXCLUDED.description;

-- Insert Default Permissions
INSERT INTO permissions (permission_name, resource, action, description) VALUES
('analytics:read:all', 'analytics', 'read', 'View all analytics across the institution'),
('analytics:read:faculty', 'analytics', 'read', 'View analytics for own faculty'),
('analytics:read:department', 'analytics', 'read', 'View analytics for own department'),
('analytics:read:own', 'analytics', 'read', 'View own analytics only'),
('analytics:write', 'analytics', 'write', 'Create/modify analytics and dashboards'),
('analytics:delete', 'analytics', 'delete', 'Delete analytics and dashboards'),
('reports:read:all', 'reports', 'read', 'View all reports'),
('reports:read:faculty', 'reports', 'read', 'View reports for own faculty'),
('reports:read:department', 'reports', 'read', 'View reports for own department'),
('reports:write', 'reports', 'write', 'Create/modify reports'),
('reports:export', 'reports', 'execute', 'Export reports (CSV, Excel, PDF)'),
('users:read:all', 'users', 'read', 'View all users'),
('users:read:faculty', 'users', 'read', 'View users in own faculty'),
('users:read:department', 'users', 'read', 'View users in own department'),
('users:write', 'users', 'write', 'Create/modify users'),
('users:delete', 'users', 'delete', 'Delete users'),
('system:read', 'system', 'read', 'View system settings'),
('system:write', 'system', 'write', 'Modify system settings and variables'),
('system:etl', 'system', 'execute', 'Manage ETL jobs and schedules'),
('system:schema', 'system', 'execute', 'Manage database schema migrations'),
('data:read:all', 'data', 'read', 'Access all data'),
('data:read:faculty', 'data', 'read', 'Access data for own faculty'),
('data:read:department', 'data', 'read', 'Access data for own department'),
('data:read:own', 'data', 'read', 'Access own data only'),
('data:write', 'data', 'write', 'Modify data'),
('data:export', 'data', 'execute', 'Export data'),
('hr:read', 'hr', 'read', 'View HR data'),
('hr:write', 'hr', 'write', 'Modify HR data'),
('finance:read', 'finance', 'read', 'View finance data'),
('finance:write', 'finance', 'write', 'Modify finance data')
ON CONFLICT (permission_name) DO UPDATE SET description = EXCLUDED.description;

-- Assign permissions to roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'senate'
AND p.permission_name IN ('analytics:read:all', 'reports:read:all', 'reports:export', 'data:read:all', 'data:export')
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
AND p.permission_name IN ('analytics:read:all', 'analytics:write', 'analytics:delete', 'reports:read:all', 'reports:write', 'reports:export', 'data:read:all', 'data:export')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'student'
AND p.permission_name IN ('analytics:read:own', 'reports:read:all', 'data:read:own')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'staff'
AND p.permission_name IN ('analytics:read:department', 'reports:read:department', 'reports:export', 'data:read:department', 'data:export')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'dean'
AND p.permission_name IN ('analytics:read:faculty', 'reports:read:faculty', 'reports:export', 'data:read:faculty', 'data:export')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'hod'
AND p.permission_name IN ('analytics:read:department', 'reports:read:department', 'reports:export', 'data:read:department', 'data:export')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'hr'
AND p.permission_name IN ('hr:read', 'hr:write', 'users:read:all', 'data:read:all', 'reports:export')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'finance'
AND p.permission_name IN ('finance:read', 'finance:write', 'reports:read:all', 'reports:export', 'data:read:all', 'data:export')
ON CONFLICT DO NOTHING;
