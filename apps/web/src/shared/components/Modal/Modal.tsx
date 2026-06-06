import type { ReactNode } from 'react';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  children: ReactNode;
}

export function Modal({
  isOpen,
  onClose,
  title,
  isMaximized = false,
  onToggleMaximize,
  children,
}: ModalProps) {
  if (!isOpen) return null;

  const hasHeader = Boolean(title) || Boolean(onToggleMaximize);

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className={`modal__panel ${isMaximized ? 'modal__panel--maximized' : ''}`.trim()}>
        {hasHeader && (
          <div className="modal__header">
            {title ? <h2 className="modal__title">{title}</h2> : <span />}
            <div className="modal__headerControls">
              {onToggleMaximize && (
                <button
                  type="button"
                  className="modal__maximize"
                  onClick={onToggleMaximize}
                  aria-label={isMaximized ? 'הקטן' : 'הגדל'}
                >
                  {isMaximized ? '⤡' : '⤢'}
                </button>
              )}
              <button type="button" className="modal__close" onClick={onClose} aria-label="סגור">
                ×
              </button>
            </div>
          </div>
        )}
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
