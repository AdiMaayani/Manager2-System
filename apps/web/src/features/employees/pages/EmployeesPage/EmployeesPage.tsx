import { useMemo, useState } from 'react';
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
const STATUS_FILTER_ITEMS: SegmentItem<StatusFilter>[] = STATUS_FILTERS.map((f) => ({
  id: f,
  label: f,
}));

export function EmployeesPage() {
  const { data: employees, isLoading, error, refetch } = useEmployees();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('הכול');
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const currentUser = getCurrentUser();
  const canManageEmployees = currentUser?.roles.includes('Admin') ?? false;

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

  const hasActiveFilters = Boolean(search.trim()) || statusFilter !== 'הכול';

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('הכול');
  };

  const columns: DataTableColumn<Employee>[] = [
    { id: 'name', header: 'שם', cell: (employee) => employee.fullName },
    {
      id: 'role',
      header: 'מקצועות',
      cell: (employee) =>
        employee.professions?.length ? employee.professions.join(' · ') : employee.primaryRole || '—',
    },
    { id: 'phone', header: 'טלפון', cell: (employee) => employee.phone ?? '—' },
    { id: 'email', header: 'אימייל', cell: (employee) => employee.email ?? '—' },
    {
      id: 'capacity',
      header: 'קיבולת יומית',
      cell: (employee) => employee.dailyCapacityHours ?? '—',
    },
    {
      id: 'assignable',
      header: 'ניתן לשיבוץ',
      cell: (employee) => (
        <Badge variant={employee.isAssignable ? 'success' : 'neutral'}>
          {employee.isAssignable ? 'כן' : 'לא'}
        </Badge>
      ),
    },
    {
      id: 'status',
      header: 'סטטוס',
      cell: (employee) => (
        <Badge variant={employee.isActive ? 'success' : 'neutral'}>
          {employee.isActive ? 'פעיל' : 'לא פעיל'}
        </Badge>
      ),
    },
  ];

  if (isLoading) return <PageShell title="עובדים"><PageSpinner /></PageShell>;
  if (error) {
    return (
      <PageShell title="עובדים">
        <ErrorState message={error.message} onRetry={() => refetch()} />
      </PageShell>
    );
  }

  return (
    <PageShell title="עובדים">
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
