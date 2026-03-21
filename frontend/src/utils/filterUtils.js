/**
 * Normalize filters sent to analytics/dashboard APIs.
 * Drops empty / "all" / placeholder values so "clear all" = institution-wide (or role) scope.
 */
const PLACEHOLDER = new Set(['', 'all', 'none', 'null', 'undefined', 'select faculty first', 'select department first']);

function isBlankFilterValue(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase();
    if (t === '') return true;
    if (PLACEHOLDER.has(t)) return true;
  }
  return false;
}

/**
 * @param {Record<string, unknown>|null|undefined} input
 * @returns {Record<string, unknown>}
 */
export function sanitizeDashboardFilters(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (isBlankFilterValue(v)) continue;
    out[k] = v;
  }
  return out;
}
