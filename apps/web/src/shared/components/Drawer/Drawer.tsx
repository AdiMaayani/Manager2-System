import { useEffect, type ReactNode } from 'react';
import './Drawer.css';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  headerActions?: ReactNode;
  footer?: ReactNode;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  children: ReactNode;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  headerActions,
  footer,
  isMaximized = false,
  onToggleMaximize,
  children,
}: DrawerProps) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.classList.add('drawerOpen');
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.classList.remove('drawerOpen');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="drawer" role="dialog" aria-modal="true">
      <div className="drawer__backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className={`drawer__panel ${isMaximized ? 'drawer__panel--maximized' : ''}`.trim()}
      >
        <div className="drawer__header">
          <div className="drawer__headerMain">
            {title && <h2 className="drawer__title">{title}</h2>}
            {headerActions}
          </div>
          <div className="drawer__headerControls">
            {onToggleMaximize && (
              <button
                type="button"
                className="drawer__maximize"
                onClick={onToggleMaximize}
                aria-label={isMaximized ? 'הקטן' : 'הגדל'}
              >
                {isMaximized ? '⤡' : '⤢'}
              </button>
            )}
            <button
              type="button"
              className="drawer__close"
              onClick={onClose}
              aria-label="סגור"
            >
              ×
            </button>
          </div>
        </div>
        <div className="drawer__body">{children}</div>
        {footer && <div className="drawer__footer">{footer}</div>}
      </div>
    </div>
  );
}
