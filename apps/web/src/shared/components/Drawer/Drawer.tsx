import { useEffect, type ReactNode } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { IconButton } from '../IconButton';
import './Drawer.css';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  headerActions?: ReactNode;
  footer?: ReactNode;
  /** Size mode. `wide` is the maximized footprint; mobile is always full-screen. */
  size?: 'default' | 'wide';
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
  size = 'default',
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

  const isWide = isMaximized || size === 'wide';

  return (
    <div className="drawer" role="dialog" aria-modal="true">
      <div className="drawer__backdrop" onClick={onClose} aria-hidden="true" />
      <div className={`drawer__panel ${isWide ? 'drawer__panel--maximized' : ''}`.trim()}>
        <div className="drawer__header">
          <div className="drawer__headerMain">
            {title && <h2 className="drawer__title">{title}</h2>}
            {headerActions}
          </div>
          <div className="drawer__headerControls">
            {onToggleMaximize && (
              <IconButton
                label={isMaximized ? 'הקטן' : 'הגדל'}
                icon={isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                onClick={onToggleMaximize}
              />
            )}
            <IconButton label="סגור" icon={<X size={20} />} onClick={onClose} />
          </div>
        </div>
        <div className="drawer__body">{children}</div>
        {footer && <div className="drawer__footer">{footer}</div>}
      </div>
    </div>
  );
}
