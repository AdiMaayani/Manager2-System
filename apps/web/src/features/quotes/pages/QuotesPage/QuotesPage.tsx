import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@shared/components/Button';
import { EmptyState } from '@shared/components/EmptyState';
import { ErrorState } from '@shared/components/ErrorState';
import { FilterBar, FilterField } from '@shared/components/FilterBar';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { QuoteDrawer } from '../../components/QuoteDrawer';
import { QuotesTable } from '../../components/QuotesTable';
import { QUOTE_STATUS_OPTIONS, getQuoteStatusLabel } from '../../constants/quoteStatus';
import { useQuoteCustomerOptions, useQuoteProjectOptions, useQuotes } from '../../hooks/useQuotes';
import type { QuoteFilters, QuoteStatus } from '../../types';
import './QuotesPage.css';

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
  const [projectId, setProjectId] = useState(searchParams.get('projectId') ?? '');
  const [status, setStatus] = useState<QuoteStatus | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [drawer, setDrawer] = useState<DrawerState>(CLOSED_DRAWER);

  const { data: customerOptions } = useQuoteCustomerOptions();
  const { data: projectOptions } = useQuoteProjectOptions();

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
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    }),
    [debouncedSearch, customerId, projectId, status, fromDate, toDate],
  );

  const { data: quotes, isLoading, error, refetch } = useQuotes(filters);

  const hasFilters = Boolean(
    search.trim() || customerId || projectId || status || fromDate || toDate,
  );

  function closeDrawer() {
    setDrawer(CLOSED_DRAWER);
  }

  return (
    <PageShell title="הצעות מחיר">
      <FilterBar
        actions={
          <Button iconStart={<Plus size={18} />} onClick={() => setDrawer({ isOpen: true, quoteId: null })}>
            הצעה חדשה
          </Button>
        }
      >
        <FilterField label="חיפוש" grow>
          <Input
            placeholder="מספר הצעה, לקוח, פרויקט..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
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

        <FilterField label="פרויקט">
          <Select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="">כל הפרויקטים</option>
            {(projectOptions ?? []).map((project) => (
              <option key={project.workItemId} value={project.workItemId}>
                {project.title}
              </option>
            ))}
          </Select>
        </FilterField>

        <FilterField label="סטטוס">
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as QuoteStatus | '')}
          >
            <option value="">כל הסטטוסים</option>
            {QUOTE_STATUS_OPTIONS.map((statusOption) => (
              <option key={statusOption} value={statusOption}>
                {getQuoteStatusLabel(statusOption)}
              </option>
            ))}
          </Select>
        </FilterField>

        <FilterField label="מתאריך">
          <Input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </FilterField>

        <FilterField label="עד תאריך">
          <Input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
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
