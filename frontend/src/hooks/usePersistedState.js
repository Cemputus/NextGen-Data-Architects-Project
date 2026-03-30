
import React from 'react';

const PREFIX = 'nextgen_draft_';

function getCurrentUserKey() {
  
  try {
    if (typeof window === 'undefined') return 'guest';
    const raw = window.sessionStorage.getItem('ucu_session_user');
    if (!raw) return 'guest';
    const parsed = JSON.parse(raw);
    const username =
      (parsed?.username ||
        parsed?.access_number ||
        parsed?.id ||
        '').toString().trim().toLowerCase();
    return username || 'guest';
  } catch (_) {
    return 'guest';
  }
}

function storageKey(key) {
  const userKey = getCurrentUserKey();
  return `${PREFIX}${userKey}_${key}`;
}

function legacyStorageKey(key) {
  return PREFIX + key;
}

function read(key) {
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (raw != null) return JSON.parse(raw);
    
    const legacyRaw = localStorage.getItem(legacyStorageKey(key));
    if (legacyRaw == null) return undefined;
    return JSON.parse(legacyRaw);
  } catch (_) {
    return undefined;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(value));
  } catch (_) {  }
}

export function usePersistedState(key, initialValue) {
  const [value, setValueState] = React.useState(() => {
    const stored = read(key);
    return stored !== undefined ? stored : initialValue;
  });

  const setValue = React.useCallback(
    (next) => {
      setValueState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        write(key, resolved);
        return resolved;
      });
    },
    [key]
  );

  return [value, setValue];
}

export default usePersistedState;
