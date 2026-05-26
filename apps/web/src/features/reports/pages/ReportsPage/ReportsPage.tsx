import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { EmptyState } from '@shared/components/EmptyState';
import { Badge } from '@shared/components/Badge';
import { useReports } from '../../hooks/useReports';
import './ReportsPage.css';

export function ReportsPage() {
  const { data: reports, isLoading, error, refetch } = useReports();

  if (isLoading) return <PageShell title="דיווחים"><PageSpinner /></PageShell>;
  if (error) {
    return (
      <PageShell title="דיווחים">
        <ErrorState message={error.message} onRetry={() => refetch()} />
      </PageShell>
    );
  }

  return (
    <PageShell title="דיווחים">
      {!reports?.length ? (
        <EmptyState title="אין דיווחים" />
      ) : (
        <div className="reportsPage__list">
          {reports.map((r) => (
            <div key={r.reportId} className="reportsPage__item">
              <div>
                <strong>{r.projectTitle ?? `דיווח #${r.reportId}`}</strong>
                <p>{r.reportDate ?? ''}</p>
              </div>
              <Badge variant="primary">{r.status ?? '—'}</Badge>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
