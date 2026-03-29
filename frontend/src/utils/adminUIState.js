/**
 * Persistent admin UI state (filters, limits, tabs, pagination).
 * Survives hard refresh. Scoped per logged-in admin user so different admins
 * (or users with the same role) do not share filters or preferences.
 */
const STORAGE_PREFIX = 'admin_ui_state_';

const getCurrentUserKey = () => {
  try {
    if (typeof window === 'undefined') return 'guest';
    const raw = window.sessionStorage.getItem('ucu_session_user');
    if (!raw) return 'guest';
    const parsed = JSON.parse(raw);
    const username =
      (parsed?.username ||
        parsed?.access_number ||
        parsed?.id ||
        '').toString().trim().toLowerCase();
    return username || 'guest';
  } catch {
    return 'guest';
  }
};

const storageKey = () => `${STORAGE_PREFIX}${getCurrentUserKey()}`;

const DEFAULTS = {
  etl: {
    runsLimit: 300,
    perPage: 20,
    page: 1,
    dataViewMode: 'raw', // 'raw' | 'visual'
    warehouseFilter: '',
    etlStatusFilter: 'all', // 'all' | 'success' | 'failed'
  },
  notifications: {
    limit: 5,
    perPage: 20,
    page: 1,
  },
  audit: {
    limit: 10,
    searchTerm: '',
    dataViewMode: 'raw', // 'raw' | 'visual'
    chartGroupBy: 'action', // 'action' | 'resource' | 'user' | 'role' | 'status'
  },
  users: {
    limit: 50,
    roleFilter: '',
    searchTerm: '',
  },
  settings: {
    activeTab: 'general',
  },
  dashboard: {},
  /** HR Staff Management page — same visual/raw pattern as ETL & Audit */
  hrStaff: {
    dataViewMode: 'raw', // 'raw' | 'visual'
  },
};

function load() {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return { ...JSON.parse(JSON.stringify(DEFAULTS)) };
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...JSON.parse(JSON.stringify(DEFAULTS)) };
    return deepMerge(JSON.parse(JSON.stringify(DEFAULTS)), parsed);
  } catch {
    return { ...JSON.parse(JSON.stringify(DEFAULTS)) };
  }
}

function deepMerge(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] != null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      out[key] = deepMerge(out[key] || {}, source[key]);
    } else if (source[key] !== undefined) {
      out[key] = source[key];
    }
  }
  return out;
}

function save(state) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(state));
  } catch (e) {
    console.warn('[adminUIState] Failed to persist:', e);
  }
}

let _cache = null;

function getState() {
  if (_cache == null) _cache = load();
  return _cache;
}

function getSection(section) {
  const state = getState();
  return state[section] != null ? { ...DEFAULTS[section], ...state[section] } : { ...DEFAULTS[section] };
}

function setSection(section, updates) {
  const state = getState();
  const next = { ...state, [section]: { ...(state[section] || DEFAULTS[section]), ...updates } };
  _cache = next;
  save(next);
}

function get(section, key) {
  const sec = getSection(section);
  return sec[key];
}

function set(section, key, value) {
  setSection(section, { [key]: value });
}

export default {
  getState,
  getSection,
  setSection,
  get,
  set,
  DEFAULTS,
};
