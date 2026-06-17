import { useState } from 'react';
import { Button } from '../Button';
import './ConfirmInline.css';

interface ConfirmInlineProps {
  /** Label for the initial trigger button. */
  triggerLabel: string;
  /** Confirmation prompt shown after the trigger is pressed. */
  message: string;
  /** Label for the confirm button. */
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  isPending?: boolean;
  /** Visual tone of the action (defaults to destructive). */
  variant?: 'danger' | 'primary';
}

/**
 * Two-step inline confirmation used by drawer "danger zone" actions. Keeps the
 * destructive-confirm UX (prompt color, button order) identical everywhere.
 */
export function ConfirmInline({
  triggerLabel,
  message,
  confirmLabel,
  cancelLabel = 'חזור',
  onConfirm,
  isPending = false,
  variant = 'danger',
}: ConfirmInlineProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isConfirming) {
    return (
      <Button type="button" variant={variant} onClick={() => setIsConfirming(true)}>
        {triggerLabel}
      </Button>
    );
  }

  return (
    <div className="confirmInline">
      <span className="confirmInline__message">{message}</span>
      <div className="confirmInline__actions">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setIsConfirming(false)}
          disabled={isPending}
        >
          {cancelLabel}
        </Button>
        <Button type="button" variant={variant} onClick={onConfirm} isLoading={isPending}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
