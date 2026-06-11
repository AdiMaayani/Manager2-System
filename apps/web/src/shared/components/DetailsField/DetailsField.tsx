import type { ReactNode } from 'react';
import './DetailsField.css';

const DEFAULT_EMPTY_VALUE_FALLBACK = '—';

interface DetailsFieldProps {
  label: string;
  /** Display value: string, number, or any ReactNode (badges, links, etc.). */
  value?: ReactNode;
  /** Shown when the value is null/undefined/blank. Defaults to an em dash. */
  emptyFallback?: string;
  /** Renders label and value on a single line for dense layouts. */
  isCompact?: boolean;
}

function isBlankDetailsValue(value: ReactNode): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

/**
 * Label/value pair for drawer review (read-only) mode. Blank values render a
 * consistent muted fallback so empty data is easy to scan past.
 */
export function DetailsField({
  label,
  value,
  emptyFallback = DEFAULT_EMPTY_VALUE_FALLBACK,
  isCompact = false,
}: DetailsFieldProps) {
  const isBlank = isBlankDetailsValue(value);
  const fieldClassName = isCompact ? 'detailsField detailsField--compact' : 'detailsField';
  const valueClassName = isBlank
    ? 'detailsField__value detailsField__value--empty'
    : 'detailsField__value';

  return (
    <div className={fieldClassName}>
      <span className="detailsField__label">{label}</span>
      <span className={valueClassName}>{isBlank ? emptyFallback : value}</span>
    </div>
  );
}
