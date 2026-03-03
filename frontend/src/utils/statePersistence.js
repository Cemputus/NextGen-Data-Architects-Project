/**
 * State Persistence Utility
 * Saves and restores application state (filters, tabs, drilldown, etc.) to localStorage
 */

const STORAGE_PREFIX = 'ucu_analytics_';

// Derive a per-user key segment from localStorage user info
const getCurrentUserKey = () => {
  try {
    const raw = localStorage.getItem('user');
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

/**
 * Get storage key for a specific page/component (per-user aware).
 * New keys are namespaced by username so each user gets isolated state.
 */
const getStorageKey = (pageName, key) => {
  const userKey = getCurrentUserKey();
  return `${STORAGE_PREFIX}${userKey}_${pageName}_${key}`;
};

// Legacy key format (without per-user namespace) for backward compatibility when loading.
const getLegacyStorageKey = (pageName, key) => {
  return `${STORAGE_PREFIX}${pageName}_${key}`;
};

/**
 * Save state to localStorage
 */
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

/**
 * Load state from localStorage
 */
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

/**
 * Clear saved state for a page
 */
export const clearState = (pageName) => {
  try {
    const key = getStorageKey(pageName, 'state');
    localStorage.removeItem(key);
    // Also clear legacy key if present
    const legacyKey = getLegacyStorageKey(pageName, 'state');
    localStorage.removeItem(legacyKey);
    return true;
  } catch (error) {
    console.warn('Failed to clear state from localStorage:', error);
    return false;
  }
};

/**
 * Save filters specifically
 */
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

/**
 * Load filters specifically
 */
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

/**
 * Save tab selection
 */
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

/**
 * Load tab selection
 */
export const loadTab = (pageName, defaultTab = null) => {
  try {
    const key = getStorageKey(pageName, 'tab');
    const value = localStorage.getItem(key);
    if (value != null) return value;
    // Legacy
    const legacyKey = getLegacyStorageKey(pageName, 'tab');
    return localStorage.getItem(legacyKey) || defaultTab;
  } catch (error) {
    console.warn('Failed to load tab from localStorage:', error);
    return defaultTab;
  }
};

/**
 * Save drilldown selection
 */
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

/**
 * Load drilldown selection
 */
export const loadDrilldown = (pageName, defaultDrilldown = 'overall') => {
  try {
    const key = getStorageKey(pageName, 'drilldown');
    const value = localStorage.getItem(key);
    if (value != null) return value;
    // Legacy
    const legacyKey = getLegacyStorageKey(pageName, 'drilldown');
    return localStorage.getItem(legacyKey) || defaultDrilldown;
  } catch (error) {
    console.warn('Failed to load drilldown from localStorage:', error);
    return defaultDrilldown;
  }
};

/**
 * Save search term
 */
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

/**
 * Load search term
 */
export const loadSearchTerm = (pageName, defaultSearch = '') => {
  try {
    const key = getStorageKey(pageName, 'search');
    const value = localStorage.getItem(key);
    if (value != null) return value;
    // Legacy
    const legacyKey = getLegacyStorageKey(pageName, 'search');
    return localStorage.getItem(legacyKey) || defaultSearch;
  } catch (error) {
    console.warn('Failed to load search term from localStorage:', error);
    return defaultSearch;
  }
};

/**
 * Save complete page state (filters, tab, drilldown, etc.)
 */
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

/**
 * Load complete page state
 */
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

// Note: For React hooks, import React in the component file that uses them

