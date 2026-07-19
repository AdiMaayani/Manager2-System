import { useCallback, useEffect, useMemo, useState } from 'react';
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

// Falls back to "all" for a missing/unrecognized URL value instead of silently filtering to an
// empty list, so stale or hand-edited links stay usable. Accepts the literal "all" value in
// addition to a canonical QuoteStatus, even though the app itself omits the parameter for "all".
function resolveStatusFilterParam(value: string | null): QuoteStatus | '' {
  if (value && (QUOTE_STATUS_OPTIONS as string[]).includes(value)) return value as QuoteStatus;
  return '';
}

export function QuotesPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get('search') ?? '');
  const [customerId, setCustomerId] = useState(() => searchParams.get('customerId') ?? '');
  const [status, setStatus] = useState<QuoteStatus | ''>(() =>
    resolveStatusFilterParam(searchParams.get('status')),
  );

  // The query string is the single source of truth for the drawer and the (control-less) project
  // filter, so both are derived from the current URL on every render — no effect or lazy initializer
  // copies them into state. This keeps browser back/forward and deep links working: ?quoteId=<int>
  // reviews a quote, ?quoteId=new opens create mode, and ?projectId pre-filters via the deep link.
  const quoteDrawerState = parseEntityDrawerParam(searchParams.get('quoteId'));
  const isDrawerOpen = quoteDrawerState.kind !== 'closed';
  const drawerQuoteId = quoteDrawerState.kind === 'existing' ? quoteDrawerState.id : null;
  const projectIdFilter = parseEntityIdParam(searchParams.get('projectId'));

  const { data: customerOptions } = useQuoteCustomerOptions();

  // Filters persist to the URL the same way the Projects/Service Calls/Customers/Contacts list
  // pages do. Only the named keys are updated, so quoteId/projectId and any unrelated params are
  // always preserved untouched.
  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        Object.entries(updates).forEach(([key, value]) => {
          if (value) {
            next.set(key, value);
          } else {
            next.delete(key);
          }
        });
        return next;
      });
    },
    [setSearchParams],
  );

  // Debounce keeps the existing 300ms-after-typing-stops filtering behavior (avoiding a request per
  // keystroke); the URL's search param is updated on the same delay so it always reflects the value
  // actually being filtered on, without adding a history entry per keystroke.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search);
      updateSearchParams({ search: search.trim() || null });
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [search, updateSearchParams]);

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
    setDebouncedSearch('');
    setCustomerId('');
    setStatus('');
    updateSearchParams({ search: null, status: null, customerId: null, projectId: null });
  }

  function closeDrawer() {
    setQuoteDrawer({ kind: 'closed' });
  }

  return (
    <PageShell title="הצעות מחיר" wide>
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
            aria-label="חיפוש הצעות מחיר"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </FilterField>

        <FilterField label="סטטוס">
          <div className="quotesPage__statusControl">
            <SegmentedControl
              items={STATUS_FILTER_ITEMS}
              value={status}
              onChange={(value) => {
                setStatus(value);
                updateSearchParams({ status: value || null });
              }}
              ariaLabel="סינון לפי סטטוס"
              size="sm"
            />
          </div>
        </FilterField>

        <FilterField label="לקוח">
          <Select
            value={customerId}
            aria-label="סינון לפי לקוח"
            onChange={(event) => {
              const value = event.target.value;
              setCustomerId(value);
              updateSearchParams({ customerId: value || null });
            }}
          >
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
