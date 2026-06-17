import { Badge } from '@shared/components/Badge';
import { DataTable, type DataTableColumn } from '@shared/components/DataTable';
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
  const columns: DataTableColumn<QuoteListItem>[] = [
    {
      id: 'number',
      header: 'מספר',
      cell: (quote) => <span className="quotesTable__number">{quote.quoteNumber}</span>,
    },
    { id: 'customer', header: 'לקוח', cell: (quote) => quote.customerName ?? '—' },
    { id: 'project', header: 'פרויקט', cell: (quote) => quote.projectTitle ?? '—' },
    { id: 'date', header: 'תאריך', cell: (quote) => formatDate(quote.quoteDate) },
    { id: 'validUntil', header: 'בתוקף עד', cell: (quote) => formatDate(quote.validUntil) },
    {
      id: 'status',
      header: 'סטטוס',
      cell: (quote) => (
        <div className="quotesTable__badges">
          <QuoteStatusBadge status={quote.status} />
          {!quote.isActive && <Badge variant="neutral">בוטל</Badge>}
        </div>
      ),
    },
    {
      id: 'total',
      header: 'סה״כ',
      align: 'end',
      cell: (quote) => <span className="quotesTable__total">{formatCurrency(quote.total)}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={quotes}
      getRowId={(quote) => quote.quoteId}
      onRowClick={(quote) => onSelectQuote(quote.quoteId)}
      selectedRowId={selectedQuoteId ?? null}
      emptyTitle="לא נמצאו הצעות מחיר"
    />
  );
}
