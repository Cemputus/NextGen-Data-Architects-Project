
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

export function getDefaultRoute(role) {
  const key = (role || '').toString().toLowerCase();
  return DEFAULT_ROUTE_BY_ROLE[key] ?? '/dashboard';
}

export function getRoleDashboardNavLabel(role) {
  const key = (role || '').toString().toLowerCase();
  return ROLE_DASHBOARD_NAV_LABEL[key] ?? 'Dashboard';
}

export { DEFAULT_ROUTE_BY_ROLE };
