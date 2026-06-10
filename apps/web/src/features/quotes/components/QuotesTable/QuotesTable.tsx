import { Badge } from '@shared/components/Badge';
import { QuoteStatusBadge } from '../QuoteStatusBadge';
import type { QuoteListItem } from '../../types';
import { formatCurrency, formatDate } from '../../utils/format';
import './QuotesTable.css';

interface QuotesTableProps {
  quotes: QuoteListItem[];
  selectedQuoteId?: number | null;
  onSelectQuote: (quoteId: number) => void;
}

export function QuotesTable({ quotes, selectedQuoteId, onSelectQuote }: QuotesTableProps) {
  return (
    <div className="quotesTable__wrap">
      <table className="quotesTable">
        <thead>
          <tr>
            <th>מספר</th>
            <th>לקוח</th>
            <th>פרויקט</th>
            <th>תאריך</th>
            <th>בתוקף עד</th>
            <th>סטטוס</th>
            <th>סה״כ</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((quote) => (
            <tr
              key={quote.quoteId}
              role="button"
              tabIndex={0}
              className={`quotesTable__row ${
                selectedQuoteId === quote.quoteId ? 'quotesTable__row--selected' : ''
              }`.trim()}
              onClick={() => onSelectQuote(quote.quoteId)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectQuote(quote.quoteId);
                }
              }}
            >
              <td className="quotesTable__number">{quote.quoteNumber}</td>
              <td>{quote.customerName ?? '—'}</td>
              <td>{quote.projectTitle ?? '—'}</td>
              <td>{formatDate(quote.quoteDate)}</td>
              <td>{formatDate(quote.validUntil)}</td>
              <td>
                <div className="quotesTable__badges">
                  <QuoteStatusBadge status={quote.status} />
                  {!quote.isActive && <Badge variant="neutral">בוטל</Badge>}
                </div>
              </td>
              <td className="quotesTable__total">{formatCurrency(quote.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
