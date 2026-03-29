/**
 * AuthContext — Session security (default: 60-minute active session)
 *
 * Session expiry is ON unless REACT_APP_DISABLE_SESSION_EXPIRY=1 (use that for local/demo without idle/401 rules).
 *
 * When session expiry is enabled:
 *  1. Access token (~60 min) with silent refresh before expiry (see REFRESH_INTERVAL_MS)
 *  2. Idle timeout — same 60 minutes for all roles (no short 25‑min student cut-off)
 *  3. Browser-close clears sessionStorage; localStorage only holds a cross-tab flag
 *  4. Tab focus only resets the idle timer (no profile ping — avoids spurious logouts while navigating)
 *  5. Axios — refresh + retry on 401/422; logout only on confirmed auth failures from the server
 */
import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext();

// Session expiry: off only when explicitly set to "1" (local/demo long sessions without idle rules).
const DISABLE_SESSION_EXPIRY = process.env.REACT_APP_DISABLE_SESSION_EXPIRY === '1';

/** Wall-clock session: keep idle limit aligned with backend JWT access lifetime (60 min). */
const SESSION_MINUTES = 60;
const SESSION_IDLE_MS = SESSION_MINUTES * 60 * 1000; // same for all roles — no surprise early logouts
const IDLE_WARNING_BEFORE_MS = 5 * 60 * 1000; // warn 5 min before idle logout

// Refresh before access token expires (backend: 60 min).
const REFRESH_INTERVAL_MS = 45 * 60 * 1000;

const ACTIVITY_EVENTS = [
  'mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'pointerdown',
  'wheel', 'focusin', // keyboard-only / navigation without mouse move
];

// We store the token in sessionStorage (cleared on tab/browser close) NOT localStorage.
// Only a non-sensitive flag ("session_active") lives in localStorage as a cross-tab signal.
const TOKEN_KEY   = 'ucu_session_token';
const REFRESH_KEY = 'ucu_session_refresh';
const USER_KEY    = 'ucu_session_user';

/** Server returned 401/422 (session/auth). No response ⇒ network/CORS/timeout — not an auth verdict. */
function isUnauthorizedHttp(err) {
  const s = err?.response?.status;
  return s === 401 || s === 422;
}

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

    const timeoutMs = SESSION_IDLE_MS;

    clearTimeout(idleTimerRef.current);
    clearTimeout(warningTimerRef.current);
    setSessionWarning(false);

    if (DISABLE_SESSION_EXPIRY) {
      return;
    }

    const warnAt = Math.max(0, timeoutMs - IDLE_WARNING_BEFORE_MS);
    warningTimerRef.current = setTimeout(() => {
      if (isLoggedInRef.current) setSessionWarning(true);
    }, warnAt);

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
      if (DISABLE_SESSION_EXPIRY) {
        return;
      }
      // Refresh token itself has expired (8h) or server rejected it → logout
      if (isUnauthorizedHttp(err)) {
        logout('expired');
      }
      // No response (network) or other errors: stay logged in; next interval retries
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

  // ── Axios auth interceptor (401/422): refresh once, then optional logout ─────
  useEffect(() => {
    const id = axios.interceptors.response.use(
      (res) => res,
      async (err) => {
        const config = err.config || {};
        const status = err.response?.status;
        const url = config.url || '';

        // Recover expired access token without forcing re-login (single retry).
        if (
          (status === 401 || status === 422) &&
          !config._retryRefresh &&
          sessionStore.get(REFRESH_KEY) &&
          isLoggedInRef.current
        ) {
          const skipAuth =
            url.includes('/api/auth/login') ||
            url.includes('/api/auth/refresh');
          if (!skipAuth) {
            config._retryRefresh = true;
            try {
              const rt = sessionStore.get(REFRESH_KEY);
              const res = await axios.post('/api/auth/refresh', {}, {
                headers: { Authorization: `Bearer ${rt}` },
                timeout: 8000,
              });
              const newTok = res.data?.access_token;
              if (newTok) {
                sessionStore.set(TOKEN_KEY, newTok);
                setToken(newTok);
                axios.defaults.headers.common['Authorization'] = `Bearer ${newTok}`;
                config.headers = config.headers || {};
                config.headers.Authorization = `Bearer ${newTok}`;
                return axios(config);
              }
            } catch (refreshErr) {
              // Refresh failed: only logout if the server rejected the refresh token.
              // Network loss has no err.response — keep session and surface the original error.
              if (!DISABLE_SESSION_EXPIRY && isLoggedInRef.current && isUnauthorizedHttp(refreshErr)) {
                logout('expired');
              }
              return Promise.reject(err);
            }
          }
        }

        // Endpoints that may be long-running or noisy (ETL, admin status/logs/settings).
        const isLongRunningAdminEndpoint =
          url.startsWith('/api/admin/system-status') ||
          url.startsWith('/api/admin/run-etl') ||
          url.startsWith('/api/admin/etl-log') ||
          url.startsWith('/api/admin/audit-logs') ||
          url.startsWith('/api/admin/settings');

        if (
          !DISABLE_SESSION_EXPIRY &&
          !isLongRunningAdminEndpoint &&
          err.response &&
          isUnauthorizedHttp(err) &&
          isLoggedInRef.current
        ) {
          logout('expired');
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, [logout, setToken]);

  // ── Visibility: extend idle timer only (no profile API — avoids surprise logouts while switching tabs)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !isLoggedInRef.current) return;
      resetIdleTimer();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [resetIdleTimer]);

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
          cleanupListeners = startSession();
        } catch (err) {
          if (isUnauthorizedHttp(err)) {
            const rt = sessionStore.get(REFRESH_KEY);
            if (rt) {
              try {
                const refRes = await axios.post('/api/auth/refresh', {}, {
                  headers: { Authorization: `Bearer ${rt}` },
                  timeout: 8000,
                });
                const newTok = refRes.data?.access_token;
                if (newTok) {
                  sessionStore.set(TOKEN_KEY, newTok);
                  axios.defaults.headers.common['Authorization'] = `Bearer ${newTok}`;
                  setToken(newTok);
                  await Promise.race([
                    axios.get('/api/auth/profile'),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
                  ]);
                  cleanupListeners = startSession();
                  return;
                }
              } catch (re) {
                if (isUnauthorizedHttp(re)) {
                  /* refresh rejected — clear session below */
                } else {
                  cleanupListeners = startSession();
                  return;
                }
              }
            }
            sessionStore.clear();
            setToken(null);
            setUserState(null);
            setIsAuthenticated(false);
            isLoggedInRef.current = false;
            delete axios.defaults.headers.common['Authorization'];
          } else {
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
