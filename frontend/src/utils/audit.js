/**
 * Client-side audit: send page views and filter actions to the backend for audit logs.
 * Fire-and-forget; does not block UI.
 */
import axios from 'axios';

const getToken = () => localStorage.getItem('token');

export function logAuditEvent(action, resource, resourceId = null) {
  const token = getToken();
  if (!token) return;
  const payload = { action, resource };
  if (resourceId != null && resourceId !== '') payload.resource_id = String(resourceId);
  axios
    .post('/api/auth/audit-event', payload, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 3000,
    })
    .catch(() => {});
}
