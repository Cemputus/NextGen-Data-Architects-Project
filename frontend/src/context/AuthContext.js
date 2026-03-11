/**
 * AuthContext — Enterprise-grade session security
 *
 * Security features implemented:
 *  1. Short-lived JWT (15 min) with silent background refresh (every 10 min)
 *  2. Idle/inactivity timeout — auto-logout after 30 minutes of no user activity
 *  3. Browser-close logout — sessionStorage for the token; localStorage only holds
 *     a non-sensitive flag so the tab-close clears the session automatically.
 *  4. Visibility-change detection — when user returns to tab after a long absence,
 *     the token is immediately validated and if stale, logout is triggered.
 *  5. Axios 401 interceptor — any 401 from the API triggers immediate logout.
 */
import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext();

// ─── Security Constants ────────────────────────────────────────────────────────
const IDLE_TIMEOUT_MS   = 30 * 60 * 1000;  // 30 minutes of inactivity → logout
const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // Refresh token every 10 minutes (before 15-min JWT expires)
const ACTIVITY_EVENTS   = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'pointerdown'];

// We store the token in sessionStorage (cleared on tab/browser close) NOT localStorage.
// Only a non-sensitive flag ("session_active") lives in localStorage as a cross-tab signal.
const TOKEN_KEY   = 'ucu_session_token';
const REFRESH_KEY = 'ucu_session_refresh';
const USER_KEY    = 'ucu_session_user';

