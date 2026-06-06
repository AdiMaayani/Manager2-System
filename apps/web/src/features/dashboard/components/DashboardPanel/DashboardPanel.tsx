import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from '@shared/components/Spinner';
import './DashboardPanel.css';

interface DashboardPanelProps {
  title: string;
  icon?: ReactNode;
  actionLabel?: string;
  actionTo?: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyText?: string;
  children: ReactNode;
}

export function DashboardPanel({
  title,
  icon,
  actionLabel,
  actionTo,
  isLoading = false,
  error = null,
  onRetry,
  isEmpty = false,
  emptyText = 'אין נתונים להצגה.',
  children,
}: DashboardPanelProps) {
  return (
    <section className="dashboardPanel">
      <header className="dashboardPanel__header">
        <h3 className="dashboardPanel__title">
          {icon && (
            <span className="dashboardPanel__icon" aria-hidden="true">
              {icon}
            </span>
          )}
          <span>{title}</span>
        </h3>
        {actionLabel && actionTo && (
          <Link className="dashboardPanel__action" to={actionTo}>
            {actionLabel}
          </Link>
        )}
      </header>

      <div className="dashboardPanel__body">
        {isLoading ? (
          <div className="dashboardPanel__state">
            <Spinner size="sm" />
          </div>
        ) : error ? (
          <div className="dashboardPanel__state">
            <p className="dashboardPanel__stateText">{error}</p>
            {onRetry && (
              <button type="button" className="dashboardPanel__retry" onClick={onRetry}>
                נסה שוב
              </button>
            )}
          </div>
        ) : isEmpty ? (
          <div className="dashboardPanel__state">
            <p className="dashboardPanel__stateText">{emptyText}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
