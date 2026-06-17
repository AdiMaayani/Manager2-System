import type { ReactNode } from 'react';
import './PageHeader.css';

interface PageHeaderProps {
  title?: string;
  subtitle?: ReactNode;
  /** Primary/secondary actions, rendered on the inline end. */
  actions?: ReactNode;
}

/**
 * In-content page header for screens that need a title/subtitle and action
 * buttons outside the FilterBar (e.g. Dashboard, Settings). Standardises action
 * placement and responsive wrapping.
 */
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="pageHeader">
      <div className="pageHeader__text">
        {title && <h1 className="pageHeader__title">{title}</h1>}
        {subtitle && <div className="pageHeader__subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="pageHeader__actions">{actions}</div>}
    </header>
  );
}
