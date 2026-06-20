import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './KpiCard.css';

type KpiCardTone = 'primary' | 'warning' | 'danger' | 'success' | 'neutral';

interface KpiCardProps {
  label: string;
  value: number;
  icon: ReactNode;
  context?: string;
  tone?: KpiCardTone;
  /** When provided the whole card becomes a link to this in-app route. */
  to?: string;
}

export function KpiCard({ label, value, icon, context, tone = 'primary', to }: KpiCardProps) {
  const content = (
    <>
      <div className="kpiCard__top">
        <span className="kpiCard__icon" aria-hidden="true">
          {icon}
        </span>
        <span className="kpiCard__label">{label}</span>
      </div>
      <span className="kpiCard__value">{value.toLocaleString('he-IL')}</span>
      {context && <span className="kpiCard__context">{context}</span>}
    </>
  );

  if (to) {
    return (
      <Link className={`kpiCard kpiCard--${tone} kpiCard--clickable`} to={to}>
        {content}
      </Link>
    );
  }

  return <article className={`kpiCard kpiCard--${tone}`}>{content}</article>;
}
