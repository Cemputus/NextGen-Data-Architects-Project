/**
 * RBAC role constants (Phase 1 central config).
 * Align with backend backend/rbac.py Role enum and backend/config/constants.py RBAC_ROLES.
 */
export const ROLES = {
  SENATE: 'senate',
  SYSADMIN: 'sysadmin',
  ANALYST: 'analyst',
  STUDENT: 'student',
  STAFF: 'staff',
  DEAN: 'dean',
  HOD: 'hod',
  HR: 'hr',
  FINANCE: 'finance',
};

export const ROLE_LIST = [
  'student',
  'staff',
  'hod',
  'dean',
  'senate',
  'finance',
  'hr',
  'analyst',
  'sysadmin',
];

/** Roles shown in dashboard manager role filter (excludes admin alias). */
export const ROLE_FILTER_OPTIONS = [
  'student',
  'staff',
  'analyst',
  'sysadmin',
  'dean',
  'hod',
  'finance',
  'hr',
  'senate',
];
