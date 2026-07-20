import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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

const STATUS_FILTER_IDS = STATUS_FILTER_ITEMS.map((item) => item.id);

// Falls back to "all" for a missing/unrecognized URL value instead of silently
// filtering to an empty list, so stale or hand-edited links stay usable.
function resolveStatusFilterParam(value: string | null): string {
  return value && STATUS_FILTER_IDS.includes(value) ? value : 'all';
}

function resolvePriorityFilterParam(value: string | null): string {
  return value && PRIORITY_OPTIONS.includes(value) ? value : 'all';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState(() =>
    resolveStatusFilterParam(searchParams.get('status')),
  );
  const [priorityFilter, setPriorityFilter] = useState(() =>
    resolvePriorityFilterParam(searchParams.get('priority')),
  );
  // Customer options come from the already-loaded service call list (no extra lookup call), so this
  // filter works the same for every role, unlike the gated customer/site lookups used by the form.
  const [customerFilter, setCustomerFilter] = useState(() => searchParams.get('customer') ?? '');
  const [pageMessage, setPageMessage] = useState<string | null>(null);

  // Filters persist to the URL the same way the Projects list page does, so refresh and
  // browser back/forward restore the same filtered view. Unrelated params (e.g. serviceCallId)
  // are preserved since only the named keys are updated.
  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>, options?: { replace?: boolean }) => {
      const nextParams = new URLSearchParams(searchParams);

      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          nextParams.set(key, value);
        } else {
          nextParams.delete(key);
        }
      });

      setSearchParams(nextParams, { replace: options?.replace ?? false });
    },
    [searchParams, setSearchParams],
  );

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

  const customerOptions = useMemo(() => {
    const names = (serviceCalls ?? [])
      .map((call) => call.customerName)
      .filter((name): name is string => Boolean(name));
    return [...new Set(names)].sort();
  }, [serviceCalls]);

  const filteredServiceCalls = useMemo(() => {
    const calls = serviceCalls ?? [];
    const normalizedSearch = search.trim().toLowerCase();

    return calls.filter((serviceCall) => {
      const matchesStatus = statusFilter === 'all' || serviceCall.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || serviceCall.priority === priorityFilter;
      const matchesCustomer = !customerFilter || serviceCall.customerName === customerFilter;
      const matchesSearch =
        !normalizedSearch || buildSearchText(serviceCall).includes(normalizedSearch);

      return matchesStatus && matchesPriority && matchesCustomer && matchesSearch;
    });
  }, [search, serviceCalls, statusFilter, priorityFilter, customerFilter]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    Boolean(customerFilter);

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setCustomerFilter('');
    updateSearchParams({ search: null, status: null, priority: null, customer: null });
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
    { id: 'customer', header: 'לקוח', width: '160px', cell: (call) => call.customerName ?? '-' },
    { id: 'site', header: 'אתר', width: '160px', cell: (call) => call.siteName ?? '-' },
    {
      id: 'status',
      header: 'סטטוס',
      width: '120px',
      align: 'center',
      cell: (call) => <StatusBadge domain="serviceCall" status={call.status} />,
    },
    {
      id: 'priority',
      header: 'עדיפות',
      width: '110px',
      align: 'center',
      cell: (call) => <StatusBadge domain="serviceCallPriority" status={call.priority} />,
    },
    {
      id: 'planned',
      header: 'מתוכנן',
      width: '120px',
      align: 'end',
      cell: (call) => formatDate(call.plannedStart),
    },
    {
      id: 'role',
      header: 'מקצועות',
      width: '140px',
      cell: (call) =>
        call.requiredRoles?.length ? call.requiredRoles.join(' · ') : call.requiredRole ?? '-',
    },
  ];

  if (isLoading) {
    return (
      <PageShell title="קריאות שירות" wide>
        <PageSpinner />
      </PageShell>
    );
  }
  if (error) {
    return (
      <PageShell title="קריאות שירות" wide>
        <ErrorState message={error.message} onRetry={() => refetch()} />
      </PageShell>
    );
  }

  return (
    <PageShell title="קריאות שירות" wide>
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
            aria-label="חיפוש קריאות שירות"
            value={search}
            onChange={(event) => {
              const value = event.target.value;
              setSearch(value);
              updateSearchParams({ search: value.trim() || null });
            }}
          />
        </FilterField>

        <FilterField label="סטטוס">
          <div className="serviceCallsPage__statusControl">
            <SegmentedControl
              items={STATUS_FILTER_ITEMS}
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                updateSearchParams({ status: value !== 'all' ? value : null });
              }}
              ariaLabel="סינון לפי סטטוס"
              size="sm"
            />
          </div>
        </FilterField>

        <FilterField label="עדיפות">
          <Select
            value={priorityFilter}
            aria-label="סינון לפי עדיפות"
            onChange={(event) => {
              const value = event.target.value;
              setPriorityFilter(value);
              updateSearchParams({ priority: value !== 'all' ? value : null });
            }}
          >
            <option value="all">כל העדיפויות</option>
            {PRIORITY_OPTIONS.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </Select>
        </FilterField>

        <FilterField label="לקוח">
          <Select
            value={customerFilter}
            aria-label="סינון לפי לקוח"
            onChange={(event) => {
              const value = event.target.value;
              setCustomerFilter(value);
              updateSearchParams({ customer: value || null });
            }}
          >
            <option value="">כל הלקוחות</option>
            {customerOptions.map((name) => (
              <option key={name} value={name}>
                {name}
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
