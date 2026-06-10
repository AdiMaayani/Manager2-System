import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { EmptyState } from '@shared/components/EmptyState';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { FilterBar } from '@shared/components/FilterBar';
import { Input } from '@shared/components/Input';
import { ServiceCallDrawer } from '../../components/ServiceCallDrawer';
import { useServiceCallLookups, useServiceCalls } from '../../hooks/useServiceCalls';
import type { ServiceCallDetails, ServiceCallListItem } from '../../types';
import './ServiceCallsPage.css';

const STATUS_LABELS: Record<string, string> = {
  Open: 'פתוחה',
  InProgress: 'בטיפול',
  Done: 'בוצעה',
  Cancelled: 'בוטלה',
};

const STATUS_VARIANTS: Record<string, 'neutral' | 'primary' | 'success' | 'warning' | 'danger'> = {
  Open: 'warning',
  InProgress: 'primary',
  Done: 'success',
  Cancelled: 'danger',
};

const PRIORITY_LABELS: Record<string, string> = {
  Low: 'נמוכה',
  Medium: 'רגילה',
  High: 'גבוהה',
  Urgent: 'דחופה',
};

function getStatusLabel(status?: string | null): string {
  if (!status) return '-';
  return STATUS_LABELS[status] ?? status;
}

function getPriorityLabel(priority?: string | null): string {
  if (!priority) return '-';
  return PRIORITY_LABELS[priority] ?? priority;
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('he-IL');
}

function buildSearchText(serviceCall: ServiceCallListItem): string {
  return [
    serviceCall.title,
    serviceCall.customerName,
    serviceCall.siteName,
    serviceCall.status,
    serviceCall.priority,
    serviceCall.requiredRole,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function ServiceCallsPage() {
  const { data: serviceCalls, isLoading, error, refetch } = useServiceCalls();
  const lookups = useServiceCallLookups();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  // undefined = drawer closed, null = create mode, ServiceCallDetails = review existing.
  const [drawerServiceCall, setDrawerServiceCall] = useState<ServiceCallDetails | null | undefined>(
    undefined,
  );
  const [pageMessage, setPageMessage] = useState<string | null>(null);

  // Deep link: ?serviceCallId opens that call in read-only review mode, then
  // the param is removed (matching the Quotes ?quoteId behavior).
  useEffect(() => {
    const serviceCallIdParam = searchParams.get('serviceCallId');
    if (!serviceCallIdParam || !serviceCalls) return;

    const requestedServiceCall = serviceCalls.find(
      (serviceCall) => serviceCall.workItemId === Number(serviceCallIdParam),
    );
    if (requestedServiceCall) {
      setDrawerServiceCall(requestedServiceCall);
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('serviceCallId');
    setSearchParams(nextParams, { replace: true });
  }, [serviceCalls, searchParams, setSearchParams]);

  const isDrawerOpen = drawerServiceCall !== undefined;
  const selectedServiceCallId = drawerServiceCall?.workItemId ?? null;

  const filteredServiceCalls = useMemo(() => {
    const calls = serviceCalls ?? [];
    const normalizedSearch = search.trim().toLowerCase();

    return calls.filter((serviceCall) => {
      const matchesStatus = statusFilter === 'all' || serviceCall.status === statusFilter;
      const matchesSearch =
        !normalizedSearch || buildSearchText(serviceCall).includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [search, serviceCalls, statusFilter]);

  const openServiceCall = (serviceCall: ServiceCallListItem) => {
    setPageMessage(null);
    setDrawerServiceCall(serviceCall);
  };

  if (isLoading) return <PageShell title="קריאות שירות"><PageSpinner /></PageShell>;
  if (error) {
    return (
      <PageShell title="קריאות שירות">
        <ErrorState message={error.message} onRetry={() => refetch()} />
      </PageShell>
    );
  }

  return (
    <PageShell title="קריאות שירות">
      <FilterBar
        actions={
          <Button
            type="button"
            onClick={() => {
              setPageMessage(null);
              setDrawerServiceCall(null);
            }}
          >
            + קריאה חדשה
          </Button>
        }
      >
        <div className="serviceCallsPage__filter serviceCallsPage__filter--search">
          <span className="serviceCallsPage__filterLabel">חיפוש</span>
          <Input
            placeholder="חיפוש לפי כותרת, לקוח, אתר או תפקיד..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="serviceCallsPage__filter">
          <span className="serviceCallsPage__filterLabel">סטטוס</span>
          <select
            className="serviceCallsPage__select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">כל הסטטוסים</option>
            <option value="Open">פתוחה</option>
            <option value="InProgress">בטיפול</option>
            <option value="Done">בוצעה</option>
            <option value="Cancelled">בוטלה</option>
          </select>
        </div>
      </FilterBar>

      {pageMessage && <p className="serviceCallsPage__success">{pageMessage}</p>}

      {lookups.error && (
        <p className="serviceCallsPage__warning">
          חלק מנתוני הבחירה לא נטענו. ניתן לרענן ולנסות שוב.
        </p>
      )}

      {filteredServiceCalls.length === 0 ? (
        <EmptyState title="לא נמצאו קריאות שירות" />
      ) : (
        <div className="serviceCallsPage__tableWrap">
          <table className="serviceCallsPage__table">
            <thead>
              <tr>
                <th>מספר</th>
                <th>כותרת</th>
                <th>לקוח</th>
                <th>אתר</th>
                <th>סטטוס</th>
                <th>עדיפות</th>
                <th>מתוכנן</th>
                <th>תפקיד</th>
              </tr>
            </thead>
            <tbody>
              {filteredServiceCalls.map((serviceCall) => (
                <tr
                  key={serviceCall.workItemId}
                  role="button"
                  tabIndex={0}
                  className={`serviceCallsPage__row ${
                    selectedServiceCallId === serviceCall.workItemId
                      ? 'serviceCallsPage__row--selected'
                      : ''
                  }`.trim()}
                  onClick={() => openServiceCall(serviceCall)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openServiceCall(serviceCall);
                    }
                  }}
                >
                  <td>SC-{serviceCall.workItemId}</td>
                  <td>{serviceCall.title}</td>
                  <td>{serviceCall.customerName ?? '-'}</td>
                  <td>{serviceCall.siteName ?? '-'}</td>
                  <td>
                    <Badge variant={STATUS_VARIANTS[serviceCall.status] ?? 'neutral'}>
                      {getStatusLabel(serviceCall.status)}
                    </Badge>
                  </td>
                  <td>{getPriorityLabel(serviceCall.priority)}</td>
                  <td>{formatDate(serviceCall.plannedStart)}</td>
                  <td>{serviceCall.requiredRole ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ServiceCallDrawer
        isOpen={isDrawerOpen}
        serviceCall={drawerServiceCall}
        customers={lookups.customers}
        sites={lookups.sites}
        employees={lookups.employees}
        onClose={() => setDrawerServiceCall(undefined)}
        onSaved={(message, savedServiceCall) => {
          setPageMessage(message);
          if (savedServiceCall) setDrawerServiceCall(savedServiceCall);
          void refetch();
        }}
      />
    </PageShell>
  );
}
