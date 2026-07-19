import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useUrlEntityDrawer } from '@shared/hooks';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { Badge } from '@shared/components/Badge';
import { FilterBar, FilterField } from '@shared/components/FilterBar';
import { Input } from '@shared/components/Input';
import { Button } from '@shared/components/Button';
import { SegmentedControl, type SegmentItem } from '@shared/components/SegmentedControl';
import { InlineAlert } from '@shared/components/InlineAlert';
import { DataTable, type DataTableColumn } from '@shared/components/DataTable';
import { getCurrentUser } from '@api/auth';
import { EmployeeDrawer } from '../../components/EmployeeDrawer';
import { useEmployees } from '../../hooks/useEmployees';
import type { Employee } from '../../types';
import './EmployeesPage.css';

const STATUS_FILTERS = ['פעילים', 'בארכיון', 'הכול'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const DEFAULT_STATUS_FILTER: StatusFilter = 'הכול';

const STATUS_FILTER_ITEMS: SegmentItem<StatusFilter>[] = STATUS_FILTERS.map((filter) => ({
  id: filter,
  label: filter,
}));

// Hebrew SegmentedControl ids stay unchanged; URL uses stable English values.
// Default "הכול" omits the status parameter; "all" is accepted for direct links.
function statusFilterToUrlParam(status: StatusFilter): string | null {
  if (status === 'פעילים') return 'active';
  if (status === 'בארכיון') return 'inactive';
  return null;
}

function resolveStatusFilterParam(value: string | null): StatusFilter {
  if (value === 'active') return 'פעילים';
  if (value === 'inactive') return 'בארכיון';
  if (value === 'all' || value == null || value === '') return DEFAULT_STATUS_FILTER;
  return DEFAULT_STATUS_FILTER;
}

export function EmployeesPage() {
  const { data: employees, isLoading, error, refetch } = useEmployees();
  const [searchParams, setSearchParams] = useSearchParams();

  // Status is derived from the URL so back/forward restores it without a sync effect.
  const statusFilter = resolveStatusFilterParam(searchParams.get('status'));
  const urlSearchParam = searchParams.get('search') ?? '';

  const [search, setSearch] = useState(urlSearchParam);
  const [prevUrlSearch, setPrevUrlSearch] = useState(urlSearchParam);

  // When the URL search param changes (back/forward, clear filters), adjust the controlled
  // input during render — avoids a setState-in-effect lint violation. Skip overwrite while the
  // local value is ahead of the previous URL value (in-progress typing before the URL catches up).
  if (urlSearchParam !== prevUrlSearch) {
    const shouldSyncSearch =
      search === prevUrlSearch ||
      search.trim() === prevUrlSearch ||
      search === urlSearchParam ||
      search.trim() === urlSearchParam;
    setPrevUrlSearch(urlSearchParam);
    if (shouldSyncSearch) {
      setSearch(urlSearchParam);
    }
  }

  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const currentUser = getCurrentUser();
  const canManageEmployees = currentUser?.roles.includes('Admin') ?? false;

  // Filters persist to the URL; only named keys are updated so employeeId/new and unrelated
  // params are always preserved untouched.
  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        Object.entries(updates).forEach(([key, value]) => {
          if (value) {
            next.set(key, value);
          } else {
            next.delete(key);
          }
        });
        return next;
      });
    },
    [setSearchParams],
  );

  // The ?employeeId query parameter is the drawer's single source of truth: missing/invalid = closed,
  // "new" = create, a positive integer = reviewing that employee. State is derived from the URL, so
  // deep links and browser back/forward work without any URL→state effect.
  const {
    isDrawerOpen,
    isCreating,
    selectedEntity: drawerEmployee,
    selectedId: selectedEmployeeId,
    openEntity: openEmployee,
    openCreate,
    showEntity: showEmployee,
    close: closeDrawer,
  } = useUrlEntityDrawer<Employee>({
    paramName: 'employeeId',
    items: employees,
    getId: (employee) => employee.employeeId,
  });

  const filtered = useMemo(() => {
    if (!employees) return [];
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      const matchesStatus =
        statusFilter === 'הכול' ||
        (statusFilter === 'פעילים' && e.isActive) ||
        (statusFilter === 'בארכיון' && !e.isActive);
      if (!matchesStatus) return false;
      if (!q) return true;
      return (
        e.fullName.toLowerCase().includes(q) ||
        e.primaryRole.toLowerCase().includes(q) ||
        (e.professions ?? []).some((profession) => profession.toLowerCase().includes(q)) ||
        (e.email ?? '').toLowerCase().includes(q) ||
        (e.phone ?? '').includes(q)
      );
    });
  }, [employees, search, statusFilter]);

  const hasActiveFilters = Boolean(search.trim()) || statusFilter !== DEFAULT_STATUS_FILTER;

  const resetFilters = () => {
    updateSearchParams({ search: null, status: null });
  };

  const columns: DataTableColumn<Employee>[] = [
    { id: 'name', header: 'שם', width: '20%', cell: (employee) => employee.fullName },
    {
      id: 'role',
      header: 'מקצועות',
      width: '16%',
      cell: (employee) =>
        employee.professions?.length ? employee.professions.join(' · ') : employee.primaryRole || '—',
    },
    { id: 'phone', header: 'טלפון', width: '120px', cell: (employee) => employee.phone ?? '—' },
    { id: 'email', header: 'אימייל', width: '18%', cell: (employee) => employee.email ?? '—' },
    {
      id: 'capacity',
      header: 'קיבולת יומית',
      width: '110px',
      align: 'end',
      cell: (employee) => employee.dailyCapacityHours ?? '—',
    },
    {
      id: 'assignable',
      header: 'ניתן לשיבוץ',
      width: '110px',
      align: 'center',
      cell: (employee) => (
        <Badge variant={employee.isAssignable ? 'success' : 'neutral'}>
          {employee.isAssignable ? 'כן' : 'לא'}
        </Badge>
      ),
    },
    {
      id: 'status',
      header: 'סטטוס',
      width: '110px',
      align: 'center',
      cell: (employee) => (
        <Badge variant={employee.isActive ? 'success' : 'neutral'}>
          {employee.isActive ? 'פעיל' : 'לא פעיל'}
        </Badge>
      ),
    },
  ];

  if (isLoading) {
    return (
      <PageShell title="עובדים" wide>
        <PageSpinner />
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell title="עובדים" wide>
        <ErrorState message={error.message} onRetry={() => refetch()} />
      </PageShell>
    );
  }

  return (
    <PageShell title="עובדים" wide>
      <FilterBar
        actions={
          <>
            {hasActiveFilters && (
              <Button type="button" variant="ghost" onClick={resetFilters}>
                נקה סינון
              </Button>
            )}
            {canManageEmployees && (
              <Button iconStart={<Plus size={18} />} onClick={openCreate}>
                עובד חדש
              </Button>
            )}
          </>
        }
      >
        <FilterField label="חיפוש" grow>
          <Input
            placeholder="חיפוש עובד..."
            aria-label="חיפוש עובדים"
            value={search}
            onChange={(event) => {
              const value = event.target.value;
              setSearch(value);
              updateSearchParams({ search: value.trim() || null });
            }}
          />
        </FilterField>

        <FilterField label="סטטוס">
          <div className="employeesPage__statusControl">
            <SegmentedControl
              items={STATUS_FILTER_ITEMS}
              value={statusFilter}
              onChange={(value) => {
                updateSearchParams({ status: statusFilterToUrlParam(value) });
              }}
              ariaLabel="סינון לפי סטטוס"
              size="sm"
            />
          </div>
        </FilterField>
      </FilterBar>

      {!canManageEmployees && (
        <InlineAlert variant="info">
          ניהול עובדים זמין למנהלים בלבד. הרשימה מוצגת לקריאה בלבד.
        </InlineAlert>
      )}

      {pageMessage && (
        <InlineAlert variant="success" onDismiss={() => setPageMessage(null)}>
          {pageMessage}
        </InlineAlert>
      )}

      <DataTable
        columns={columns}
        rows={filtered}
        getRowId={(employee) => employee.employeeId}
        onRowClick={openEmployee}
        selectedRowId={selectedEmployeeId}
        emptyTitle="לא נמצאו עובדים"
        emptyDescription="התאימו את החיפוש או הוסיפו עובד חדש."
      />

      <EmployeeDrawer
        isOpen={isDrawerOpen}
        employee={isCreating ? null : drawerEmployee}
        canEdit={canManageEmployees}
        onClose={closeDrawer}
        onSaved={(savedEmployee, message) => {
          setPageMessage(message);
          showEmployee(savedEmployee);
          void refetch();
        }}
      />
    </PageShell>
  );
}
