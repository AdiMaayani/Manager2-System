import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { EmptyState } from '@shared/components/EmptyState';
import { Button } from '@shared/components/Button';
import { FilterBar } from '@shared/components/FilterBar';
import { Input } from '@shared/components/Input';
import { Badge } from '@shared/components/Badge';
import { usePermissions } from '@shared/auth/usePermissions';
import { useContacts } from '../../hooks/useContacts';
import { ContactDrawer } from '../../components/ContactDrawer';
import type { Contact } from '../../types';
import './ContactsPage.css';

const SEGMENTS = ['הכל', 'לקוחות', 'נציגי לקוחות', 'ספקים', 'קבלנים', 'שותפים עסקיים'];
const ACTIVE_FILTERS = ['הכל', 'פעילים', 'לא פעילים'] as const;
type ActiveFilter = (typeof ACTIVE_FILTERS)[number];

function formatContactDate(value?: string | null) {
  if (!value) return '—';
  return value.split('T')[0];
}

export function ContactsPage() {
  const { can } = usePermissions();
  const { data: contacts, isLoading, error, refetch } = useContacts();
  const [searchParams, setSearchParams] = useSearchParams();
  const [segment, setSegment] = useState('הכל');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('הכל');
  const [search, setSearch] = useState('');
  // undefined = drawer closed, null = create mode, Contact = review existing.
  const [drawerContact, setDrawerContact] = useState<Contact | null | undefined>(undefined);

  // Deep link: ?contactId opens that contact in read-only review mode, then
  // the param is removed (matching the Quotes ?quoteId behavior).
  useEffect(() => {
    const contactIdParam = searchParams.get('contactId');
    if (!contactIdParam || !contacts) return;

    const requestedContact = contacts.find(
      (contact) => contact.contactId === Number(contactIdParam),
    );
    if (requestedContact) {
      setDrawerContact(requestedContact);
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('contactId');
    setSearchParams(nextParams, { replace: true });
  }, [contacts, searchParams, setSearchParams]);

  const isDrawerOpen = drawerContact !== undefined;
  const selectedContactId = drawerContact?.contactId ?? null;

  const filtered = useMemo(() => {
    if (!contacts) return [];
    return contacts.filter((c) => {
      const matchSegment = segment === 'הכל' || c.contactCategory === segment;
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        c.fullName.toLowerCase().includes(q) ||
        (c.companyName ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q) ||
        (c.email ?? '').toLowerCase().includes(q);
      const matchActive =
        activeFilter === 'הכל' ||
        (activeFilter === 'פעילים' && c.isActive) ||
        (activeFilter === 'לא פעילים' && !c.isActive);
      return matchSegment && matchSearch && matchActive;
    });
  }, [contacts, segment, search, activeFilter]);

  const openContact = (contact: Contact) => {
    setDrawerContact(contact);
  };

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
      <FilterBar
        actions={
          can('manageContacts') ? (
            <Button onClick={() => setDrawerContact(null)}>+ איש קשר חדש</Button>
          ) : undefined
        }
      >
        <div className="contactsPage__filter contactsPage__filter--search">
          <span className="contactsPage__filterLabel">חיפוש</span>
          <Input
            placeholder="חיפוש איש קשר..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="contactsPage__filter">
          <span className="contactsPage__filterLabel">קטגוריה</span>
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
        </div>

        <div className="contactsPage__filter">
          <span className="contactsPage__filterLabel">סטטוס</span>
          <div className="contactsPage__segments">
            {ACTIVE_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={`contactsPage__chip${activeFilter === f ? ' contactsPage__chip--active' : ''}`}
                onClick={() => setActiveFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </FilterBar>

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
                <th>קטגוריה</th>
                <th>טלפון</th>
                <th>מייל</th>
                <th>סטטוס</th>
                <th>עודכן</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.contactId}
                  role="button"
                  tabIndex={0}
                  className={`contactsPage__row ${
                    selectedContactId === c.contactId ? 'contactsPage__row--selected' : ''
                  }`.trim()}
                  onClick={() => openContact(c)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openContact(c);
                    }
                  }}
                >
                  <td>{c.fullName}</td>
                  <td>{c.companyName || '—'}</td>
                  <td>{c.contactCategory}</td>
                  <td>{c.phone || '—'}</td>
                  <td>{c.email || '—'}</td>
                  <td>
                    <Badge variant={c.isActive ? 'success' : 'neutral'}>
                      {c.status ?? (c.isActive ? 'פעיל' : 'לא פעיל')}
                    </Badge>
                  </td>
                  <td>{formatContactDate(c.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ContactDrawer
        isOpen={isDrawerOpen}
        onClose={() => setDrawerContact(undefined)}
        onSaved={(savedContact) => setDrawerContact(savedContact)}
        contact={drawerContact}
      />
    </PageShell>
  );
}
