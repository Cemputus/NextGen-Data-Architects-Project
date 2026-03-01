/**
 * Persistent toasts: stored in localStorage so they survive hard refresh.
 * On mount, toasts are replayed; dismiss removes from storage.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'persistent_toasts';
const MAX_TOASTS = 20;

const PersistentToastContext = createContext(null);

export function usePersistentToast() {
  const ctx = useContext(PersistentToastContext);
  return ctx || { addToast: () => {}, dismissToast: () => {}, toasts: [] };
}

export function PersistentToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list) && list.length > 0) {
        setToasts(list.slice(-MAX_TOASTS));
      }
    } catch {
      setToasts([]);
    }
  }, []);

  const save = useCallback((next) => {
    setToasts(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(-MAX_TOASTS)));
    } catch (_) { /* persist failed */ }
  }, []);

  const addToast = useCallback((message, type = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const item = { id, message, type, createdAt: new Date().toISOString() };
    setToasts((prev) => {
      const next = [...prev, item].slice(-MAX_TOASTS);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (_) { /* persist failed */ }
      return next;
    });
    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => {
      const next = prev.filter((t) => t.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (_) { /* persist failed */ }
      return next;
    });
  }, []);

  return (
    <PersistentToastContext.Provider value={{ toasts, addToast, dismissToast }}>
      {children}
      <PersistentToastList toasts={toasts} onDismiss={dismissToast} />
    </PersistentToastContext.Provider>
  );
}

function PersistentToastList({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-auto">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={`
            rounded-lg border px-4 py-3 shadow-lg text-sm flex items-start justify-between gap-2
            ${t.type === 'error' ? 'bg-destructive/10 border-destructive/30 text-destructive' : ''}
            ${t.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400' : ''}
            ${t.type === 'info' ? 'bg-primary/10 border-primary/30 text-foreground' : ''}
          `}
        >
          <span className="flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="shrink-0 opacity-70 hover:opacity-100 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