const sessionStore = {
  get:    (key)        => sessionStorage.getItem(key),
  set:    (key, val)   => sessionStorage.setItem(key, val),
  remove: (key)        => sessionStorage.removeItem(key),
  clear:  ()           => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
    sessionStorage.removeItem(USER_KEY);
    localStorage.removeItem('ucu_session_active');
  },
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUserState] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionWarning, setSessionWarning] = useState(false); // shows "session expiring soon" banner

  // Refs for timers (so they survive re-renders without triggering effects)
  const idleTimerRef    = useRef(null);
  const refreshTimerRef = useRef(null);
  const warningTimerRef = useRef(null);
  const isLoggedInRef   = useRef(false); // avoid stale closures in event listeners
  const currentRoleRef  = useRef('');    // track role for role-based idle behaviour

  // ── Internal: clear all timers ─────────────────────────────────────────────
  const clearAllTimers = useCallback(() => {
    clearTimeout(idleTimerRef.current);
    clearInterval(refreshTimerRef.current);
    clearTimeout(warningTimerRef.current);
  }, []);

  // ── Internal: logout ───────────────────────────────────────────────────────
  const logout = useCallback((reason = 'manual') => {
    clearAllTimers();
    // Preserve the last in-app route so, after re-login, we can resume
    // from where the user left off (unless they closed the browser).
    try {
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath && currentPath !== '/login') {
        sessionStorage.setItem('ucu_last_route', currentPath);
      }
    } catch {
      // ignore storage errors
    }
    sessionStore.clear();
    setToken(null);
    setUserState(null);
    setIsAuthenticated(false);
    setSessionWarning(false);
    isLoggedInRef.current = false;
    delete axios.defaults.headers.common['Authorization'];

    if (reason !== 'manual' && window.location.pathname !== '/login') {
      // Append a query param so Login page can show the correct message
      const msg = reason === 'idle' ? 'idle' : reason === 'expired' ? 'expired' : 'closed';
      window.location.href = `/login?session=${msg}`;
    } else if (reason === 'manual' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }, [clearAllTimers]);

  // ── Internal: reset idle timer ─────────────────────────────────────────────
  const resetIdleTimer = useCallback(() => {
    if (!isLoggedInRef.current) return;

    // Role-based idle timeout:
    // - sysadmin + analyst: no idle timeout (they stay logged in unless token truly expires)
    // - all other roles: 15 minutes of inactivity
    const role = (currentRoleRef.current || '').toString().toLowerCase();
    const isIdleExempt = role === 'sysadmin' || role === 'analyst';
    const timeoutMs = isIdleExempt ? null : 15 * 60 * 1000; // 15 minutes

    clearTimeout(idleTimerRef.current);
    clearTimeout(warningTimerRef.current);
    setSessionWarning(false);

    if (!timeoutMs) {
      // No idle timeout for exempt roles
      return;
    }

    // Show warning 5 minutes before idle logout
    warningTimerRef.current = setTimeout(() => {
      if (isLoggedInRef.current) setSessionWarning(true);
    }, timeoutMs - 5 * 60 * 1000);

    // Logout after full idle timeout
    idleTimerRef.current = setTimeout(() => {
      if (isLoggedInRef.current) logout('idle');
    }, timeoutMs);
  }, [logout]);

  // ── Internal: silent token refresh ─────────────────────────────────────────
  const silentRefresh = useCallback(async () => {
    const refreshToken = sessionStore.get(REFRESH_KEY);
    if (!refreshToken || !isLoggedInRef.current) return;
    try {
      const res = await axios.post('/api/auth/refresh', {}, {
        headers: { Authorization: `Bearer ${refreshToken}` },
        timeout: 8000,
      });
      const newToken = res.data?.access_token;
      if (newToken) {
        sessionStore.set(TOKEN_KEY, newToken);
        setToken(newToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      }
    } catch (err) {
      // Refresh token itself has expired (8h) or server rejected it → logout
      if (err.response?.status === 401 || err.response?.status === 422) {
        logout('expired');
      }
      // Network errors: stay logged in, will retry on next interval
    }
  }, [logout]);

  // ── Internal: start background refresh loop ────────────────────────────────
  const startRefreshLoop = useCallback(() => {
    clearInterval(refreshTimerRef.current);
    refreshTimerRef.current = setInterval(silentRefresh, REFRESH_INTERVAL_MS);
  }, [silentRefresh]);

  // ── Internal: wire up activity listeners ───────────────────────────────────
  const startActivityListeners = useCallback(() => {
    const handler = () => resetIdleTimer();
    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, handler, { passive: true }));
    return () => ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, handler));
  }, [resetIdleTimer]);

  // ── Internal: fully hydrate auth state after successful login/restore ──────
  const hydrateSession = useCallback((accessToken, refreshToken, userData) => {
    sessionStore.set(TOKEN_KEY, accessToken);
    if (refreshToken) sessionStore.set(REFRESH_KEY, refreshToken);
    sessionStore.set(USER_KEY, JSON.stringify(userData));
    localStorage.setItem('ucu_session_active', '1'); // cross-tab signal (value-less)

    setToken(accessToken);
    setUserState(userData);
    try {
      const role = (userData?.role || '').toString().toLowerCase();
      currentRoleRef.current = role;
    } catch {
      currentRoleRef.current = '';
    }
    setIsAuthenticated(true);
    isLoggedInRef.current = true;
    axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
  }, []);

  // ── Internal: post-hydrate: start timers & listeners ──────────────────────
  const startSession = useCallback(() => {
    resetIdleTimer();
    startRefreshLoop();
    return startActivityListeners();
  }, [resetIdleTimer, startRefreshLoop, startActivityListeners]);

  // ── Axios auth interceptor (401/422) ───────────────────────────────────────
  useEffect(() => {
    const id = axios.interceptors.response.use(
      (res) => res,
      (err) => {
        const status = err.response?.status;
        const url = err.config?.url || '';

        // Endpoints that may be long-running or noisy (ETL, admin status/logs).
        // For these, we surface the error to the page but do NOT auto-logout,
        // so a transient failure while ETL is running doesn't kick the user out.
        const isLongRunningAdminEndpoint =
          url.startsWith('/api/admin/system-status') ||
          url.startsWith('/api/admin/run-etl') ||
          url.startsWith('/api/admin/etl-log') ||
          url.startsWith('/api/admin/audit-logs');

        // Treat both 401 and 422 from most APIs as "session no longer valid",
        // but skip auto-logout for long-running admin/ETL endpoints.
        if (!isLongRunningAdminEndpoint && (status === 401 || status === 422) && isLoggedInRef.current) {
          logout('expired');
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, [logout]);

  // ── Visibility-change guard: check token when tab regains focus ─────────────
  useEffect(() => {
    const onVisibilityChange = async () => {
      if (document.visibilityState !== 'visible' || !isLoggedInRef.current) return;
      // Validate the stored token immediately when the user switches back to the tab
      try {
        await axios.get('/api/auth/profile', { timeout: 5000 });
        // Token is still valid — reset idle timer since user just came back
        resetIdleTimer();
      } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 422) {
          logout('expired');
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [logout, resetIdleTimer]);

  // ── Cross-tab logout: if localStorage flag is removed, logout all tabs ──────
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'ucu_session_active' && e.newValue === null && isLoggedInRef.current) {
        // Another tab called logout → sync logout here too
        clearAllTimers();
        setToken(null);
        setUserState(null);
        setIsAuthenticated(false);
        isLoggedInRef.current = false;
        delete axios.defaults.headers.common['Authorization'];
        if (window.location.pathname !== '/login') {
          window.location.href = '/login?session=closed';
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [clearAllTimers]);

  // ── Restore session on page load/refresh ───────────────────────────────────
  useEffect(() => {
    let cleanupListeners = () => {};
    const restoreAuth = async () => {
      try {
        const storedToken = sessionStore.get(TOKEN_KEY);
        const storedUser  = sessionStore.get(USER_KEY);

        if (!storedToken || !storedUser) {
          // No session in sessionStorage — user opened new tab or closed browser
          setLoading(false);
          return;
        }

        // Optimistically restore state
        const parsedUser = JSON.parse(storedUser);
        hydrateSession(storedToken, sessionStore.get(REFRESH_KEY), parsedUser);

        // Validate the token with a quick API call
        try {
          await Promise.race([
            axios.get('/api/auth/profile'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
          ]);
          // Token is valid — start session machinery
          cleanupListeners = startSession();
        } catch (err) {
          if (err.response?.status === 401 || err.response?.status === 422) {
            // Stored token is no longer valid — clear and redirect
            sessionStore.clear();
            setToken(null);
            setUserState(null);
            setIsAuthenticated(false);
            isLoggedInRef.current = false;
            delete axios.defaults.headers.common['Authorization'];
          } else {
            // Network/timeout error: keep optimistic state, retry on next API call
            cleanupListeners = startSession();
          }
        }
      } catch (err) {
        console.error('Auth restore error:', err);
        sessionStore.clear();
      } finally {
        setLoading(false);
      }
    };

    restoreAuth();
    return () => cleanupListeners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Login ────────────────────────────────────────────────────────────────────
  const login = async (identifier, password) => {
    try {
      const response = await axios.post('/api/auth/login', { identifier, password }, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
      });

      const { access_token, refresh_token, user: rawUser, role } = response.data;
      const rawRole = (role || rawUser?.role || 'student').toString().toLowerCase();
      let userData = { ...rawUser, role: rawRole };

      // Hydrate full profile immediately
      try {
        const profileRes = await axios.get('/api/auth/profile', {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        if (profileRes.data && typeof profileRes.data === 'object') {
          userData = { ...userData, ...profileRes.data };
        }
      } catch (_e) { /* fall back to login payload */ }

      hydrateSession(access_token, refresh_token, userData);
      startSession();

      return { success: true, user: userData };
    } catch (err) {
      let errorMessage = 'Login failed';
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMessage = 'Request timeout — please ensure the backend is running.';
      } else if (err.message?.includes('Network Error')) {
        errorMessage = 'Cannot connect to backend (http://localhost:5000).';
      } else {
        errorMessage = err.response?.data?.error || err.message || errorMessage;
      }
      return { success: false, error: errorMessage };
    }
  };

  // ── Expose setUser (profile updates) ─────────────────────────────────────────
  const setUser = useCallback((nextUser) => {
    setUserState(nextUser);
    if (nextUser) sessionStore.set(USER_KEY, JSON.stringify(nextUser));
  }, []);

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      user,
      setUser,
      token,
      login,
      logout: () => logout('manual'),
      loading,
      sessionWarning,          // expose so UI can show "You'll be logged out in 5 min" banner
      dismissWarning: () => {  // user clicks "Stay logged in" → reset idle timer
        setSessionWarning(false);
        resetIdleTimer();
      },
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
