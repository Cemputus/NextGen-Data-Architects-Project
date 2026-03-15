/**
 * Default route per role and route map (Phase 1 central config).
 * Used by App.js redirects and LayoutModern nav.
 */
import { ROLES } from './roles';

const DEFAULT_ROUTE_BY_ROLE = {
  [ROLES.SENATE]: '/senate/dashboard',
  [ROLES.SYSADMIN]: '/admin/dashboard',
  admin: '/admin/dashboard',
  [ROLES.ANALYST]: '/analyst/dashboard',
  [ROLES.STUDENT]: '/student/dashboard',
  [ROLES.STAFF]: '/staff/dashboard',
  [ROLES.DEAN]: '/dean/dashboard',
  [ROLES.HOD]: '/hod/dashboard',
  [ROLES.HR]: '/hr/dashboard',
  [ROLES.FINANCE]: '/finance/dashboard',
};

/**
 * @param {string} [role]
 * @returns {string} Default path for the role
 */
export function getDefaultRoute(role) {
  const key = (role || '').toString().toLowerCase();
  return DEFAULT_ROUTE_BY_ROLE[key] ?? '/dashboard';
}

export { DEFAULT_ROUTE_BY_ROLE };
