import { useState } from 'react';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { EmptyState } from '@shared/components/EmptyState';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { useCustomers } from '../../hooks/useCustomers';
import { CustomerDrawer } from '../../components/CustomerDrawer';
import type { Customer } from '../../types';
import './CustomersPage.css';

export function CustomersPage() {
  const { data: customers, isLoading, error, refetch } = useCustomers();
  const [drawerCustomer, setDrawerCustomer] = useState<Customer | null | undefined>(undefined);
  const [search, setSearch] = useState('');

  const isDrawerOpen = drawerCustomer !== undefined;

  const filtered = customers?.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.customerName.toLowerCase().includes(q) ||
      (c.city ?? '').toLowerCase().includes(q) ||
      (c.customerType ?? '').toLowerCase().includes(q)
    );
  }) ?? [];

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
      <div className="customersPage__toolbar">
        <Input
          placeholder="חיפוש לקוח..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button onClick={() => setDrawerCustomer(null)}>+ לקוח חדש</Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="לא נמצאו לקוחות" />
      ) : (
        <div className="customersPage__grid">
          {filtered.map((c) => (
            <article key={c.customerId} className="customersPage__card">
              <h3>{c.customerName}</h3>
              <p className="customersPage__cardType">{c.customerType}</p>
              <p className="customersPage__cardCity">{c.city ?? '-'}</p>
              <Badge variant={c.isActive ? 'success' : 'neutral'}>
                {c.status ?? (c.isActive ? 'פעיל' : 'לא פעיל')}
              </Badge>
              <Button variant="ghost" onClick={() => setDrawerCustomer(c)}>
                עריכה
              </Button>
            </article>
          ))}
        </div>
      )}

      <CustomerDrawer
        isOpen={isDrawerOpen}
        onClose={() => setDrawerCustomer(undefined)}
        customer={drawerCustomer}
      />
    </PageShell>
  );
}
