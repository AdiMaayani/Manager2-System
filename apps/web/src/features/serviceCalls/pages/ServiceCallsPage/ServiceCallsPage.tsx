import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useUrlEntityDrawer } from '@shared/hooks';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { StatusBadge } from '@shared/components/StatusBadge';
import { Button } from '@shared/components/Button';
import { FilterBar, FilterField } from '@shared/components/FilterBar';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { SegmentedControl, type SegmentItem } from '@shared/components/SegmentedControl';
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

const STATUS_FILTER_ITEMS: SegmentItem<string>[] = [
  { id: 'all', label: 'הכול' },
  { id: 'Open', label: 'פתוחה' },
  { id: 'InProgress', label: 'בטיפול' },
  { id: 'Done', label: 'בוצעה' },
  { id: 'Cancelled', label: 'בוטלה' },
];

const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Urgent'];

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
    ...(serviceCall.requiredRoles ?? []),
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [pageMessage, setPageMessage] = useState<string | null>(null);

  // The ?serviceCallId query parameter is the drawer's single source of truth: missing/invalid =
  // closed, "new" = create, a positive integer = reviewing that call. State is derived from the URL,
  // so deep links and browser back/forward work without any URL→state effect.
  const {
    isDrawerOpen,
    isCreating,
    selectedEntity: drawerServiceCall,
    selectedId: selectedServiceCallId,
    openEntity,
    openCreate,
    showEntity,
    close: closeDrawer,
  } = useUrlEntityDrawer<ServiceCallDetails>({
    paramName: 'serviceCallId',
    items: serviceCalls,
    getId: (serviceCall) => serviceCall.workItemId,
  });

  const filteredServiceCalls = useMemo(() => {
    const calls = serviceCalls ?? [];
    const normalizedSearch = search.trim().toLowerCase();

    return calls.filter((serviceCall) => {
      const matchesStatus = statusFilter === 'all' || serviceCall.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || serviceCall.priority === priorityFilter;
      const matchesSearch =
        !normalizedSearch || buildSearchText(serviceCall).includes(normalizedSearch);

      return matchesStatus && matchesPriority && matchesSearch;
    });
  }, [search, serviceCalls, statusFilter, priorityFilter]);

  const hasActiveFilters =
    Boolean(search.trim()) || statusFilter !== 'all' || priorityFilter !== 'all';

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
  };

  const openServiceCall = (serviceCall: ServiceCallListItem) => {
    setPageMessage(null);
    openEntity(serviceCall);
  };

  const openCreateServiceCall = () => {
    setPageMessage(null);
    openCreate();
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
    {
      id: 'role',
      header: 'מקצועות',
      cell: (call) =>
        call.requiredRoles?.length ? call.requiredRoles.join(' · ') : call.requiredRole ?? '-',
    },
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
          <>
            {hasActiveFilters && (
              <Button type="button" variant="ghost" onClick={resetFilters}>
                נקה סינון
              </Button>
            )}
            {canManageServiceCalls && (
              <Button
                type="button"
                iconStart={<Plus size={18} />}
                onClick={openCreateServiceCall}
              >
                קריאה חדשה
              </Button>
            )}
          </>
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
          <SegmentedControl
            items={STATUS_FILTER_ITEMS}
            value={statusFilter}
            onChange={setStatusFilter}
            ariaLabel="סינון לפי סטטוס"
            size="sm"
          />
        </FilterField>

        <FilterField label="עדיפות">
          <Select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
          >
            <option value="all">כל העדיפויות</option>
            {PRIORITY_OPTIONS.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
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
        serviceCall={isCreating ? null : drawerServiceCall}
        customers={lookups.customers}
        sites={lookups.sites}
        employees={lookups.employees}
        onSitesChanged={async () => {
          await lookups.refetch();
        }}
        onClose={closeDrawer}
        onSaved={(message, savedServiceCall) => {
          setPageMessage(message);
          if (savedServiceCall) showEntity(savedServiceCall);
          void refetch();
        }}
      />
    </PageShell>
  );
}
