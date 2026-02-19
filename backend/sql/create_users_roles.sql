-- Users and Roles Management System
-- UCU Analytics Platform - RBAC Implementation

CREATE DATABASE IF NOT EXISTS UCU_Analytics;
USE UCU_Analytics;

-- Roles Table
CREATE TABLE IF NOT EXISTS roles (
    role_id INT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_role_name (role_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permissions Table
CREATE TABLE IF NOT EXISTS permissions (
    permission_id INT PRIMARY KEY AUTO_INCREMENT,
    permission_name VARCHAR(100) UNIQUE NOT NULL,
    resource VARCHAR(100) NOT NULL,  -- e.g., 'analytics', 'reports', 'users', 'system'
    action VARCHAR(50) NOT NULL,  -- e.g., 'read', 'write', 'delete', 'execute'
    description TEXT,
    INDEX idx_resource_action (resource, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Role-Permission Mapping
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT,
    permission_id INT,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    access_number VARCHAR(10) UNIQUE,  -- For students: A##### or B#####
    staff_number VARCHAR(50) UNIQUE,  -- For staff: UCU/STF/####
    student_id INT,  -- Reference to students table if student
    staff_id INT,  -- Reference to employees/lecturers table if staff
    role_id INT NOT NULL,
    faculty_id INT,  -- For Dean/HOD
    department_id INT,  -- For HOD
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(role_id),
    INDEX idx_username (username),
    INDEX idx_access_number (access_number),
    INDEX idx_staff_number (staff_number),
    INDEX idx_email (email),
    INDEX idx_role (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Sessions (for JWT refresh tokens)
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    user_id INT NOT NULL,
    refresh_token VARCHAR(500),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    resource_id VARCHAR(100),
    details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Profiles
CREATE TABLE IF NOT EXISTS user_profiles (
    profile_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    profile_picture VARCHAR(255),
    bio TEXT,
    preferences JSON,  -- Store user preferences (theme, filters, etc.)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert Default Roles
INSERT INTO roles (role_name, description) VALUES
('senate', 'Senate members - view all analytics & reports (read-only)'),
('sysadmin', 'System Administrator - full system control (manage users, system variables, ETL jobs, schema migrations)'),
('analyst', 'Analyst - create/modify analytics, dashboards, datasets, run advanced queries'),
('student', 'Student - view only their analytics and profile (login with Access number)'),
('staff', 'Staff - view/edit own profile; view evaluations and analytics for classes they teach'),
('dean', 'Dean - view all academic & administrative activities in their faculty'),
('hod', 'Head of Department - view all academic & administrative activities in their department'),
('hr', 'HR - view/edit HR-related analytics, staff lists'),
('finance', 'Finance - view finance analytics, payments, scholarships')
ON DUPLICATE KEY UPDATE description=VALUES(description);

-- Insert Default Permissions
INSERT INTO permissions (permission_name, resource, action, description) VALUES
-- Analytics permissions
('analytics:read:all', 'analytics', 'read', 'View all analytics across the institution'),
('analytics:read:faculty', 'analytics', 'read', 'View analytics for own faculty'),
('analytics:read:department', 'analytics', 'read', 'View analytics for own department'),
('analytics:read:own', 'analytics', 'read', 'View own analytics only'),
('analytics:write', 'analytics', 'write', 'Create/modify analytics and dashboards'),
('analytics:delete', 'analytics', 'delete', 'Delete analytics and dashboards'),

-- Reports permissions
('reports:read:all', 'reports', 'read', 'View all reports'),
('reports:read:faculty', 'reports', 'read', 'View reports for own faculty'),
('reports:read:department', 'reports', 'read', 'View reports for own department'),
('reports:write', 'reports', 'write', 'Create/modify reports'),
('reports:export', 'reports', 'execute', 'Export reports (CSV, Excel, PDF)'),

-- Users permissions
('users:read:all', 'users', 'read', 'View all users'),
('users:read:faculty', 'users', 'read', 'View users in own faculty'),
('users:read:department', 'users', 'read', 'View users in own department'),
('users:write', 'users', 'write', 'Create/modify users'),
('users:delete', 'users', 'delete', 'Delete users'),

-- System permissions
('system:read', 'system', 'read', 'View system settings'),
('system:write', 'system', 'write', 'Modify system settings and variables'),
('system:etl', 'system', 'execute', 'Manage ETL jobs and schedules'),
('system:schema', 'system', 'execute', 'Manage database schema migrations'),

-- Data permissions
('data:read:all', 'data', 'read', 'Access all data'),
('data:read:faculty', 'data', 'read', 'Access data for own faculty'),
('data:read:department', 'data', 'read', 'Access data for own department'),
('data:read:own', 'data', 'read', 'Access own data only'),
('data:write', 'data', 'write', 'Modify data'),
('data:export', 'data', 'execute', 'Export data'),

-- HR permissions
('hr:read', 'hr', 'read', 'View HR data'),
('hr:write', 'hr', 'write', 'Modify HR data'),

-- Finance permissions
('finance:read', 'finance', 'read', 'View finance data'),
('finance:write', 'finance', 'write', 'Modify finance data')
ON DUPLICATE KEY UPDATE description=VALUES(description);

-- Assign permissions to roles
-- Senate: read all analytics and reports
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'senate'
AND p.permission_name IN (
    'analytics:read:all', 'reports:read:all', 'reports:export', 'data:read:all', 'data:export'
)
ON DUPLICATE KEY UPDATE role_id=role_id;

-- Sysadmin: all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'sysadmin'
ON DUPLICATE KEY UPDATE role_id=role_id;

-- Analyst: analytics and reports write, data read
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'analyst'
AND p.permission_name IN (
    'analytics:read:all', 'analytics:write', 'analytics:delete',
    'reports:read:all', 'reports:write', 'reports:export',
    'data:read:all', 'data:export'
)
ON DUPLICATE KEY UPDATE role_id=role_id;

-- Student: own data only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'student'
AND p.permission_name IN (
    'analytics:read:own', 'reports:read:all', 'data:read:own'
)
ON DUPLICATE KEY UPDATE role_id=role_id;

-- Staff: own profile + classes taught
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'staff'
AND p.permission_name IN (
    'analytics:read:department', 'reports:read:department', 'reports:export',
    'data:read:department', 'data:export'
)
ON DUPLICATE KEY UPDATE role_id=role_id;

-- Dean: faculty-level access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'dean'
AND p.permission_name IN (
    'analytics:read:faculty', 'reports:read:faculty', 'reports:export',
    'data:read:faculty', 'data:export'
)
ON DUPLICATE KEY UPDATE role_id=role_id;

-- HOD: department-level access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'hod'
AND p.permission_name IN (
    'analytics:read:department', 'reports:read:department', 'reports:export',
    'data:read:department', 'data:export'
)
ON DUPLICATE KEY UPDATE role_id=role_id;

-- HR: HR permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'hr'
AND p.permission_name IN (
    'hr:read', 'hr:write', 'users:read:all', 'data:read:all', 'reports:export'
)
ON DUPLICATE KEY UPDATE role_id=role_id;

-- Finance: finance permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'finance'
AND p.permission_name IN (
    'finance:read', 'finance:write', 'reports:read:all', 'reports:export',
    'data:read:all', 'data:export'
)
ON DUPLICATE KEY UPDATE role_id=role_id;

