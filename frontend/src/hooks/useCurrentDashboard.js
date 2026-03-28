import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

/**
 * Loads the authenticated user's current role dashboard from GET /api/dashboards/current.
 * When an analyst assigns a dashboard in Dashboard Manager, end users see it on next load or refresh.
 */
export function useCurrentDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [definition, setDefinition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem('ucu_session_token');
      if (!token) {
        setDashboard(null);
        setDefinition(null);
        setError(null);
        return;
      }
      const resp = await axios.get('/api/dashboards/current', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dash = resp.data?.dashboard;
      setDashboard(dash || null);
      if (!dash?.definition) {
        setDefinition(null);
      } else {
        let def = dash.definition;
        if (typeof def === 'string') {
          try {
            def = JSON.parse(def);
          } catch {
            def = null;
          }
        }
        setDefinition(def && typeof def === 'object' ? def : null);
      }
      setError(null);
    } catch (e) {
      setError(e);
      setDashboard(null);
      setDefinition(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onFocus = () => load();
    const onDashboardEvent = () => load();
    window.addEventListener('focus', onFocus);
    window.addEventListener('ucu-dashboard-current-changed', onDashboardEvent);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('ucu-dashboard-current-changed', onDashboardEvent);
    };
  }, [load]);

  const hasCurrentAssignment = Boolean(dashboard?.id);

  return {
    dashboard,
    definition,
    loading,
    error,
    refresh: load,
    hasCurrentAssignment,
  };
}
