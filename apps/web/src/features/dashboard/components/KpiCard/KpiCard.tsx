import type { ReactNode } from 'react';
import './KpiCard.css';

interface KpiCardProps {
  label: string;
  value: number;
  icon: ReactNode;
  context?: string;
  tone?: 'primary' | 'warning' | 'success' | 'neutral';
}

export function KpiCard({ label, value, icon, context, tone = 'primary' }: KpiCardProps) {
  return (
    <article className={`kpiCard kpiCard--${tone}`}>
      <div className="kpiCard__top">
        <span className="kpiCard__icon" aria-hidden="true">
          {icon}
        </span>
        <span className="kpiCard__label">{label}</span>
      </div>
      <span className="kpiCard__value">{value.toLocaleString('he-IL')}</span>
      {context && <span className="kpiCard__context">{context}</span>}
    </article>
  );
}
