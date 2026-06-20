import { useCallback, useEffect, useState } from 'react';

export interface DrawerMaximizeState {
  isMaximized: boolean;
  toggleMaximize: () => void;
}

/**
 * Shared maximize state for every entity drawer. Mirrors ProjectDrawer: the drawer
 * starts at its normal size and resets back to it whenever it is (re)opened, so a
 * previously maximized drawer never reopens stuck in the wide footprint.
 */
export function useDrawerMaximize(isOpen: boolean): DrawerMaximizeState {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (isOpen) setIsMaximized(false);
  }, [isOpen]);

  const toggleMaximize = useCallback(() => {
    setIsMaximized((value) => !value);
  }, []);

  return { isMaximized, toggleMaximize };
}
