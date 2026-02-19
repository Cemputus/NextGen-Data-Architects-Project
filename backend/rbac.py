"""
Role-Based Access Control (RBAC) System for UCU Analytics
Defines roles, permissions, and access control logic
"""
from enum import Enum
from typing import List, Dict, Set, Optional
from dataclasses import dataclass

class Role(str, Enum):
    """User roles in the system"""
    SENATE = "senate"
    SYSADMIN = "sysadmin"
    ANALYST = "analyst"
    STUDENT = "student"
    STAFF = "staff"
    DEAN = "dean"
    HOD = "hod"
    HR = "hr"
    FINANCE = "finance"

class Resource(str, Enum):
    """System resources that can be accessed"""
    DASHBOARD = "dashboard"
    ANALYTICS = "analytics"
    REPORTS = "reports"
    STUDENTS = "students"
    STAFF = "staff"
    COURSES = "courses"
    GRADES = "grades"
    ATTENDANCE = "attendance"
    PAYMENTS = "payments"
    ENROLLMENTS = "enrollments"
    FEX_ANALYTICS = "fex_analytics"
    HIGH_SCHOOL_ANALYTICS = "high_school_analytics"
    USER_MANAGEMENT = "user_management"
    SYSTEM_SETTINGS = "system_settings"
    ETL_JOBS = "etl_jobs"
    AUDIT_LOGS = "audit_logs"
    PROFILE = "profile"
    CLASS_ANALYTICS = "class_analytics"
    DEPARTMENT_ANALYTICS = "department_analytics"
    FACULTY_ANALYTICS = "faculty_analytics"
    HR_ANALYTICS = "hr_analytics"
    FINANCE_ANALYTICS = "finance_analytics"
    PREDICTIONS = "predictions"

class Permission(str, Enum):
    """Permissions that can be granted"""
    READ = "read"
    WRITE = "write"
    UPDATE = "update"
    DELETE = "delete"
    CREATE = "create"
    EXPORT = "export"
    SHARE = "share"
    MANAGE = "manage"

@dataclass
class RolePermission:
    """Defines permissions for a role on a resource"""
    role: Role
    resource: Resource
    permissions: Set[Permission]
    scope: Optional[str] = None  # 'own', 'department', 'faculty', 'all', etc.

