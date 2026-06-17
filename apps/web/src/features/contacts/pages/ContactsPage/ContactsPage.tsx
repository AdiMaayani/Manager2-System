import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { Button } from '@shared/components/Button';
import { FilterBar, FilterField } from '@shared/components/FilterBar';
import { Input } from '@shared/components/Input';
import { Badge } from '@shared/components/Badge';
import { SegmentedControl, type SegmentItem } from '@shared/components/SegmentedControl';
import { DataTable, type DataTableColumn } from '@shared/components/DataTable';
import { usePermissions } from '@shared/auth/usePermissions';
import { useContacts } from '../../hooks/useContacts';
import { ContactDrawer } from '../../components/ContactDrawer';
import type { Contact } from '../../types';
import './ContactsPage.css';

const SEGMENTS = ['הכל', 'לקוחות', 'נציגי לקוחות', 'ספקים', 'קבלנים', 'שותפים עסקיים'];
const ACTIVE_FILTERS = ['הכל', 'פעילים', 'לא פעילים'] as const;
type ActiveFilter = (typeof ACTIVE_FILTERS)[number];

const SEGMENT_ITEMS: SegmentItem<string>[] = SEGMENTS.map((s) => ({ id: s, label: s }));
const ACTIVE_FILTER_ITEMS: SegmentItem<ActiveFilter>[] = ACTIVE_FILTERS.map((f) => ({
  id: f,
  label: f,
}));

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

  const columns: DataTableColumn<Contact>[] = [
    { id: 'name', header: 'שם', cell: (c) => c.fullName },
    { id: 'company', header: 'חברה', cell: (c) => c.companyName || '—' },
    { id: 'category', header: 'קטגוריה', cell: (c) => c.contactCategory },
    { id: 'phone', header: 'טלפון', cell: (c) => c.phone || '—' },
    { id: 'email', header: 'מייל', cell: (c) => c.email || '—' },
    {
      id: 'status',
      header: 'סטטוס',
      cell: (c) => (
        <Badge variant={c.isActive ? 'success' : 'neutral'}>
          {c.status ?? (c.isActive ? 'פעיל' : 'לא פעיל')}
        </Badge>
      ),
    },
    { id: 'updated', header: 'עודכן', cell: (c) => formatContactDate(c.updatedAt) },
  ];

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
            <Button iconStart={<Plus size={18} />} onClick={() => setDrawerContact(null)}>
              איש קשר חדש
            </Button>
          ) : undefined
        }
      >
        <FilterField label="חיפוש" grow>
          <Input
            placeholder="חיפוש איש קשר..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </FilterField>

        <FilterField label="קטגוריה">
          <SegmentedControl
            items={SEGMENT_ITEMS}
            value={segment}
            onChange={setSegment}
            ariaLabel="סינון לפי קטגוריה"
            size="sm"
          />
        </FilterField>

        <FilterField label="סטטוס">
          <SegmentedControl
            items={ACTIVE_FILTER_ITEMS}
            value={activeFilter}
            onChange={setActiveFilter}
            ariaLabel="סינון לפי סטטוס"
            size="sm"
          />
        </FilterField>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={filtered}
        getRowId={(c) => c.contactId}
        onRowClick={openContact}
        selectedRowId={selectedContactId}
        emptyTitle="לא נמצאו אנשי קשר"
        emptyDescription="נסה לשנות סינון או להוסיף איש קשר חדש"
      />

      <ContactDrawer
        isOpen={isDrawerOpen}
        onClose={() => setDrawerContact(undefined)}
        onSaved={(savedContact) => setDrawerContact(savedContact)}
        contact={drawerContact}
      />
    </PageShell>
  );
}
