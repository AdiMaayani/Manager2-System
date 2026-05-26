import { useState } from 'react';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { EmptyState } from '@shared/components/EmptyState';
import { Badge } from '@shared/components/Badge';
import { Modal } from '@shared/components/Modal';
import { Button } from '@shared/components/Button';
import { useCustomers } from '../../hooks/useCustomers';
import type { Customer } from '../../types';
import './CustomersPage.css';

export function CustomersPage() {
  const { data: customers, isLoading, error, refetch } = useCustomers();
  const [selected, setSelected] = useState<Customer | null>(null);

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
      {!customers?.length ? (
        <EmptyState title="לא נמצאו לקוחות" />
      ) : (
        <div className="customersPage__grid">
          {customers.map((c) => (
            <article key={c.customerId} className="customersPage__card">
              <h3>{c.customerName}</h3>
              <p>{c.customerType}</p>
              <p>{c.city ?? '-'}</p>
              <Badge variant={c.isActive ? 'success' : 'neutral'}>
                {c.status ?? 'פעיל'}
              </Badge>
              <Button variant="ghost" onClick={() => setSelected(c)}>
                פרטים
              </Button>
            </article>
          ))}
        </div>
      )}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected?.customerName}>
        {selected && (
          <div>
            <p>טלפון: {selected.primaryPhone ?? '-'}</p>
            <p>אימייל: {selected.primaryEmail ?? '-'}</p>
            <p>עיר: {selected.city ?? '-'}</p>
          </div>
        )}
      </Modal>
    </PageShell>
  );
}
