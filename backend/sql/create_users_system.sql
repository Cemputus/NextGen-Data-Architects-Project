-- UCU Data Engineering System - Users and RBAC Schema
-- This file creates the user management and role-based access control system

USE UCU_DataWarehouse;

-- User Roles Enum
-- Roles: senate, sysadmin, analyst, student, staff, dean, hod, hr, finance
CREATE TABLE IF NOT EXISTS user_roles (
    role_id INT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    role_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default roles
INSERT INTO user_roles (role_name, role_description) VALUES
('senate', 'Senate members - can view all analytics & reports (read-only)'),
('sysadmin', 'System Administrator - full system control (manage users, system variables, ETL jobs, schema migrations)'),
('analyst', 'Analyst - create/modify analytics, dashboards, datasets, run advanced queries'),
('student', 'Student - view only their analytics and profile (login with Access number)'),
('staff', 'Staff - view/edit own profile; view evaluations and analytics for classes they teach'),
('dean', 'Dean - view all academic & administrative activities in their faculty'),
('hod', 'Head of Department - view all academic & administrative activities in their department'),
('hr', 'HR - view/edit HR-related analytics, staff lists'),
('finance', 'Finance - view finance analytics, payments, scholarships')
ON DUPLICATE KEY UPDATE role_description = VALUES(role_description);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,  -- bcrypt hash
    access_number VARCHAR(10) UNIQUE,  -- For students: A##### or B#####
    reg_number VARCHAR(50),  -- Student registration number
    staff_number VARCHAR(50),  -- For staff
    full_name VARCHAR(200) NOT NULL,
    role_id INT NOT NULL,
    faculty_id INT,  -- For dean, hod, staff
    department_id INT,  -- For hod, staff
    program_id INT,  -- For students
    student_id INT,  -- Link to dim_student if student
    staff_id INT,  -- Link to employees if staff
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES user_roles(role_id) ON DELETE RESTRICT,
    INDEX idx_username (username),
    INDEX idx_access_number (access_number),
    INDEX idx_reg_number (reg_number),
    INDEX idx_staff_number (staff_number),
    INDEX idx_role (role_id),
    INDEX idx_faculty (faculty_id),
    INDEX idx_department (department_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permissions Table
CREATE TABLE IF NOT EXISTS permissions (
    permission_id INT PRIMARY KEY AUTO_INCREMENT,
    permission_name VARCHAR(100) UNIQUE NOT NULL,
    resource VARCHAR(100) NOT NULL,  -- e.g., 'analytics', 'users', 'reports'
    action VARCHAR(50) NOT NULL,  -- e.g., 'read', 'write', 'delete', 'execute'
    description TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Role Permissions (Many-to-Many)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES user_roles(role_id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    username VARCHAR(100),
    role_name VARCHAR(50),
    action VARCHAR(100) NOT NULL,  -- e.g., 'login', 'role_change', 'data_export', 'user_create'
    resource VARCHAR(100),  -- e.g., 'users', 'analytics', 'reports'
    resource_id VARCHAR(100),  -- ID of the affected resource
    details JSON,  -- Additional details about the action
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_resource (resource),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Sessions Table (for JWT refresh tokens)
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    user_id INT NOT NULL,
    refresh_token VARCHAR(500),
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Saved Filter Presets (for analysts and senate)
CREATE TABLE IF NOT EXISTS filter_presets (
    preset_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    preset_name VARCHAR(200) NOT NULL,
    filters JSON NOT NULL,  -- Store filter configuration as JSON
    is_shared BOOLEAN DEFAULT FALSE,  -- Can be shared with other users
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Saved Reports (for sharing)
CREATE TABLE IF NOT EXISTS saved_reports (
    report_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    report_name VARCHAR(200) NOT NULL,
    report_type VARCHAR(50),  -- e.g., 'dashboard', 'analytics', 'export'
    report_config JSON NOT NULL,  -- Store report configuration
    share_token VARCHAR(255) UNIQUE,  -- Token for sharing
    expires_at TIMESTAMP,  -- Optional expiry for shared reports
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_share_token (share_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

