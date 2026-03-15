/**
 * API service layer (Phase 1 — separation of concerns).
 * Pages and containers should prefer calling these functions instead of raw axios.
 * Add new endpoints here or in domain-specific files (e.g. services/dashboards.js) as the app grows.
 */
import axios from 'axios';

function getAuthHeader() {
  const token = sessionStorage.getItem('ucu_session_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Auth
 */
export async function login(identifier, password) {
  const { data } = await axios.post('/api/auth/login', { identifier, password });
  return data;
}

export async function refreshSession(refreshToken) {
  const { data } = await axios.post('/api/auth/refresh', {}, {
    headers: { Authorization: `Bearer ${refreshToken}` },
    timeout: 8000,
  });
  return data;
}

/**
 * Dashboards (current for role, custom list, swap)
 */
export async function getCurrentDashboard() {
  const { data } = await axios.get('/api/dashboards/current', {
    headers: getAuthHeader(),
  });
  return data;
}

export async function getDashboardManagerCurrent() {
  const { data } = await axios.get('/api/dashboard-manager/current', {
    headers: getAuthHeader(),
  });
  return data;
}

export async function getCustomDashboards(params = {}) {
  const { data } = await axios.get('/api/dashboard-manager/custom', {
    headers: getAuthHeader(),
    params,
  });
  return data;
}

export async function createDashboard(payload) {
  const { data } = await axios.post('/api/dashboards', payload, {
    headers: getAuthHeader(),
  });
  return data;
}

/**
 * User management (sysadmin)
 */
export async function listUsers(params = {}) {
  const { data } = await axios.get('/api/user-mgmt/users', {
    headers: getAuthHeader(),
    params,
  });
  return data;
}

export async function getUser(userType, userId) {
  const { data } = await axios.get(
    `/api/user-mgmt/users/${userType}/${encodeURIComponent(userId)}`,
    { headers: getAuthHeader() }
  );
  return data;
}