# Define role permissions matrix
ROLE_PERMISSIONS: Dict[Role, List[RolePermission]] = {
    Role.SENATE: [
        RolePermission(Role.SENATE, Resource.DASHBOARD, {Permission.READ}),
        RolePermission(Role.SENATE, Resource.ANALYTICS, {Permission.READ, Permission.EXPORT}),
        RolePermission(Role.SENATE, Resource.REPORTS, {Permission.READ, Permission.EXPORT, Permission.SHARE}),
        RolePermission(Role.SENATE, Resource.STUDENTS, {Permission.READ}),
        RolePermission(Role.SENATE, Resource.STAFF, {Permission.READ}),
        RolePermission(Role.SENATE, Resource.FEX_ANALYTICS, {Permission.READ, Permission.EXPORT}),
        RolePermission(Role.SENATE, Resource.HIGH_SCHOOL_ANALYTICS, {Permission.READ, Permission.EXPORT}),
        RolePermission(Role.SENATE, Resource.PREDICTIONS, {Permission.READ, Permission.EXPORT}),
        RolePermission(Role.SENATE, Resource.PROFILE, {Permission.READ, Permission.UPDATE}),
    ],
    
    Role.SYSADMIN: [
        RolePermission(Role.SYSADMIN, Resource.DASHBOARD, {Permission.READ}),
        RolePermission(Role.SYSADMIN, Resource.ANALYTICS, {Permission.READ, Permission.WRITE, Permission.EXPORT}),
        RolePermission(Role.SYSADMIN, Resource.FEX_ANALYTICS, {Permission.READ, Permission.WRITE, Permission.EXPORT}),
        RolePermission(Role.SYSADMIN, Resource.HIGH_SCHOOL_ANALYTICS, {Permission.READ, Permission.WRITE, Permission.EXPORT}),
        RolePermission(Role.SYSADMIN, Resource.PREDICTIONS, {Permission.READ, Permission.WRITE, Permission.EXPORT, Permission.MANAGE}),
        RolePermission(Role.SYSADMIN, Resource.USER_MANAGEMENT, {Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE, Permission.MANAGE}),
        RolePermission(Role.SYSADMIN, Resource.SYSTEM_SETTINGS, {Permission.READ, Permission.UPDATE, Permission.MANAGE}),
        RolePermission(Role.SYSADMIN, Resource.ETL_JOBS, {Permission.READ, Permission.UPDATE, Permission.MANAGE}),
        RolePermission(Role.SYSADMIN, Resource.AUDIT_LOGS, {Permission.READ, Permission.EXPORT}),
        RolePermission(Role.SYSADMIN, Resource.REPORTS, {Permission.READ, Permission.WRITE, Permission.EXPORT}),
        RolePermission(Role.SYSADMIN, Resource.PROFILE, {Permission.READ, Permission.UPDATE}),
    ],
    
    Role.ANALYST: [
        RolePermission(Role.ANALYST, Resource.DASHBOARD, {Permission.READ, Permission.WRITE}),
        RolePermission(Role.ANALYST, Resource.ANALYTICS, {Permission.READ, Permission.WRITE, Permission.UPDATE, Permission.EXPORT, Permission.SHARE}),
        RolePermission(Role.ANALYST, Resource.REPORTS, {Permission.READ, Permission.WRITE, Permission.EXPORT, Permission.SHARE}),
        RolePermission(Role.ANALYST, Resource.STUDENTS, {Permission.READ}),
        RolePermission(Role.ANALYST, Resource.STAFF, {Permission.READ}),
        RolePermission(Role.ANALYST, Resource.FEX_ANALYTICS, {Permission.READ, Permission.WRITE, Permission.EXPORT}),
        RolePermission(Role.ANALYST, Resource.HIGH_SCHOOL_ANALYTICS, {Permission.READ, Permission.WRITE, Permission.EXPORT}),
        RolePermission(Role.ANALYST, Resource.PREDICTIONS, {Permission.READ, Permission.WRITE, Permission.EXPORT}),
        RolePermission(Role.ANALYST, Resource.PROFILE, {Permission.READ, Permission.UPDATE}),
    ],
    
    Role.STUDENT: [
        RolePermission(Role.STUDENT, Resource.DASHBOARD, {Permission.READ}, scope="own"),
        RolePermission(Role.STUDENT, Resource.ANALYTICS, {Permission.READ}, scope="own"),
        RolePermission(Role.STUDENT, Resource.GRADES, {Permission.READ}, scope="own"),
        RolePermission(Role.STUDENT, Resource.ATTENDANCE, {Permission.READ}, scope="own"),
        RolePermission(Role.STUDENT, Resource.PAYMENTS, {Permission.READ}, scope="own"),
        RolePermission(Role.STUDENT, Resource.ENROLLMENTS, {Permission.READ}, scope="own"),
        RolePermission(Role.STUDENT, Resource.PREDICTIONS, {Permission.READ}, scope="own"),
        RolePermission(Role.STUDENT, Resource.PROFILE, {Permission.READ, Permission.UPDATE}, scope="own"),
    ],
    
    Role.STAFF: [
        RolePermission(Role.STAFF, Resource.DASHBOARD, {Permission.READ}),
        RolePermission(Role.STAFF, Resource.CLASS_ANALYTICS, {Permission.READ, Permission.EXPORT}),
        RolePermission(Role.STAFF, Resource.STUDENTS, {Permission.READ}, scope="classes"),
        RolePermission(Role.STAFF, Resource.GRADES, {Permission.READ, Permission.WRITE}, scope="classes"),
        RolePermission(Role.STAFF, Resource.ATTENDANCE, {Permission.READ, Permission.WRITE}, scope="classes"),
        RolePermission(Role.STAFF, Resource.PREDICTIONS, {Permission.READ}, scope="classes"),
        RolePermission(Role.STAFF, Resource.PROFILE, {Permission.READ, Permission.UPDATE}, scope="own"),
    ],
    
    Role.DEAN: [
        RolePermission(Role.DEAN, Resource.DASHBOARD, {Permission.READ}),
        RolePermission(Role.DEAN, Resource.FACULTY_ANALYTICS, {Permission.READ, Permission.EXPORT}),
        RolePermission(Role.DEAN, Resource.ANALYTICS, {Permission.READ, Permission.EXPORT}, scope="faculty"),
        RolePermission(Role.DEAN, Resource.STUDENTS, {Permission.READ}, scope="faculty"),
        RolePermission(Role.DEAN, Resource.STAFF, {Permission.READ}, scope="faculty"),
        RolePermission(Role.DEAN, Resource.FEX_ANALYTICS, {Permission.READ, Permission.EXPORT}, scope="faculty"),
        RolePermission(Role.DEAN, Resource.HIGH_SCHOOL_ANALYTICS, {Permission.READ, Permission.EXPORT}, scope="faculty"),
        RolePermission(Role.DEAN, Resource.PREDICTIONS, {Permission.READ, Permission.EXPORT}, scope="faculty"),
        RolePermission(Role.DEAN, Resource.PROFILE, {Permission.READ, Permission.UPDATE}),
    ],
    
    Role.HOD: [
        RolePermission(Role.HOD, Resource.DASHBOARD, {Permission.READ}),
        RolePermission(Role.HOD, Resource.DEPARTMENT_ANALYTICS, {Permission.READ, Permission.EXPORT}),
        RolePermission(Role.HOD, Resource.ANALYTICS, {Permission.READ, Permission.EXPORT}, scope="department"),
        RolePermission(Role.HOD, Resource.STUDENTS, {Permission.READ}, scope="department"),
        RolePermission(Role.HOD, Resource.STAFF, {Permission.READ}, scope="department"),
        RolePermission(Role.HOD, Resource.FEX_ANALYTICS, {Permission.READ, Permission.EXPORT}, scope="department"),
        RolePermission(Role.HOD, Resource.HIGH_SCHOOL_ANALYTICS, {Permission.READ, Permission.EXPORT}, scope="department"),
        RolePermission(Role.HOD, Resource.PREDICTIONS, {Permission.READ, Permission.EXPORT}, scope="department"),
        RolePermission(Role.HOD, Resource.PROFILE, {Permission.READ, Permission.UPDATE}),
    ],
    
    Role.HR: [
        RolePermission(Role.HR, Resource.DASHBOARD, {Permission.READ}),
        RolePermission(Role.HR, Resource.HR_ANALYTICS, {Permission.READ, Permission.WRITE, Permission.EXPORT}),
        RolePermission(Role.HR, Resource.STAFF, {Permission.READ, Permission.UPDATE}),
        RolePermission(Role.HR, Resource.PROFILE, {Permission.READ, Permission.UPDATE}),
    ],
    
    Role.FINANCE: [
        RolePermission(Role.FINANCE, Resource.DASHBOARD, {Permission.READ}),
        RolePermission(Role.FINANCE, Resource.FINANCE_ANALYTICS, {Permission.READ, Permission.WRITE, Permission.EXPORT}),
        RolePermission(Role.FINANCE, Resource.PAYMENTS, {Permission.READ, Permission.UPDATE, Permission.EXPORT}),
        RolePermission(Role.FINANCE, Resource.STUDENTS, {Permission.READ}, scope="finance"),
        RolePermission(Role.FINANCE, Resource.PROFILE, {Permission.READ, Permission.UPDATE}),
    ],
}

