import { useMemo, useState } from 'react';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { EmptyState } from '@shared/components/EmptyState';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { Badge } from '@shared/components/Badge';
import { useContacts } from '../../hooks/useContacts';
import { ContactDrawer } from '../../components/ContactDrawer';
import type { Contact } from '../../types';
import './ContactsPage.css';

const SEGMENTS = ['הכל', 'לקוחות', 'ספקים', 'קבלנים'];

export function ContactsPage() {
  const { data: contacts, isLoading, error, refetch } = useContacts();
  const [segment, setSegment] = useState('הכל');
  const [search, setSearch] = useState('');
  const [drawerContact, setDrawerContact] = useState<Contact | null | undefined>(undefined);

  const isDrawerOpen = drawerContact !== undefined;

  const filtered = useMemo(() => {
    if (!contacts) return [];
    return contacts.filter((c) => {
      const matchSegment = segment === 'הכל' || c.contactCategory === segment;
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        c.fullName.toLowerCase().includes(q) ||
        (c.companyName ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q);
      return matchSegment && matchSearch;
    });
  }, [contacts, segment, search]);

  if (isLoading) return <PageShell title="אנשי קשר"><PageSpinner /></PageShell>;
  if (error) {
    return (
      <PageShell title="אנשי קשר">
        <ErrorState message={error.message} onRetry={() => refetch()} />
      </PageShell>
    );
  }

  return (
    <PageShell title="אנשי קשר">
      <div className="contactsPage__toolbar">
        <div className="contactsPage__segments">
          {SEGMENTS.map((s) => (
            <button
              key={s}
              type="button"
              className={`contactsPage__chip${segment === s ? ' contactsPage__chip--active' : ''}`}
              onClick={() => setSegment(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="contactsPage__toolbarActions">
          <Input
            placeholder="חיפוש איש קשר..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button onClick={() => setDrawerContact(null)}>+ איש קשר חדש</Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="לא נמצאו אנשי קשר"
          description="נסה לשנות סינון או להוסיף איש קשר חדש"
        />
      ) : (
        <div className="contactsPage__tableWrap">
          <table className="contactsPage__table">
            <thead>
              <tr>
                <th>שם</th>
                <th>חברה</th>
                <th>טלפון</th>
                <th>קטגוריה</th>
                <th>סטטוס</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.contactId}>
                  <td>{c.fullName}</td>
                  <td>{c.companyName ?? '-'}</td>
                  <td>{c.phone ?? '-'}</td>
                  <td>{c.contactCategory}</td>
                  <td>
                    <Badge variant={c.isActive ? 'success' : 'neutral'}>
                      {c.status ?? (c.isActive ? 'פעיל' : 'לא פעיל')}
                    </Badge>
                  </td>
                  <td>
                    <Button variant="ghost" onClick={() => setDrawerContact(c)}>
                      עריכה
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ContactDrawer
        isOpen={isDrawerOpen}
        onClose={() => setDrawerContact(undefined)}
        contact={drawerContact}
      />
    </PageShell>
  );
}
