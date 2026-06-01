import { useQuery } from '@tanstack/react-query';
import { PageShell } from '@shared/components/PageShell';
import { isLocalDataMode } from '@/config/appConfig';
import { mockServiceCalls, delayMock } from '@shared/mock';
import { EmptyState } from '@shared/components/EmptyState';
import { Badge } from '@shared/components/Badge';

export function ServiceCallsPage() {
  const { data: calls } = useQuery({
    queryKey: ['serviceCalls', isLocalDataMode],
    queryFn: () => (isLocalDataMode ? Promise.resolve([]) : delayMock(mockServiceCalls)),
  });

  return (
    <PageShell title="קריאות שירות">
      {isLocalDataMode ? (
        <EmptyState title="אין API לקריאות שירות" description="המסך זמין במצב mock" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {calls?.map((c) => (
            <div key={c.id} style={{ background: '#fff', padding: 16, borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span>{c.id} — {c.customer}</span>
              <Badge variant="warning">{c.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
