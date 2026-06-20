import { useCallback, useState } from 'react';

// Persists a small UI preference in localStorage with a safe fallback when storage is
// unavailable (private mode, quota, SSR). Generic and domain-agnostic, hence in shared.
// The storage key is expected to be stable for the lifetime of the consuming component.
export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? defaultValue : (JSON.parse(raw) as T);
    } catch {
      return defaultValue;
    }
  });

  const setValue = useCallback(
    (value: T) => {
      setStoredValue(value);
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Ignore write failures (e.g. storage disabled); state still updates in memory.
      }
    },
    [key],
  );

  return [storedValue, setValue];
}
