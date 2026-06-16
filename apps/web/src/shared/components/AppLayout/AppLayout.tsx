import { useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../Sidebar';
import { MobileNavContext } from '@shared/layout/MobileNavContext';
import '@shared/layout/layout.css';

export function AppLayout() {
  const [isNavOpen, setIsNavOpen] = useState(false);

  // Escape closes the panel for keyboard users, matching the Drawer/Modal.
  // (Tapping a nav link or the backdrop closes it via their own handlers; the
  // backdrop covers all page content while open, so there is nothing else to
  // navigate from — no route-change effect is needed.)
  useEffect(() => {
    if (!isNavOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsNavOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNavOpen]);

  const navContext = useMemo(
    () => ({
      isOpen: isNavOpen,
      open: () => setIsNavOpen(true),
      close: () => setIsNavOpen(false),
      toggle: () => setIsNavOpen((prev) => !prev),
    }),
    [isNavOpen],
  );

  return (
    <MobileNavContext.Provider value={navContext}>
      <div className="appLayout">
        <Sidebar isOpen={isNavOpen} />
        {isNavOpen && (
          <div
            className="appLayout__navBackdrop"
            onClick={() => setIsNavOpen(false)}
            aria-hidden="true"
          />
        )}
        <main className="appLayout__main">
          <Outlet />
        </main>
      </div>
    </MobileNavContext.Provider>
  );
}
