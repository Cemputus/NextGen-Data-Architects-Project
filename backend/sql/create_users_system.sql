-- UCU Data Engineering System - Users and RBAC Schema — PostgreSQL version

-- User Roles
CREATE TABLE IF NOT EXISTS user_roles (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    role_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO user_roles (role_name, role_description) VALUES
('senate', 'Senate members - can view all analytics & reports (read-only)'),
('sysadmin', 'System Administrator - full system control'),
('analyst', 'Analyst - create/modify analytics, dashboards, datasets, run advanced queries'),
('student', 'Student - view only their analytics and profile (login with Access number)'),
('staff', 'Staff - view/edit own profile; view evaluations and analytics for classes they teach'),
('dean', 'Dean - view all academic & administrative activities in their faculty'),
('hod', 'Head of Department - view all academic & administrative activities in their department'),
('hr', 'HR - view/edit HR-related analytics, staff lists'),
('finance', 'Finance - view finance analytics, payments, scholarships')
ON CONFLICT (role_name) DO UPDATE SET role_description = EXCLUDED.role_description;

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
    role_id INT NOT NULL,
    faculty_id INT,
    department_id INT,
    program_id INT,
    student_id INT,
    staff_id INT,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES user_roles(role_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_us_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_us_access_number ON users(access_number);
CREATE INDEX IF NOT EXISTS idx_us_reg_number ON users(reg_number);
CREATE INDEX IF NOT EXISTS idx_us_staff_number ON users(staff_number);
CREATE INDEX IF NOT EXISTS idx_us_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_us_faculty ON users(faculty_id);
CREATE INDEX IF NOT EXISTS idx_us_department ON users(department_id);

-- Permissions Table
CREATE TABLE IF NOT EXISTS permissions (
    permission_id SERIAL PRIMARY KEY,
    permission_name VARCHAR(100) UNIQUE NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT
);

-- Role Permissions (Many-to-Many)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES user_roles(role_id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE
);

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id BIGSERIAL PRIMARY KEY,
    user_id INT,
    username VARCHAR(100),
    role_name VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    resource_id VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_us_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_us_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_us_audit_resource ON audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_us_audit_created_at ON audit_logs(created_at);

-- User Sessions Table (for JWT refresh tokens)
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    user_id INT NOT NULL,
    refresh_token VARCHAR(500),
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_us_sess_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_us_sess_expires ON user_sessions(expires_at);

-- Saved Filter Presets
CREATE TABLE IF NOT EXISTS filter_presets (
    preset_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    preset_name VARCHAR(200) NOT NULL,
    filters JSONB NOT NULL,
    is_shared BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_us_preset_user ON filter_presets(user_id);

-- Saved Reports
CREATE TABLE IF NOT EXISTS saved_reports (
    report_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    report_name VARCHAR(200) NOT NULL,
    report_type VARCHAR(50),
    report_config JSONB NOT NULL,
    share_token VARCHAR(255) UNIQUE,
    expires_at TIMESTAMP,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_us_report_user ON saved_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_us_report_share_token ON saved_reports(share_token);
