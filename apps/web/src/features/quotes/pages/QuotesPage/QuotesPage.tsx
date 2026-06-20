import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@shared/components/Button';
import { EmptyState } from '@shared/components/EmptyState';
import { ErrorState } from '@shared/components/ErrorState';
import { FilterBar, FilterField } from '@shared/components/FilterBar';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { SegmentedControl, type SegmentItem } from '@shared/components/SegmentedControl';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { QuoteDrawer } from '../../components/QuoteDrawer';
import { QuotesTable } from '../../components/QuotesTable';
import { QUOTE_STATUS_OPTIONS, getQuoteStatusLabel } from '../../constants/quoteStatus';
import { useQuoteCustomerOptions, useQuotes } from '../../hooks/useQuotes';
import type { QuoteFilters, QuoteStatus } from '../../types';
import './QuotesPage.css';

// Status filter ids: '' means "all", otherwise a canonical QuoteStatus.
const STATUS_FILTER_ITEMS: SegmentItem<QuoteStatus | ''>[] = [
  { id: '', label: 'הכול' },
  ...QUOTE_STATUS_OPTIONS.map((status) => ({ id: status, label: getQuoteStatusLabel(status) })),
];

interface DrawerState {
  isOpen: boolean;
  quoteId: number | null;
}

const CLOSED_DRAWER: DrawerState = { isOpen: false, quoteId: null };

export function QuotesPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  // projectId has no visible control; it is set only via the project→quotes deep link and is still
  // sent to the server filter (API support preserved). "נקה סינון" clears it.
  const [projectId, setProjectId] = useState(searchParams.get('projectId') ?? '');
  const [status, setStatus] = useState<QuoteStatus | ''>('');
  const [drawer, setDrawer] = useState<DrawerState>(CLOSED_DRAWER);

  const { data: customerOptions } = useQuoteCustomerOptions();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  // Deep link from the project drawer: ?projectId pre-filters, ?quoteId opens that quote.
  useEffect(() => {
    const quoteIdParam = searchParams.get('quoteId');
    const projectIdParam = searchParams.get('projectId');

    if (projectIdParam) {
      setProjectId(projectIdParam);
    }

    if (quoteIdParam) {
      const parsed = Number(quoteIdParam);
      if (Number.isFinite(parsed)) {
        setDrawer({ isOpen: true, quoteId: parsed });
      }
    }

    if (quoteIdParam || projectIdParam) {
      const next = new URLSearchParams(searchParams);
      next.delete('quoteId');
      setSearchParams(next, { replace: true });
    }
    // Run only on the initial query string.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filters: QuoteFilters = useMemo(
    () => ({
      search: debouncedSearch,
      customerId: customerId ? Number(customerId) : undefined,
      projectId: projectId ? Number(projectId) : undefined,
      status: status || undefined,
    }),
    [debouncedSearch, customerId, projectId, status],
  );

  const { data: quotes, isLoading, error, refetch } = useQuotes(filters);

  const hasFilters = Boolean(search.trim() || customerId || projectId || status);

  function resetFilters() {
    setSearch('');
    setCustomerId('');
    setProjectId('');
    setStatus('');
  }

  function closeDrawer() {
    setDrawer(CLOSED_DRAWER);
  }

  return (
    <PageShell title="הצעות מחיר">
      <FilterBar
        actions={
          <>
            {hasFilters && (
              <Button type="button" variant="ghost" onClick={resetFilters}>
                נקה סינון
              </Button>
            )}
            <Button
              iconStart={<Plus size={18} />}
              onClick={() => setDrawer({ isOpen: true, quoteId: null })}
            >
              הצעה חדשה
            </Button>
          </>
        }
      >
        <FilterField label="חיפוש" grow>
          <Input
            placeholder="מספר הצעה, לקוח, פרויקט..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </FilterField>

        <FilterField label="סטטוס">
          <SegmentedControl
            items={STATUS_FILTER_ITEMS}
            value={status}
            onChange={setStatus}
            ariaLabel="סינון לפי סטטוס"
            size="sm"
          />
        </FilterField>

        <FilterField label="לקוח">
          <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">כל הלקוחות</option>
            {(customerOptions ?? []).map((customer) => (
              <option key={customer.customerId} value={customer.customerId}>
                {customer.customerName}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      {isLoading ? (
        <PageSpinner />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : !quotes || quotes.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'לא נמצאו הצעות מחיר' : 'אין עדיין הצעות מחיר'}
          description={
            hasFilters
              ? 'נסו לשנות את החיפוש או הסינון.'
              : 'צרו הצעת מחיר ראשונה כדי להתחיל.'
          }
        />
      ) : (
        <QuotesTable
          quotes={quotes}
          selectedQuoteId={drawer.isOpen ? drawer.quoteId : null}
          onSelectQuote={(quoteId) => setDrawer({ isOpen: true, quoteId })}
        />
      )}

      <QuoteDrawer
        isOpen={drawer.isOpen}
        quoteId={drawer.quoteId}
        onClose={closeDrawer}
        onSaved={(savedQuoteId) => setDrawer({ isOpen: true, quoteId: savedQuoteId })}
      />
    </PageShell>
  );
}
