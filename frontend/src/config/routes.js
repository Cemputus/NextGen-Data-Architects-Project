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

/** Primary dashboard nav label per role (matches `LayoutModern` sidebar). */
const ROLE_DASHBOARD_NAV_LABEL = {
  [ROLES.STUDENT]: 'Dashboard',
  [ROLES.STAFF]: 'Dashboard',
  [ROLES.HOD]: 'Dashboard',
  [ROLES.DEAN]: 'Dashboard',
  [ROLES.SENATE]: 'Dashboard',
  [ROLES.ANALYST]: 'Workspace',
  [ROLES.SYSADMIN]: 'Console',
  admin: 'Console',
  [ROLES.HR]: 'Dashboard',
  [ROLES.FINANCE]: 'Dashboard',
};

/**
 * @param {string} [role]
 * @returns {string} Default path for the role
 */
export function getDefaultRoute(role) {
  const key = (role || '').toString().toLowerCase();
  return DEFAULT_ROUTE_BY_ROLE[key] ?? '/dashboard';
}

/**
 * @param {string} [role]
 * @returns {string} Nav label for that role’s home dashboard (Dashboard | Workspace | Console)
 */
export function getRoleDashboardNavLabel(role) {
  const key = (role || '').toString().toLowerCase();
  return ROLE_DASHBOARD_NAV_LABEL[key] ?? 'Dashboard';
}

export { DEFAULT_ROUTE_BY_ROLE };
