import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import {
  buildEntityDrawerSearchParams,
  parseEntityDrawerParam,
  parseEntityIdParam,
  type EntityDrawerUrlState,
} from '@shared/lib/urlEntityDrawer';
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

export function QuotesPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [status, setStatus] = useState<QuoteStatus | ''>('');

  // The query string is the single source of truth for the drawer and the (control-less) project
  // filter, so both are derived from the current URL on every render — no effect or lazy initializer
  // copies them into state. This keeps browser back/forward and deep links working: ?quoteId=<int>
  // reviews a quote, ?quoteId=new opens create mode, and ?projectId pre-filters via the deep link.
  const quoteDrawerState = parseEntityDrawerParam(searchParams.get('quoteId'));
  const isDrawerOpen = quoteDrawerState.kind !== 'closed';
  const drawerQuoteId = quoteDrawerState.kind === 'existing' ? quoteDrawerState.id : null;
  const projectIdFilter = parseEntityIdParam(searchParams.get('projectId'));

  const { data: customerOptions } = useQuoteCustomerOptions();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const filters: QuoteFilters = useMemo(
    () => ({
      search: debouncedSearch,
      customerId: customerId ? Number(customerId) : undefined,
      projectId: projectIdFilter ?? undefined,
      status: status || undefined,
    }),
    [debouncedSearch, customerId, projectIdFilter, status],
  );

  const { data: quotes, isLoading, error, refetch } = useQuotes(filters);

  const hasFilters = Boolean(search.trim() || customerId || projectIdFilter != null || status);

  function setQuoteDrawer(state: EntityDrawerUrlState, options?: { replace?: boolean }) {
    setSearchParams(
      (current) => buildEntityDrawerSearchParams(current, 'quoteId', state),
      { replace: options?.replace ?? false },
    );
  }

  function resetFilters() {
    setSearch('');
    setCustomerId('');
    setStatus('');
    // The project filter lives in the URL; clearing filters must remove it there too.
    if (searchParams.has('projectId')) {
      const next = new URLSearchParams(searchParams);
      next.delete('projectId');
      setSearchParams(next, { replace: true });
    }
  }

  function closeDrawer() {
    setQuoteDrawer({ kind: 'closed' });
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
              onClick={() => setQuoteDrawer({ kind: 'create' })}
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
          selectedQuoteId={drawerQuoteId}
          onSelectQuote={(quoteId) => setQuoteDrawer({ kind: 'existing', id: quoteId })}
        />
      )}

      <QuoteDrawer
        isOpen={isDrawerOpen}
        quoteId={drawerQuoteId}
        initialProjectId={projectIdFilter ?? undefined}
        onClose={closeDrawer}
        onSaved={(savedQuoteId) =>
          setQuoteDrawer({ kind: 'existing', id: savedQuoteId }, { replace: true })
        }
      />
    </PageShell>
  );
}
