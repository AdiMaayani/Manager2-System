import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { StatusBadge } from '@shared/components/StatusBadge';
import { Button } from '@shared/components/Button';
import { FilterBar, FilterField } from '@shared/components/FilterBar';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { InlineAlert } from '@shared/components/InlineAlert';
import { DataTable, type DataTableColumn } from '@shared/components/DataTable';
import { usePermissions } from '@shared/auth/usePermissions';
import { ServiceCallDrawer } from '../../components/ServiceCallDrawer';
import { useServiceCallLookups, useServiceCalls } from '../../hooks/useServiceCalls';
import type { ServiceCallDetails, ServiceCallListItem } from '../../types';
import './ServiceCallsPage.css';

const PRIORITY_LABELS: Record<string, string> = {
  Low: 'נמוכה',
  Medium: 'רגילה',
  High: 'גבוהה',
  Urgent: 'דחופה',
};

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
  const { can } = usePermissions();
  // Creating/editing a service call needs the customer & site pickers, which require customer read
  // access. View-only roles (e.g. technicians) skip those lookups and the "new call" action entirely.
  const canManageServiceCalls = can('manageServiceCalls') && can('viewCustomers');
  const { data: serviceCalls, isLoading, error, refetch } = useServiceCalls();
  const lookups = useServiceCallLookups({ enabled: canManageServiceCalls });
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

  const columns: DataTableColumn<ServiceCallListItem>[] = [
    { id: 'number', header: 'מספר', width: '90px', cell: (call) => `SC-${call.workItemId}` },
    { id: 'title', header: 'כותרת', cell: (call) => call.title },
    { id: 'customer', header: 'לקוח', cell: (call) => call.customerName ?? '-' },
    { id: 'site', header: 'אתר', cell: (call) => call.siteName ?? '-' },
    {
      id: 'status',
      header: 'סטטוס',
      cell: (call) => <StatusBadge domain="serviceCall" status={call.status} />,
    },
    { id: 'priority', header: 'עדיפות', cell: (call) => getPriorityLabel(call.priority) },
    { id: 'planned', header: 'מתוכנן', cell: (call) => formatDate(call.plannedStart) },
    { id: 'role', header: 'תפקיד', cell: (call) => call.requiredRole ?? '-' },
  ];

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
          canManageServiceCalls ? (
            <Button
              type="button"
              iconStart={<Plus size={18} />}
              onClick={() => {
                setPageMessage(null);
                setDrawerServiceCall(null);
              }}
            >
              קריאה חדשה
            </Button>
          ) : undefined
        }
      >
        <FilterField label="חיפוש" grow>
          <Input
            placeholder="חיפוש לפי כותרת, לקוח, אתר או תפקיד..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </FilterField>

        <FilterField label="סטטוס">
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">כל הסטטוסים</option>
            <option value="Open">פתוחה</option>
            <option value="InProgress">בטיפול</option>
            <option value="Done">בוצעה</option>
            <option value="Cancelled">בוטלה</option>
          </Select>
        </FilterField>
      </FilterBar>

      {pageMessage && (
        <InlineAlert variant="success" onDismiss={() => setPageMessage(null)}>
          {pageMessage}
        </InlineAlert>
      )}

      {lookups.error && (
        <InlineAlert variant="warning">
          חלק מנתוני הבחירה לא נטענו. ניתן לרענן ולנסות שוב.
        </InlineAlert>
      )}

      <DataTable
        columns={columns}
        rows={filteredServiceCalls}
        getRowId={(call) => call.workItemId}
        onRowClick={openServiceCall}
        selectedRowId={selectedServiceCallId}
        emptyTitle="לא נמצאו קריאות שירות"
        emptyDescription="התאימו את הסינון או צרו קריאת שירות חדשה."
      />

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
