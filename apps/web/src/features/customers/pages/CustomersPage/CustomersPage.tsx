import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { EmptyState } from '@shared/components/EmptyState';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { FilterBar } from '@shared/components/FilterBar';
import { Input } from '@shared/components/Input';
import { useCustomers } from '../../hooks/useCustomers';
import { CustomerDrawer } from '../../components/CustomerDrawer';
import type { Customer } from '../../types';
import './CustomersPage.css';

export function CustomersPage() {
  const { data: customers, isLoading, error, refetch } = useCustomers();
  const [searchParams, setSearchParams] = useSearchParams();
  // undefined = drawer closed, null = create mode, Customer = review existing.
  const [drawerCustomer, setDrawerCustomer] = useState<Customer | null | undefined>(undefined);
  const [search, setSearch] = useState('');

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

  const filtered = customers?.filter((customer) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      customer.customerName.toLowerCase().includes(q) ||
      (customer.city ?? '').toLowerCase().includes(q) ||
      (customer.customerType ?? '').toLowerCase().includes(q)
    );
  }) ?? [];

  const openCustomer = (customer: Customer) => {
    setDrawerCustomer(customer);
  };

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
        actions={<Button onClick={() => setDrawerCustomer(null)}>+ לקוח חדש</Button>}
      >
        <label className="customersPage__filter customersPage__filter--search">
          <span>חיפוש</span>
          <Input
            placeholder="חיפוש לקוח..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState title="לא נמצאו לקוחות" />
      ) : (
        <div className="customersPage__tableWrap">
          <table className="customersPage__table">
            <thead>
              <tr>
                <th>שם לקוח</th>
                <th>סוג</th>
                <th>עיר</th>
                <th>טלפון</th>
                <th>סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer) => (
                <tr
                  key={customer.customerId}
                  role="button"
                  tabIndex={0}
                  className={`customersPage__row ${
                    selectedCustomerId === customer.customerId
                      ? 'customersPage__row--selected'
                      : ''
                  }`.trim()}
                  onClick={() => openCustomer(customer)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openCustomer(customer);
                    }
                  }}
                >
                  <td>{customer.customerName}</td>
                  <td>{customer.customerType || '—'}</td>
                  <td>{customer.city || '—'}</td>
                  <td>{customer.primaryPhone || '—'}</td>
                  <td>
                    <Badge variant={customer.isActive ? 'success' : 'neutral'}>
                      {customer.status ?? (customer.isActive ? 'פעיל' : 'לא פעיל')}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CustomerDrawer
        isOpen={isDrawerOpen}
        onClose={() => setDrawerCustomer(undefined)}
        onSaved={(savedCustomer) => setDrawerCustomer(savedCustomer)}
        customer={drawerCustomer}
      />
    </PageShell>
  );
}
