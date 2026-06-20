import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
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

const STATUS_FILTERS = ['פעילים', 'מחוקים', 'הכול'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
const STATUS_FILTER_ITEMS: SegmentItem<StatusFilter>[] = STATUS_FILTERS.map((f) => ({
  id: f,
  label: f,
}));

export function CustomersPage() {
  const { can } = usePermissions();
  const { data: customers, isLoading, error, refetch } = useCustomers();
  const [searchParams, setSearchParams] = useSearchParams();
  // undefined = drawer closed, null = create mode, Customer = review existing.
  const [drawerCustomer, setDrawerCustomer] = useState<Customer | null | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('הכול');

  // Deep link: ?customerId opens that customer in read-only review mode, then
  // the param is removed (matching the Quotes ?quoteId behavior).
  useEffect(() => {
    const customerIdParam = searchParams.get('customerId');
    if (!customerIdParam || !customers) return;

    const requestedCustomer = customers.find(
      (customer) => customer.customerId === Number(customerIdParam),
    );
    if (requestedCustomer) {
      setDrawerCustomer(requestedCustomer);
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('customerId');
    setSearchParams(nextParams, { replace: true });
  }, [customers, searchParams, setSearchParams]);

  const isDrawerOpen = drawerCustomer !== undefined;
  const selectedCustomerId = drawerCustomer?.customerId ?? null;

  const filtered = useMemo(() => {
    if (!customers) return [];
    const q = search.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesStatus =
        statusFilter === 'הכול' ||
        (statusFilter === 'פעילים' && customer.isActive) ||
        (statusFilter === 'מחוקים' && !customer.isActive);
      if (!matchesStatus) return false;
      if (!q) return true;
      return (
        customer.customerName.toLowerCase().includes(q) ||
        (customer.city ?? '').toLowerCase().includes(q) ||
        (customer.customerType ?? '').toLowerCase().includes(q)
      );
    });
  }, [customers, search, statusFilter]);

  const hasActiveFilters = Boolean(search.trim()) || statusFilter !== 'הכול';

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('הכול');
  };

  const openCustomer = (customer: Customer) => {
    setDrawerCustomer(customer);
  };

  const columns: DataTableColumn<Customer>[] = [
    { id: 'name', header: 'שם לקוח', width: '30%', cell: (customer) => customer.customerName },
    { id: 'type', header: 'סוג', cell: (customer) => customer.customerType || '—' },
    { id: 'city', header: 'עיר', cell: (customer) => customer.city || '—' },
    { id: 'phone', header: 'טלפון', cell: (customer) => customer.primaryPhone || '—' },
    {
      id: 'status',
      header: 'סטטוס',
      cell: (customer) => (
        <Badge variant={customer.isActive ? 'success' : 'neutral'}>
          {customer.status ?? (customer.isActive ? 'פעיל' : 'לא פעיל')}
        </Badge>
      ),
    },
  ];

  if (isLoading) return <PageShell title="לקוחות"><PageSpinner /></PageShell>;
  if (error) {
    return (
      <PageShell title="לקוחות">
        <ErrorState message={error.message} onRetry={() => refetch()} />
      </PageShell>
    );
  }

  return (
    <PageShell title="לקוחות">
      <FilterBar
        actions={
          <>
            {hasActiveFilters && (
              <Button type="button" variant="ghost" onClick={resetFilters}>
                נקה סינון
              </Button>
            )}
            {can('manageCustomers') && (
              <Button iconStart={<Plus size={18} />} onClick={() => setDrawerCustomer(null)}>
                לקוח חדש
              </Button>
            )}
          </>
        }
      >
        <FilterField label="חיפוש" grow>
          <Input
            placeholder="חיפוש לקוח..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
        onClose={() => setDrawerCustomer(undefined)}
        onSaved={(savedCustomer) => setDrawerCustomer(savedCustomer)}
        customer={drawerCustomer}
      />
    </PageShell>
  );
}
