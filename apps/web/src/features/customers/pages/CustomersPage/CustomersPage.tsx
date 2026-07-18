import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useUrlEntityDrawer } from '@shared/hooks';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { FilterBar, FilterField } from '@shared/components/FilterBar';
import { Input } from '@shared/components/Input';
import { SegmentedControl, type SegmentItem } from '@shared/components/SegmentedControl';
import { DataTable, type DataTableColumn } from '@shared/components/DataTable';
import { usePermissions } from '@shared/auth/usePermissions';
import { useCustomers } from '../../hooks/useCustomers';
import { CustomerDrawer } from '../../components/CustomerDrawer';
import type { Customer } from '../../types';
import './CustomersPage.css';

// Stable English query-param values, decoupled from the Hebrew labels shown in the UI, so URLs
// stay valid even if the displayed labels change later.
type StatusFilter = 'active' | 'inactive' | 'all';
const STATUS_FILTER_ITEMS: SegmentItem<StatusFilter>[] = [
  { id: 'active', label: 'פעילים' },
  { id: 'inactive', label: 'מחוקים' },
  { id: 'all', label: 'הכול' },
];
const STATUS_FILTER_IDS = STATUS_FILTER_ITEMS.map((item) => item.id);

// Falls back to "all" for a missing/unrecognized URL value instead of silently
// filtering to an empty list, so stale or hand-edited links stay usable.
function resolveStatusFilterParam(value: string | null): StatusFilter {
  return value && (STATUS_FILTER_IDS as string[]).includes(value)
    ? (value as StatusFilter)
    : 'all';
}

export function CustomersPage() {
  const { can } = usePermissions();
  const { data: customers, isLoading, error, refetch } = useCustomers();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() =>
    resolveStatusFilterParam(searchParams.get('status')),
  );

  // Filters persist to the URL the same way the Projects/Service Calls list pages do. Only the
  // named keys are updated, so the customerId drawer param is always preserved untouched.
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
  // The ?customerId query parameter is the drawer's single source of truth: missing/invalid = closed,
  // "new" = create, a positive integer = reviewing that customer. State is derived from the URL, so
  // deep links and browser back/forward work without any URL→state effect.
  const {
    isDrawerOpen,
    isCreating,
    selectedEntity: drawerCustomer,
    selectedId: selectedCustomerId,
    openEntity: openCustomer,
    openCreate,
    showEntity: showCustomer,
    close: closeDrawer,
  } = useUrlEntityDrawer<Customer>({
    paramName: 'customerId',
    items: customers,
    getId: (customer) => customer.customerId,
  });

  const filtered = useMemo(() => {
    if (!customers) return [];
    const q = search.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && customer.isActive) ||
        (statusFilter === 'inactive' && !customer.isActive);
      if (!matchesStatus) return false;
      if (!q) return true;
      return (
        customer.customerName.toLowerCase().includes(q) ||
        (customer.city ?? '').toLowerCase().includes(q) ||
        (customer.customerType ?? '').toLowerCase().includes(q)
      );
    });
  }, [customers, search, statusFilter]);

  const hasActiveFilters = Boolean(search.trim()) || statusFilter !== 'all';

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    updateSearchParams({ search: null, status: null });
  };

  const columns: DataTableColumn<Customer>[] = [
    { id: 'name', header: 'שם לקוח', width: '28%', cell: (customer) => customer.customerName },
    { id: 'type', header: 'סוג', width: '160px', cell: (customer) => customer.customerType || '—' },
    { id: 'city', header: 'עיר', width: '140px', cell: (customer) => customer.city || '—' },
    {
      id: 'phone',
      header: 'טלפון',
      width: '140px',
      cell: (customer) => customer.primaryPhone || '—',
    },
    {
      id: 'status',
      header: 'סטטוס',
      width: '110px',
      align: 'center',
      cell: (customer) => (
        <Badge variant={customer.isActive ? 'success' : 'neutral'}>
          {customer.isActive ? 'פעיל' : 'לא פעיל'}
        </Badge>
      ),
    },
  ];

  if (isLoading) {
    return (
      <PageShell title="לקוחות" wide>
        <PageSpinner />
      </PageShell>
    );
  }
  if (error) {
    return (
      <PageShell title="לקוחות" wide>
        <ErrorState message={error.message} onRetry={() => refetch()} />
      </PageShell>
    );
  }

  return (
    <PageShell title="לקוחות" wide>
      <FilterBar
        actions={
          <>
            {hasActiveFilters && (
              <Button type="button" variant="ghost" onClick={resetFilters}>
                נקה סינון
              </Button>
            )}
            {can('manageCustomers') && (
              <Button iconStart={<Plus size={18} />} onClick={openCreate}>
                לקוח חדש
              </Button>
            )}
          </>
        }
      >
        <FilterField label="חיפוש" grow>
          <Input
            placeholder="חיפוש לקוח..."
            aria-label="חיפוש לקוחות"
            value={search}
            onChange={(e) => {
              const value = e.target.value;
              setSearch(value);
              updateSearchParams({ search: value.trim() || null });
            }}
          />
        </FilterField>

        <FilterField label="סטטוס">
          <div className="customersPage__statusControl">
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
      </FilterBar>

      <DataTable
        columns={columns}
        rows={filtered}
        getRowId={(customer) => customer.customerId}
        onRowClick={openCustomer}
        selectedRowId={selectedCustomerId}
        emptyTitle="לא נמצאו לקוחות"
        emptyDescription="התאימו את החיפוש או הוסיפו לקוח חדש."
      />

      <CustomerDrawer
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        onSaved={showCustomer}
        customer={isCreating ? null : drawerCustomer}
      />
    </PageShell>
  );
}
