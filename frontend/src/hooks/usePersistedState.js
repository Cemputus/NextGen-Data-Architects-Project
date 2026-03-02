/**
 * useState that persists to localStorage so drafts survive hard refresh.
 * Key is prefixed with nextgen_draft_ to avoid clashes.
 * @param {string} key - Storage key (will be prefixed).
 * @param {any} initialValue - Initial value (used if nothing in storage or parse fails).
 * @returns {[any, function]} [value, setValue] - Same API as useState; setValue clears draft when set to initialValue or you can clear storage manually.
 */
import React from 'react';

const PREFIX = 'nextgen_draft_';

function getCurrentUserKey() {
  try {
    const raw = localStorage.getItem('user');
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
    // Fallback to legacy key (without user scoping) for older drafts
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
  } catch (_) { /* ignore */ }
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
