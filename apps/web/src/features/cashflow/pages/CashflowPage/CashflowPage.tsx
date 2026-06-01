import { useQuery } from '@tanstack/react-query';
import { PageShell } from '@shared/components/PageShell';
import { isLocalDataMode } from '@/config/appConfig';
import { mockCashflowItems, delayMock } from '@shared/mock';
import { EmptyState } from '@shared/components/EmptyState';

export function CashflowPage() {
  const { data: rows } = useQuery({
    queryKey: ['cashflow', isLocalDataMode],
    queryFn: () => (isLocalDataMode ? Promise.resolve([]) : delayMock(mockCashflowItems)),
  });

  return (
    <PageShell title="תזרים">
      {isLocalDataMode ? (
        <EmptyState title="אין API לתזרים" description="המסך זמין במצב mock" />
      ) : (
        <table style={{ width: '100%', background: '#fff' }}>
          <thead><tr><th>חודש</th><th>הכנסות</th><th>הוצאות</th></tr></thead>
          <tbody>
            {rows?.map((r) => (
              <tr key={r.month}>
                <td>{r.month}</td>
                <td>{r.income.toLocaleString('he-IL')} ₪</td>
                <td>{r.expenses.toLocaleString('he-IL')} ₪</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageShell>
  );
}
