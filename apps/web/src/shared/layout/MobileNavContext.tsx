import { createContext, useContext } from 'react';

// Shared open/close state for the off-canvas navigation. The sidebar lives in
// AppLayout while its toggle lives in the per-page TopBar, so the two need a
// common channel. Defaults are no-ops so a TopBar rendered outside the layout
// (it never is today) degrades gracefully instead of throwing.
export interface MobileNavContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const noop = () => {};

export const MobileNavContext = createContext<MobileNavContextValue>({
  isOpen: false,
  open: noop,
  close: noop,
  toggle: noop,
});

export function useMobileNav(): MobileNavContextValue {
  return useContext(MobileNavContext);
}
