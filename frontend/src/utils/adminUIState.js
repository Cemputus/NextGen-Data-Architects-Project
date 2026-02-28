/**
 * Persistent admin UI state (filters, limits, tabs, pagination).
 * Survives hard refresh. Single localStorage key for all admin preferences.
 */
const STORAGE_KEY = 'admin_ui_state';

const DEFAULTS = {
  etl: {
    runsLimit: 10,
    perPage: 20,
    page: 1,
  },
  notifications: {
    limit: 50,
    perPage: 20,
    page: 1,
  },
  audit: {
    limit: 10,
    searchTerm: '',
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
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
