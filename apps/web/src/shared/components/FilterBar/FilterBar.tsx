import type { ReactNode } from 'react';
import './FilterBar.css';

interface FilterBarProps {
  /** Filter controls: search inputs, selects, chips, checkboxes, etc. */
  children: ReactNode;
  /** Primary actions (e.g. a "new item" button), rendered opposite the filters. */
  actions?: ReactNode;
}

/**
 * White card wrapper for page filter sections, matching the Projects/Reports
 * filter card style. Filters sit on the inline start and actions on the
 * inline end, so the layout flips correctly in RTL.
 */
export function FilterBar({ children, actions }: FilterBarProps) {
  return (
    <div className="filterBar">
      <div className="filterBar__filters">{children}</div>
      {actions && <div className="filterBar__actions">{actions}</div>}
    </div>
  );
}
