
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

export function sanitizeDashboardFilters(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (isBlankFilterValue(v)) continue;
    out[k] = v;
  }
  return out;
}

const DASHBOARD_PARAM_KEYS = new Set([
  'faculty_id',
  'department_id',
  'program_id',
  'semester_id',
  'course_code',
  'intake_year',
  'high_school',
  'year_of_study',
  'access_number',
  'reg_number',
  'student_name',
]);

export function buildDashboardQueryParams(filters) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) return {};
  const out = {};
  for (const k of DASHBOARD_PARAM_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(filters, k)) continue;
    const v = filters[k];
    if (isBlankFilterValue(v)) continue;
    out[k] = v;
  }
  return out;
}
