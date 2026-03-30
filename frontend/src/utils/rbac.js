
import { ROLES, getDefaultRoute } from '../config';

export const rbac = {
  roles: ROLES,

  canAccess: (userRole, resource, permission = 'read') => {
    
    const permissions = {
      senate: ['dashboard', 'reports', 'fex', 'profile'],
      sysadmin: ['dashboard', 'users', 'settings', 'etl', 'audit', 'profile'],
      analyst: ['dashboard', 'fex', 'reports', 'profile'],
      student: ['dashboard', 'grades', 'attendance', 'payments', 'profile'],
      staff: ['dashboard', 'classes', 'profile'],
      dean: ['dashboard', 'fex', 'profile'],
      hod: ['dashboard', 'assign-classes', 'fex', 'profile'],
      hr: ['dashboard', 'staff', 'profile'],
      finance: ['dashboard', 'payments', 'profile'],
    };

    return permissions[userRole]?.includes(resource) || false;
  },

  getDefaultRoute,
};
