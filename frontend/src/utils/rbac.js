/**
 * Frontend RBAC utilities
 */
export const rbac = {
  roles: {
    SENATE: 'senate',
    SYSADMIN: 'sysadmin',
    ANALYST: 'analyst',
    STUDENT: 'student',
    STAFF: 'staff',
    DEAN: 'dean',
    HOD: 'hod',
    HR: 'hr',
    FINANCE: 'finance',
  },

  canAccess: (userRole, resource, permission = 'read') => {
    // Simplified frontend check - full validation on backend
    const permissions = {
      senate: ['dashboard', 'analytics', 'reports', 'fex', 'high-school', 'profile'],
      sysadmin: ['dashboard', 'users', 'settings', 'etl', 'audit', 'profile'],
      analyst: ['dashboard', 'analytics', 'fex', 'high-school', 'reports', 'profile'],
      student: ['dashboard', 'grades', 'attendance', 'payments', 'profile'],
      staff: ['dashboard', 'classes', 'analytics', 'profile'],
      dean: ['dashboard', 'analytics', 'fex', 'high-school', 'profile'],
      hod: ['dashboard', 'analytics', 'fex', 'high-school', 'profile'],
      hr: ['dashboard', 'analytics', 'staff', 'profile'],
      finance: ['dashboard', 'analytics', 'payments', 'profile'],
    };

    return permissions[userRole]?.includes(resource) || false;
  },

  getDefaultRoute: (role) => {
    const routes = {
      senate: '/senate/dashboard',
      sysadmin: '/admin/dashboard',
      analyst: '/analyst/dashboard',
      student: '/student/dashboard',
      staff: '/staff/dashboard',
      dean: '/dean/dashboard',
      hod: '/hod/dashboard',
      hr: '/hr/dashboard',
      finance: '/finance/dashboard',
    };
    return routes[role] || '/dashboard';
  },
};


