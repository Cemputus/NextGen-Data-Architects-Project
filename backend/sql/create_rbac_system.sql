-- UCU Data Engineering System - RBAC (Role-Based Access Control) System
-- Comprehensive user roles, permissions, and audit logging

USE UCU_DataWarehouse;

-- ==================== ROLES TABLE ====================
CREATE TABLE IF NOT EXISTS roles (
    role_id INT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    role_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_role_name (role_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== PERMISSIONS TABLE ====================
CREATE TABLE IF NOT EXISTS permissions (
    permission_id INT PRIMARY KEY AUTO_INCREMENT,
    permission_name VARCHAR(100) UNIQUE NOT NULL,
    resource VARCHAR(100) NOT NULL,  -- e.g., 'analytics', 'users', 'reports', 'students'
    action VARCHAR(50) NOT NULL,  -- e.g., 'read', 'write', 'delete', 'execute', 'manage'
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_resource_action (resource, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== ROLE_PERMISSIONS (Many-to-Many) ====================
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE,
    INDEX idx_role (role_id),
    INDEX idx_permission (permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== USERS TABLE ====================
CREATE TABLE IF NOT EXISTS users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,  -- bcrypt hash
    access_number VARCHAR(10) UNIQUE,  -- For students: A##### or B#####
    reg_number VARCHAR(50),  -- Student registration number
    staff_number VARCHAR(50),  -- For staff: UCU/STF/####
    full_name VARCHAR(200) NOT NULL,
    phone VARCHAR(20),
    profile_picture VARCHAR(500),
    
    -- Role and associations
    role_id INT NOT NULL,
    student_id INT,  -- Link to dim_student if student
    staff_id INT,  -- Link to employees/lecturers if staff
    faculty_id INT,  -- For dean, hod, staff
    department_id INT,  -- For hod, staff
    
    -- Status and metadata
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP NULL,
    password_changed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE RESTRICT,
    INDEX idx_username (username),
    INDEX idx_access_number (access_number),
    INDEX idx_reg_number (reg_number),
    INDEX idx_staff_number (staff_number),
    INDEX idx_email (email),
    INDEX idx_role (role_id),
    INDEX idx_student (student_id),
    INDEX idx_staff (staff_id),
    INDEX idx_faculty (faculty_id),
    INDEX idx_department (department_id),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== USER_SESSIONS (JWT Refresh Tokens) ====================
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    user_id INT NOT NULL,
    refresh_token VARCHAR(500),
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== AUDIT LOGS TABLE ====================
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    username VARCHAR(100),
    role_name VARCHAR(50),
    action VARCHAR(100) NOT NULL,  -- e.g., 'login', 'role_change', 'data_export', 'user_create'
    resource VARCHAR(100),  -- e.g., 'users', 'analytics', 'reports'
    resource_id VARCHAR(100),  -- ID of the affected resource
    old_value TEXT,  -- JSON string for old state
    new_value TEXT,  -- JSON string for new state
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    status VARCHAR(50),  -- 'success', 'failure', 'error'
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_resource (resource),
    INDEX idx_created_at (created_at),
    INDEX idx_role (role_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== FILTER PRESETS (For Analysts and Senate) ====================
CREATE TABLE IF NOT EXISTS filter_presets (
    preset_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    preset_name VARCHAR(200) NOT NULL,
    filter_config TEXT NOT NULL,  -- JSON string with filter settings
    is_shared BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_shared (is_shared)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== INSERT DEFAULT ROLES ====================
INSERT INTO roles (role_name, role_description) VALUES
('senate', 'Senate members - can view all analytics and reports (read-only)'),
('sysadmin', 'System Administrator - full system control (manage users, system variables, ETL jobs, schema migrations)'),
('analyst', 'Analyst - create/modify analytics, dashboards, datasets, run advanced queries'),
('student', 'Student - view only their own analytics and profile (login with Access number)'),
('staff', 'Staff - view own profile, classes taught, analytics for their classes, filter students'),
('dean', 'Dean - view all academic & administrative activities in their faculty'),
('hod', 'Head of Department - view all academic & administrative activities in their department'),
('hr', 'HR - view/edit HR-related analytics, staff lists'),
('finance', 'Finance - view finance analytics, payments, scholarships')
ON DUPLICATE KEY UPDATE role_description = VALUES(role_description);

-- ==================== INSERT DEFAULT PERMISSIONS ====================
INSERT INTO permissions (permission_name, resource, action, description) VALUES
-- Analytics permissions
('analytics.read.all', 'analytics', 'read', 'Read all analytics across the system'),
('analytics.read.own', 'analytics', 'read', 'Read own analytics only'),
('analytics.read.faculty', 'analytics', 'read', 'Read analytics for own faculty'),
('analytics.read.department', 'analytics', 'read', 'Read analytics for own department'),
('analytics.read.classes', 'analytics', 'read', 'Read analytics for classes taught'),
('analytics.write', 'analytics', 'write', 'Create/modify analytics and dashboards'),
('analytics.delete', 'analytics', 'delete', 'Delete analytics and dashboards'),

-- Reports permissions
('reports.read.all', 'reports', 'read', 'Read all reports'),
('reports.read.own', 'reports', 'read', 'Read own reports only'),
('reports.write', 'reports', 'write', 'Create/modify reports'),
('reports.export', 'reports', 'execute', 'Export reports (CSV, Excel, PDF)'),
('reports.share', 'reports', 'write', 'Share report links'),

-- Users permissions
('users.read.all', 'users', 'read', 'Read all users'),
('users.read.own', 'users', 'read', 'Read own profile only'),
('users.write', 'users', 'write', 'Create/modify users'),
('users.delete', 'users', 'delete', 'Delete users'),
('users.manage_roles', 'users', 'manage', 'Assign/change user roles'),

-- Students permissions
('students.read.all', 'students', 'read', 'Read all student data'),
('students.read.own', 'students', 'read', 'Read own student data only'),
('students.read.classes', 'students', 'read', 'Read student data for classes taught'),
('students.read.department', 'students', 'read', 'Read student data for own department'),
('students.read.faculty', 'students', 'read', 'Read student data for own faculty'),
('students.write', 'students', 'write', 'Modify student data'),

-- Staff permissions
('staff.read.all', 'staff', 'read', 'Read all staff data'),
('staff.read.own', 'staff', 'read', 'Read own staff data only'),
('staff.write', 'staff', 'write', 'Modify staff data'),

-- System permissions
('system.manage', 'system', 'manage', 'Manage system settings, variables, ETL jobs'),
('system.etl', 'system', 'execute', 'Execute ETL jobs'),
('system.schema', 'system', 'manage', 'Manage database schema migrations'),

-- HR permissions
('hr.read', 'hr', 'read', 'Read HR-related data'),
('hr.write', 'hr', 'write', 'Modify HR-related data'),

-- Finance permissions
('finance.read', 'finance', 'read', 'Read finance-related data'),
('finance.write', 'finance', 'write', 'Modify finance-related data')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- ==================== ASSIGN PERMISSIONS TO ROLES ====================
-- Senate: Read all analytics and reports
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'senate'
AND p.permission_name IN ('analytics.read.all', 'reports.read.all', 'reports.export', 'reports.share')
ON DUPLICATE KEY UPDATE role_id = role_id;

-- Sysadmin: Full control
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'sysadmin'
AND p.permission_name LIKE '%'
ON DUPLICATE KEY UPDATE role_id = role_id;

-- Analyst: Analytics and reports management
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'analyst'
AND p.permission_name IN (
    'analytics.read.all', 'analytics.write', 'analytics.delete',
    'reports.read.all', 'reports.write', 'reports.export', 'reports.share',
    'students.read.all', 'staff.read.all'
)
ON DUPLICATE KEY UPDATE role_id = role_id;

-- Student: Own data only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'student'
AND p.permission_name IN ('analytics.read.own', 'reports.read.own', 'students.read.own', 'users.read.own')
ON DUPLICATE KEY UPDATE role_id = role_id;

-- Staff: Own profile and classes
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'staff'
AND p.permission_name IN (
    'analytics.read.own', 'analytics.read.classes',
    'reports.read.own', 'reports.export',
    'students.read.classes', 'users.read.own', 'users.write'
)
ON DUPLICATE KEY UPDATE role_id = role_id;

-- Dean: Faculty-wide access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'dean'
AND p.permission_name IN (
    'analytics.read.faculty', 'reports.read.all', 'reports.export',
    'students.read.faculty', 'staff.read.faculty'
)
ON DUPLICATE KEY UPDATE role_id = role_id;

-- HOD: Department-wide access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'hod'
AND p.permission_name IN (
    'analytics.read.department', 'reports.read.all', 'reports.export',
    'students.read.department', 'staff.read.department'
)
ON DUPLICATE KEY UPDATE role_id = role_id;

-- HR: HR-related access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'hr'
AND p.permission_name IN ('hr.read', 'hr.write', 'staff.read.all', 'reports.read.all', 'reports.export')
ON DUPLICATE KEY UPDATE role_id = role_id;

-- Finance: Finance-related access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'finance'
AND p.permission_name IN ('finance.read', 'finance.write', 'reports.read.all', 'reports.export')
ON DUPLICATE KEY UPDATE role_id = role_id;

