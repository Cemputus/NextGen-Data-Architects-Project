/**
 * RoleBasedCharts uses `type` mainly for finance vs academic vs general.
 */
export function getRoleBasedChartsType(role) {
  const r = (role || '').toString().toLowerCase();
  if (r === 'finance') return 'finance';
  return 'general';
}
