import { useEffect, type ReactNode } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { IconButton } from '../IconButton';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'default' | 'wide';
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  children: ReactNode;
}

export function Modal({
  isOpen,
  onClose,
  title,
  size = 'default',
  isMaximized = false,
  onToggleMaximize,
  children,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasHeader = Boolean(title) || Boolean(onToggleMaximize);
  const isWide = isMaximized || size === 'wide';

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className={`modal__panel ${isWide ? 'modal__panel--maximized' : ''}`.trim()}>
        {hasHeader && (
          <div className="modal__header">
            {title ? <h2 className="modal__title">{title}</h2> : <span />}
            <div className="modal__headerControls">
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
        )}
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
