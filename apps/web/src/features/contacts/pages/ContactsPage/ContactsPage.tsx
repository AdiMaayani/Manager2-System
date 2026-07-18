import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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

// Stable English category ids for the URL, mapped locally to the existing Hebrew values that
// drive client-side filtering (categoryMapping.ts's Hebrew↔enum boundary is untouched).
type CategoryFilter = 'all' | 'customer' | 'customerRep' | 'supplier' | 'contractor' | 'partner' | 'other';

const CATEGORY_FILTER_ITEMS: SegmentItem<CategoryFilter>[] = [
  { id: 'all', label: 'הכל' },
  { id: 'customer', label: 'לקוחות' },
  { id: 'customerRep', label: 'נציגי לקוחות' },
  { id: 'supplier', label: 'ספקים' },
  { id: 'contractor', label: 'קבלנים' },
  { id: 'partner', label: 'שותפים עסקיים' },
  { id: 'other', label: 'אחר' },
];

const CATEGORY_FILTER_TO_HEBREW: Record<Exclude<CategoryFilter, 'all'>, string> = {
  customer: 'לקוחות',
  customerRep: 'נציגי לקוחות',
  supplier: 'ספקים',
  contractor: 'קבלנים',
  partner: 'שותפים עסקיים',
  other: 'אחר',
};

const CATEGORY_FILTER_IDS = CATEGORY_FILTER_ITEMS.map((item) => item.id);

function resolveCategoryFilterParam(value: string | null): CategoryFilter {
  return value && (CATEGORY_FILTER_IDS as string[]).includes(value)
    ? (value as CategoryFilter)
    : 'all';
}

type StatusFilter = 'active' | 'inactive' | 'all';

const STATUS_FILTER_ITEMS: SegmentItem<StatusFilter>[] = [
  { id: 'active', label: 'פעילים' },
  { id: 'inactive', label: 'מחוקים' },
  { id: 'all', label: 'הכול' },
];

const STATUS_FILTER_IDS = STATUS_FILTER_ITEMS.map((item) => item.id);

function resolveStatusFilterParam(value: string | null): StatusFilter {
  return value && (STATUS_FILTER_IDS as string[]).includes(value)
    ? (value as StatusFilter)
    : 'all';
}

function formatContactDate(value?: string | null) {
  if (!value) return '—';
  return value.split('T')[0];
}

export function ContactsPage() {
  const { can } = usePermissions();
  const { data: contacts, isLoading, error, refetch } = useContacts();
  const [searchParams, setSearchParams] = useSearchParams();
  const [segment, setSegment] = useState<CategoryFilter>(() =>
    resolveCategoryFilterParam(searchParams.get('category')),
  );
  const [activeFilter, setActiveFilter] = useState<StatusFilter>(() =>
    resolveStatusFilterParam(searchParams.get('status')),
  );
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');

  // Filters persist to the URL the same way the Projects/Service Calls/Customers list pages do.
  // Only the named keys are updated, so the contactId drawer param is always preserved untouched.
  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>) => {
      const nextParams = new URLSearchParams(searchParams);

      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          nextParams.set(key, value);
        } else {
          nextParams.delete(key);
        }
      });

      setSearchParams(nextParams);
    },
    [searchParams, setSearchParams],
  );

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
      const matchSegment =
        segment === 'all' || CATEGORY_FILTER_TO_HEBREW[segment] === c.contactCategory;
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        c.fullName.toLowerCase().includes(q) ||
        (c.companyName ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q) ||
        (c.email ?? '').toLowerCase().includes(q);
      const matchActive =
        activeFilter === 'all' ||
        (activeFilter === 'active' && c.isActive) ||
        (activeFilter === 'inactive' && !c.isActive);
      return matchSegment && matchSearch && matchActive;
    });
  }, [contacts, segment, search, activeFilter]);

  const hasActiveFilters =
    Boolean(search.trim()) || segment !== 'all' || activeFilter !== 'all';

  const resetFilters = () => {
    setSearch('');
    setSegment('all');
    setActiveFilter('all');
    updateSearchParams({ search: null, category: null, status: null });
  };

  const columns: DataTableColumn<Contact>[] = [
    { id: 'name', header: 'שם', width: '18%', cell: (c) => c.fullName },
    { id: 'company', header: 'חברה', width: '16%', cell: (c) => c.companyName || '—' },
    { id: 'category', header: 'קטגוריה', width: '140px', cell: (c) => c.contactCategory },
    { id: 'phone', header: 'טלפון', width: '130px', cell: (c) => c.phone || '—' },
    { id: 'email', header: 'מייל', width: '18%', cell: (c) => c.email || '—' },
    {
      id: 'status',
      header: 'סטטוס',
      width: '110px',
      align: 'center',
      cell: (c) => (
        <Badge variant={c.isActive ? 'success' : 'neutral'}>
          {c.status ?? (c.isActive ? 'פעיל' : 'לא פעיל')}
        </Badge>
      ),
    },
    {
      id: 'updated',
      header: 'עודכן',
      width: '110px',
      align: 'end',
      cell: (c) => formatContactDate(c.updatedAt),
    },
  ];

  if (isLoading) {
    return (
      <PageShell title="אנשי קשר" wide>
        <PageSpinner />
      </PageShell>
    );
  }
  if (error) {
    return (
      <PageShell title="אנשי קשר" wide>
        <ErrorState message={error.message} onRetry={() => refetch()} />
      </PageShell>
    );
  }

  return (
    <PageShell title="אנשי קשר" wide>
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
            aria-label="חיפוש אנשי קשר"
            value={search}
            onChange={(e) => {
              const value = e.target.value;
              setSearch(value);
              updateSearchParams({ search: value.trim() || null });
            }}
          />
        </FilterField>

        <FilterField label="קטגוריה">
          <SegmentedControl
            items={CATEGORY_FILTER_ITEMS}
            value={segment}
            onChange={(value) => {
              setSegment(value);
              updateSearchParams({ category: value !== 'all' ? value : null });
            }}
            ariaLabel="סינון לפי קטגוריה"
            size="sm"
          />
        </FilterField>

        <FilterField label="סטטוס">
          <div className="contactsPage__statusControl">
            <SegmentedControl
              items={STATUS_FILTER_ITEMS}
              value={activeFilter}
              onChange={(value) => {
                setActiveFilter(value);
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
