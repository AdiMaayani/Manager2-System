import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useUrlEntityDrawer } from '@shared/hooks';
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
const ACTIVE_FILTERS = ['פעילים', 'מחוקים', 'הכול'] as const;
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
  const [segment, setSegment] = useState('הכל');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('הכול');
  const [search, setSearch] = useState('');
  // The ?contactId query parameter is the drawer's single source of truth: missing/invalid = closed,
  // "new" = create, a positive integer = reviewing that contact. State is derived from the URL, so
  // deep links and browser back/forward work without any URL→state effect.
  const {
    isDrawerOpen,
    isCreating,
    selectedEntity: drawerContact,
    selectedId: selectedContactId,
    openEntity: openContact,
    openCreate,
    showEntity: showContact,
    close: closeDrawer,
  } = useUrlEntityDrawer<Contact>({
    paramName: 'contactId',
    items: contacts,
    getId: (contact) => contact.contactId,
  });

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
        activeFilter === 'הכול' ||
        (activeFilter === 'פעילים' && c.isActive) ||
        (activeFilter === 'מחוקים' && !c.isActive);
      return matchSegment && matchSearch && matchActive;
    });
  }, [contacts, segment, search, activeFilter]);

  const hasActiveFilters =
    Boolean(search.trim()) || segment !== 'הכל' || activeFilter !== 'הכול';

  const resetFilters = () => {
    setSearch('');
    setSegment('הכל');
    setActiveFilter('הכול');
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
          <>
            {hasActiveFilters && (
              <Button type="button" variant="ghost" onClick={resetFilters}>
                נקה סינון
              </Button>
            )}
            {can('manageContacts') && (
              <Button iconStart={<Plus size={18} />} onClick={openCreate}>
                איש קשר חדש
              </Button>
            )}
          </>
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
        onClose={closeDrawer}
        onSaved={showContact}
        contact={isCreating ? null : drawerContact}
      />
    </PageShell>
  );
}
