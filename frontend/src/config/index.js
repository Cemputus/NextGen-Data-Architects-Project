/**
 * Central config (Phase 1) — single source for roles, routes, KPIs, and page keys.
 */
export { ROLES, ROLE_LIST, ROLE_FILTER_OPTIONS } from './roles';
export { getDefaultRoute, getRoleDashboardNavLabel, DEFAULT_ROUTE_BY_ROLE } from './routes';
export {
  KPI_OPTIONS,
  CHART_OPTIONS,
  PAGE_CONFIG_KEYS,
  ROLE_DASHBOARD_PAGE_KEYS,
  PAGES_WITH_VISUALS_KEYS,
  PAGE_CONFIG_LABELS,
  KPI_DEFINITIONS,
} from './kpis';
export {
  SPACING,
  CHART_PALETTE,
  CHART_PALETTE_SEQUENTIAL,
  SEMANTIC_COLORS,
} from './designTokens';
