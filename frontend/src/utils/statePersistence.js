/**
 * State Persistence Utility
 * Saves and restores application state (filters, tabs, drilldown, etc.) to localStorage
 */

const STORAGE_PREFIX = 'ucu_analytics_';

/**
 * Get storage key for a specific page/component
 */
const getStorageKey = (pageName, key) => {
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
    return localStorage.getItem(key) || defaultTab;
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
    return localStorage.getItem(key) || defaultDrilldown;
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
    return localStorage.getItem(key) || defaultSearch;
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

