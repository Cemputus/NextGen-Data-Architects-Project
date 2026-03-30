
import axios from 'axios';

function getAuthHeader() {
  const token = sessionStorage.getItem('ucu_session_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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
