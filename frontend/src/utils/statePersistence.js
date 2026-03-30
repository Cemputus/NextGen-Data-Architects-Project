
const STORAGE_PREFIX = 'ucu_analytics_';

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
  } catch (error) {
    console.warn('Failed to read current user for state persistence:', error);
    return 'guest';
  }
};

const getStorageKey = (pageName, key) => {
  const userKey = getCurrentUserKey();
  return `${STORAGE_PREFIX}${userKey}_${pageName}_${key}`;
};

const getLegacyStorageKey = (pageName, key) => {
  return `${STORAGE_PREFIX}${pageName}_${key}`;
};

export const saveState = (pageName, state) => {
  try {
    const key = getStorageKey(pageName, 'state');
    localStorage.setItem(key, JSON.stringify(state));
    return true;
  } catch (error) {
    console.warn('Failed to save state to localStorage:', error);
    return false;
  }
};

export const loadState = (pageName, defaultState = {}) => {
  try {
    const key = getStorageKey(pageName, 'state');
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.warn('Failed to load state from localStorage:', error);
  }
  return defaultState;
};

export const clearState = (pageName) => {
  try {
    const key = getStorageKey(pageName, 'state');
    localStorage.removeItem(key);
    
    const legacyKey = getLegacyStorageKey(pageName, 'state');
    localStorage.removeItem(legacyKey);
    return true;
  } catch (error) {
    console.warn('Failed to clear state from localStorage:', error);
    return false;
  }
};

export const saveFilters = (pageName, filters) => {
  try {
    const key = getStorageKey(pageName, 'filters');
    localStorage.setItem(key, JSON.stringify(filters));
    return true;
  } catch (error) {
    console.warn('Failed to save filters to localStorage:', error);
    return false;
  }
};

export const loadFilters = (pageName, defaultFilters = {}) => {
  try {
    const key = getStorageKey(pageName, 'filters');
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.warn('Failed to load filters from localStorage:', error);
  }
  return defaultFilters;
};

export const saveTab = (pageName, tabValue) => {
  try {
    const key = getStorageKey(pageName, 'tab');
    localStorage.setItem(key, tabValue);
    return true;
  } catch (error) {
    console.warn('Failed to save tab to localStorage:', error);
    return false;
  }
};

export const loadTab = (pageName, defaultTab = null) => {
  try {
    const key = getStorageKey(pageName, 'tab');
    const value = localStorage.getItem(key);
    if (value != null) return value;
    
    const legacyKey = getLegacyStorageKey(pageName, 'tab');
    return localStorage.getItem(legacyKey) || defaultTab;
  } catch (error) {
    console.warn('Failed to load tab from localStorage:', error);
    return defaultTab;
  }
};

export const saveDrilldown = (pageName, drilldown) => {
  try {
    const key = getStorageKey(pageName, 'drilldown');
    localStorage.setItem(key, drilldown);
    return true;
  } catch (error) {
    console.warn('Failed to save drilldown to localStorage:', error);
    return false;
  }
};

export const loadDrilldown = (pageName, defaultDrilldown = 'overall') => {
  try {
    const key = getStorageKey(pageName, 'drilldown');
    const value = localStorage.getItem(key);
    if (value != null) return value;
    
    const legacyKey = getLegacyStorageKey(pageName, 'drilldown');
    return localStorage.getItem(legacyKey) || defaultDrilldown;
  } catch (error) {
    console.warn('Failed to load drilldown from localStorage:', error);
    return defaultDrilldown;
  }
};

export const saveSearchTerm = (pageName, searchTerm) => {
  try {
    const key = getStorageKey(pageName, 'search');
    localStorage.setItem(key, searchTerm);
    return true;
  } catch (error) {
    console.warn('Failed to save search term to localStorage:', error);
    return false;
  }
};

export const loadSearchTerm = (pageName, defaultSearch = '') => {
  try {
    const key = getStorageKey(pageName, 'search');
    const value = localStorage.getItem(key);
    if (value != null) return value;
    
    const legacyKey = getLegacyStorageKey(pageName, 'search');
    return localStorage.getItem(legacyKey) || defaultSearch;
  } catch (error) {
    console.warn('Failed to load search term from localStorage:', error);
    return defaultSearch;
  }
};

export const savePageState = (pageName, state) => {
  const stateToSave = {
    filters: state.filters || {},
    tab: state.tab || null,
    drilldown: state.drilldown || null,
    searchTerm: state.searchTerm || '',
    timestamp: new Date().toISOString()
  };
  return saveState(pageName, stateToSave);
};

export const loadPageState = (pageName, defaultState = {}) => {
  const saved = loadState(pageName, defaultState);
  return {
    filters: saved.filters || defaultState.filters || {},
    tab: saved.tab || defaultState.tab || null,
    drilldown: saved.drilldown || defaultState.drilldown || null,
    searchTerm: saved.searchTerm || defaultState.searchTerm || '',
    ...saved
  };
};
