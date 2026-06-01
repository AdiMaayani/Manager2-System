import { useQuery } from '@tanstack/react-query';
import { PageShell } from '@shared/components/PageShell';
import { isLocalDataMode } from '@/config/appConfig';
import { mockQuotes, delayMock } from '@shared/mock';
import { EmptyState } from '@shared/components/EmptyState';
import './QuotesPage.css';

export function QuotesPage() {
  const { data: quotes } = useQuery({
    queryKey: ['quotes', isLocalDataMode],
    queryFn: () => (isLocalDataMode ? Promise.resolve([]) : delayMock(mockQuotes)),
  });

  return (
    <PageShell title="הצעות מחיר">
      {isLocalDataMode ? (
        <EmptyState
          title="אין API להצעות מחיר"
          description="המסך זמין במצב mock בלבד כרגע"
        />
      ) : (
        <div className="quotesPage__list">
          {quotes?.map((q) => (
            <div key={q.id} className="quotesPage__item">
              <strong>{q.id}</strong>
              <span>{q.customer}</span>
              <span>{q.amount.toLocaleString('he-IL')} ₪</span>
              <span>{q.status}</span>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
