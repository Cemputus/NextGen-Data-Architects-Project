/**
 * Frontend RBAC utilities (Phase 1: uses central config for roles and default route).
 */
import { ROLES, getDefaultRoute } from '../config';

export const rbac = {
  roles: ROLES,

  canAccess: (userRole, resource, permission = 'read') => {
    // Simplified frontend check - full validation on backend
    const permissions = {
      senate: ['dashboard', 'analytics', 'reports', 'fex', 'high-school', 'profile'],
      sysadmin: ['dashboard', 'users', 'settings', 'etl', 'audit', 'profile'],
      analyst: ['dashboard', 'analytics', 'fex', 'high-school', 'reports', 'profile'],
      student: ['dashboard', 'grades', 'attendance', 'payments', 'profile'],
      staff: ['dashboard', 'classes', 'analytics', 'profile'],
      dean: ['dashboard', 'analytics', 'fex', 'high-school', 'profile'],
      hod: ['dashboard', 'assign-classes', 'analytics', 'fex', 'high-school', 'profile'],
      hr: ['dashboard', 'analytics', 'staff', 'profile'],
      finance: ['dashboard', 'analytics', 'payments', 'profile'],
    };

    return permissions[userRole]?.includes(resource) || false;
  },

  getDefaultRoute,
};
