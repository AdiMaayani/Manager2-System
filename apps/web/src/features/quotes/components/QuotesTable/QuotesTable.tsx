import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { QuoteStatusBadge } from '../QuoteStatusBadge';
import type { QuoteListItem } from '../../types';
import { formatCurrency, formatDate } from '../../utils/format';
import './QuotesTable.css';

interface QuotesTableProps {
  quotes: QuoteListItem[];
  onSelectQuote: (quoteId: number) => void;
}

export function QuotesTable({ quotes, onSelectQuote }: QuotesTableProps) {
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
            <th>פעולות</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((quote) => (
            <tr key={quote.quoteId}>
              <td className="quotesTable__number">{quote.quoteNumber}</td>
              <td>{quote.customerName ?? '-'}</td>
              <td>{quote.projectTitle ?? '-'}</td>
              <td>{formatDate(quote.quoteDate)}</td>
              <td>{formatDate(quote.validUntil)}</td>
              <td>
                <div className="quotesTable__badges">
                  <QuoteStatusBadge status={quote.status} />
                  {!quote.isActive && <Badge variant="neutral">בוטל</Badge>}
                </div>
              </td>
              <td className="quotesTable__total">{formatCurrency(quote.total)}</td>
              <td>
                <Button variant="ghost" onClick={() => onSelectQuote(quote.quoteId)}>
                  פתח
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
