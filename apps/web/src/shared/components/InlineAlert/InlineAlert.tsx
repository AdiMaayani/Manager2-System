import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from '../IconButton';
import './InlineAlert.css';

interface InlineAlertProps {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  children: ReactNode;
  onDismiss?: () => void;
}

/**
 * Inline page/section banner for transient success, warning, info, and error
 * messages. Replaces the assorted local `*__success` / `*__warning` paragraphs.
 */
export function InlineAlert({ variant = 'info', children, onDismiss }: InlineAlertProps) {
  return (
    <div className={`inlineAlert inlineAlert--${variant}`} role="status">
      <div className="inlineAlert__content">{children}</div>
      {onDismiss && (
        <IconButton
          label="סגור הודעה"
          icon={<X size={16} />}
          size="sm"
          onClick={onDismiss}
        />
      )}
    </div>
  );
}