def has_permission(role: Role, resource: Resource, permission: Permission, 
                  user_scope: Optional[Dict] = None) -> bool:
    """
    Check if a role has a specific permission on a resource
    
    Args:
        role: User's role
        resource: Resource being accessed
        permission: Permission being checked
        user_scope: User's scope data (e.g., {'student_id': 'S23B12/005', 'department_id': 5})
    
    Returns:
        True if permission is granted, False otherwise
    """
    if role not in ROLE_PERMISSIONS:
        return False
    
    for role_perm in ROLE_PERMISSIONS[role]:
        if role_perm.resource == resource and permission in role_perm.permissions:
            # Check scope if specified
            if role_perm.scope:
                if role_perm.scope == "own":
                    # Student can only see their own data
                    if role == Role.STUDENT and user_scope:
                        # Scope check will be done at query level
                        return True
                elif role_perm.scope == "classes":
                    # Staff can see their classes
                    return True
                elif role_perm.scope in ["department", "faculty"]:
                    # HOD/Dean scope check at query level
                    return True
            return True
    
    return False

def get_allowed_resources(role: Role) -> List[Resource]:
    """Get all resources a role can access"""
    if role not in ROLE_PERMISSIONS:
        return []
    return list(set([rp.resource for rp in ROLE_PERMISSIONS[role]]))

def get_role_permissions(role: Role) -> List[RolePermission]:
    """Get all permissions for a role"""
    return ROLE_PERMISSIONS.get(role, [])
