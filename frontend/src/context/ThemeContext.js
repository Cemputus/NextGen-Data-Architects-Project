/**
 * Theme context: light / dark / system for all users.
 * Persists preference in localStorage and applies .dark class to document root.
 */
import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';

const STORAGE_KEY = 'theme-preference';

const ThemeContext = createContext();

function getSystemTheme() {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch (_) {}
  return 'system';
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(() => getStoredTheme());
  const [systemDark, setSystemDark] = useState(getSystemTheme);

  const effectiveTheme = useMemo(() => {
    if (preference === 'system') return systemDark;
    return preference;
  }, [preference, systemDark]);

  useEffect(() => {
    const root = document.documentElement;
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [effectiveTheme]);

  useEffect(() => {
    const media = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    if (!media) return;
    const listener = () => setSystemDark(getSystemTheme());
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  const setPreference = (value) => {
    if (value !== 'light' && value !== 'dark' && value !== 'system') return;
    setPreferenceState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (_) {}
  };

  const value = useMemo(
    () => ({
      theme: preference,
      effectiveTheme,
      setTheme: setPreference,
    }),
    [preference, effectiveTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
