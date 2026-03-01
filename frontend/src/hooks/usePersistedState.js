/**
 * useState that persists to localStorage so drafts survive hard refresh.
 * Key is prefixed with nextgen_draft_ to avoid clashes.
 * @param {string} key - Storage key (will be prefixed).
 * @param {any} initialValue - Initial value (used if nothing in storage or parse fails).
 * @returns {[any, function]} [value, setValue] - Same API as useState; setValue clears draft when set to initialValue or you can clear storage manually.
 */
import React from 'react';

const PREFIX = 'nextgen_draft_';

function read(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return undefined;
    return JSON.parse(raw);
  } catch (_) {
    return undefined;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
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
