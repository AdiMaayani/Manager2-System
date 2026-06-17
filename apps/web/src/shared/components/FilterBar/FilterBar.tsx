import type { ReactNode } from 'react';
import './FilterBar.css';

interface FilterBarProps {
  /** Filter controls: search inputs, selects, chips, checkboxes, etc. */
  children: ReactNode;
  /** Primary actions (e.g. a "new item" button), rendered opposite the filters. */
  actions?: ReactNode;
}

/**
 * White card wrapper for page filter sections. Filters sit on the inline start
 * and actions on the inline end, so the layout flips correctly in RTL.
 */
export function FilterBar({ children, actions }: FilterBarProps) {
  return (
    <div className="filterBar">
      <div className="filterBar__filters">{children}</div>
      {actions && <div className="filterBar__actions">{actions}</div>}
    </div>
  );
}

interface FilterFieldProps {
  /** Visible label above the control. */
  label?: string;
  /** Lets the control grow; use for the primary search field. */
  grow?: boolean;
  children: ReactNode;
}

/**
 * Standard labelled slot for a single filter control so every page renders
 * filter labels/spacing identically.
 */
export function FilterField({ label, grow = false, children }: FilterFieldProps) {
  return (
    <div className={`filterBar__field ${grow ? 'filterBar__field--grow' : ''}`.trim()}>
      {label && <span className="filterBar__label">{label}</span>}
      {children}
    </div>
  );
}
