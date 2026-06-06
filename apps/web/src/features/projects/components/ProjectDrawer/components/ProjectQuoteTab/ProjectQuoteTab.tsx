import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@shared/components/Button';
import { EmptyState } from '@shared/components/EmptyState';
import { ErrorState } from '@shared/components/ErrorState';
import { PageSpinner } from '@shared/components/PageSpinner';
import { QuoteStatusBadge, formatCurrency, formatDate, useQuotes } from '@features/quotes';
import './ProjectQuoteTab.css';

interface ProjectQuoteTabProps {
  projectId: number;
}

export function ProjectQuoteTab({ projectId }: ProjectQuoteTabProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: quotes, isLoading, error, refetch } = useQuotes({ projectId });

  function openInQuotesScreen(quoteId?: number) {
    const params = new URLSearchParams({ projectId: String(projectId) });
    params.set('returnTo', `${location.pathname}${location.search}`);
    if (quoteId) {
      params.set('quoteId', String(quoteId));
    }
    navigate(`/quotes?${params.toString()}`);
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
        <Button variant="secondary" onClick={() => openInQuotesScreen()}>
          נהל במסך הצעות מחיר
        </Button>
      </div>

      {!quotes || quotes.length === 0 ? (
        <EmptyState
          title="אין הצעות מחיר לפרויקט"
          description="צרו הצעת מחיר חדשה במסך הצעות המחיר ושייכו אותה לפרויקט זה."
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
                    <Button variant="ghost" onClick={() => openInQuotesScreen(quote.quoteId)}>
                      פתח
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
