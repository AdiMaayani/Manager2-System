import { PageShell } from '@shared/components/PageShell';
import { isLocalDataMode } from '@/config/appConfig';
import './DashboardPage.css';

const MOCK_STATS = [
  { label: 'פרויקטים פעילים', value: '12' },
  { label: 'דיווחים השבוע', value: '8' },
  { label: 'קריאות שירות פתוחות', value: '3' },
  { label: 'עובדים פעילים', value: '24' },
];

export function DashboardPage() {
  return (
    <PageShell title="לוח בקרה">
      {isLocalDataMode && (
        <p className="dashboardPage__hint">
          נתונים חיים מוצגים במסכי הפרויקטים, דיווחים ותוכנית עבודה.
        </p>
      )}
      <div className="dashboardPage__grid">
        {MOCK_STATS.map((s) => (
          <article key={s.label} className="dashboardPage__card">
            <span className="dashboardPage__value">{s.value}</span>
            <span className="dashboardPage__label">{s.label}</span>
          </article>
        ))}
      </div>
    </PageShell>
  );
}
