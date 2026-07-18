import { useCallback, useState } from 'react';

export interface DrawerMaximizeState {
  isMaximized: boolean;
  toggleMaximize: () => void;
}

/**
 * Shared maximize state for every entity drawer: the drawer starts at its normal size and the user
 * can toggle the wide footprint. Reset-on-reopen is owned by the drawer lifecycle rather than an
 * effect — every consumer mounts the component that calls this hook only while the drawer is open
 * (returning null when closed), so a fresh open always starts non-maximized and switching records
 * (which remounts the content) can never retain a stale maximized state.
 */
export function useDrawerMaximize(): DrawerMaximizeState {
  const [isMaximized, setIsMaximized] = useState(false);

  const toggleMaximize = useCallback(() => {
    setIsMaximized((value) => !value);
  }, []);

  return { isMaximized, toggleMaximize };
}
