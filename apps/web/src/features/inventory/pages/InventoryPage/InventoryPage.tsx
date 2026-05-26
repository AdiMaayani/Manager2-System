import { useQuery } from '@tanstack/react-query';
import { PageShell } from '@shared/components/PageShell';
import { isLocalDataMode } from '@/config/appConfig';
import { mockInventory, delayMock } from '@shared/mock';
import { EmptyState } from '@shared/components/EmptyState';

export function InventoryPage() {
  const { data: items } = useQuery({
    queryKey: ['inventory', isLocalDataMode],
    queryFn: () => (isLocalDataMode ? Promise.resolve([]) : delayMock(mockInventory)),
  });

  return (
    <PageShell title="מלאי">
      {isLocalDataMode ? (
        <EmptyState title="אין API למלאי" description="המסך זמין במצב mock" />
      ) : (
        <table style={{ width: '100%', background: '#fff', borderRadius: 8 }}>
          <thead>
            <tr><th>מק״ט</th><th>פריט</th><th>כמות</th><th>מיקום</th></tr>
          </thead>
          <tbody>
            {items?.map((i) => (
              <tr key={i.id}>
                <td>{i.id}</td><td>{i.name}</td><td>{i.qty}</td><td>{i.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageShell>
  );
}
