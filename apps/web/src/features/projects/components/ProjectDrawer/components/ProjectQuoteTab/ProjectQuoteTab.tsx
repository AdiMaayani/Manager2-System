import { useState } from 'react';
import { Button } from '@shared/components/Button';
import { EmptyState } from '@shared/components/EmptyState';
import { ErrorState } from '@shared/components/ErrorState';
import { PageSpinner } from '@shared/components/PageSpinner';
import {
  QuoteDrawer,
  QuoteStatusBadge,
  formatCurrency,
  formatDate,
  useQuotes,
} from '@features/quotes';
import './ProjectQuoteTab.css';

interface ProjectQuoteTabProps {
  projectId: number;
}

export function ProjectQuoteTab({ projectId }: ProjectQuoteTabProps) {
  const { data: quotes, isLoading, error, refetch } = useQuotes({ projectId });
  const [quoteDrawerState, setQuoteDrawerState] = useState<{
    isOpen: boolean;
    quoteId: number | null;
  }>({ isOpen: false, quoteId: null });

  function openQuoteDrawer(quoteId: number | null = null) {
    setQuoteDrawerState({ isOpen: true, quoteId });
  }

  function closeQuoteDrawer() {
    setQuoteDrawerState({ isOpen: false, quoteId: null });
  }

  if (isLoading) {
    return <PageSpinner />;
  }

  if (error) {
    return <ErrorState message={error.message} onRetry={() => refetch()} />;
  }

  return (
    <div className="projectQuoteTab">
      <div className="projectQuoteTab__header">
        <h3 className="projectQuoteTab__title">הצעות מחיר לפרויקט</h3>
        <Button variant="secondary" onClick={() => openQuoteDrawer()}>
          הצעת מחיר חדשה
        </Button>
      </div>

      {!quotes || quotes.length === 0 ? (
        <EmptyState
          title="אין הצעות מחיר לפרויקט"
          description="צרו הצעת מחיר חדשה והיא תשויך אוטומטית לפרויקט הזה."
        />
      ) : (
        <div className="projectQuoteTab__tableWrap">
          <table className="projectQuoteTab__table">
            <thead>
              <tr>
                <th>מספר</th>
                <th>תאריך</th>
                <th>סטטוס</th>
                <th>סה״כ</th>
                <th aria-label="פעולות" />
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <tr key={quote.quoteId}>
                  <td className="projectQuoteTab__number">{quote.quoteNumber}</td>
                  <td>{formatDate(quote.quoteDate)}</td>
                  <td>
                    <QuoteStatusBadge status={quote.status} />
                  </td>
                  <td className="projectQuoteTab__total">{formatCurrency(quote.total)}</td>
                  <td>
                    <Button variant="ghost" onClick={() => openQuoteDrawer(quote.quoteId)}>
                      ערוך
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <QuoteDrawer
        isOpen={quoteDrawerState.isOpen}
        quoteId={quoteDrawerState.quoteId}
        initialProjectId={projectId}
        onClose={closeQuoteDrawer}
        onSaved={() => refetch()}
      />
    </div>
  );
}
