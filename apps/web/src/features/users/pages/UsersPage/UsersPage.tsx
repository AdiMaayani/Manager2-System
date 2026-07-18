import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useUrlEntityDrawer } from '@shared/hooks';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { FilterBar, FilterField } from '@shared/components/FilterBar';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { InlineAlert } from '@shared/components/InlineAlert';
import { SegmentedControl, type SegmentItem } from '@shared/components/SegmentedControl';
import { DataTable, type DataTableColumn } from '@shared/components/DataTable';
import { getRoleDisplayLabel } from '@api/auth';
import { getEmployeesAsync, type Employee } from '@features/employees';
import { UserDrawer } from '../../components/UserDrawer';
import { useUserLookups, useUsers } from '../../hooks/useUsers';
import type { User } from '../../types';
import './UsersPage.css';

const ACTIVE_FILTERS = ['פעילים', 'מחוקים', 'הכול'] as const;
type ActiveFilter = (typeof ACTIVE_FILTERS)[number];

const ACTIVE_FILTER_ITEMS: SegmentItem<ActiveFilter>[] = ACTIVE_FILTERS.map((f) => ({
  id: f,
  label: f,
}));

function formatDate(value?: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getEmployeeName(employeesById: Map<number, Employee>, employeeId: number): string {
  return employeesById.get(employeeId)?.fullName ?? `עובד #${employeeId}`;
}

export function UsersPage() {
  const { data: users, isLoading, error, refetch } = useUsers();
  const { rolesQuery, departmentsQuery } = useUserLookups();
  const employeesQuery = useQuery({
    queryKey: ['users', 'employeesLookup'],
    queryFn: getEmployeesAsync,
    staleTime: 60_000,
  });

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('הכול');
  const [roleFilter, setRoleFilter] = useState('');
  const [pageMessage, setPageMessage] = useState<string | null>(null);

  // The ?userId query parameter is the drawer's single source of truth: missing/invalid = closed,
  // "new" = create, a positive integer = reviewing that user. State is derived from the URL, so
  // deep links and browser back/forward work without any URL→state effect.
  const {
    isDrawerOpen,
    isCreating,
    selectedEntity: drawerUser,
    selectedId: selectedUserId,
    openEntity,
    openCreate,
    showEntity,
    close: closeDrawer,
  } = useUrlEntityDrawer<User>({
    paramName: 'userId',
    items: users,
    getId: (user) => user.userId,
  });

  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);
  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [employee.employeeId, employee])),
    [employees],
  );

  const roleOptions = useMemo(() => {
    const roles = new Set<string>();
    (users ?? []).forEach((user) => user.roles.forEach((role) => roles.add(role)));
    return Array.from(roles).sort((a, b) =>
      getRoleDisplayLabel(a).localeCompare(getRoleDisplayLabel(b), 'he'),
    );
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (!users) return [];

    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const employeeName = getEmployeeName(employeesById, user.employeeId).toLowerCase();
      const matchesSearch =
        !query ||
        user.username.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        employeeName.includes(query) ||
        user.roles.some((role) => role.toLowerCase().includes(query)) ||
        user.departments.some((department) => department.toLowerCase().includes(query));

      const matchesActive =
        activeFilter === 'הכול' ||
        (activeFilter === 'פעילים' && user.isActive) ||
        (activeFilter === 'מחוקים' && !user.isActive);

      const matchesRole = !roleFilter || user.roles.includes(roleFilter);

      return matchesSearch && matchesActive && matchesRole;
    });
  }, [users, employeesById, search, activeFilter, roleFilter]);

  const hasActiveFilters =
    Boolean(search.trim()) || activeFilter !== 'הכול' || Boolean(roleFilter);

  const resetFilters = () => {
    setSearch('');
    setActiveFilter('הכול');
    setRoleFilter('');
  };

  const openUser = (user: User) => {
    setPageMessage(null);
    openEntity(user);
  };

  const openCreateUser = () => {
    setPageMessage(null);
    openCreate();
  };

  const columns: DataTableColumn<User>[] = [
    {
      id: 'username',
      header: 'שם משתמש',
      cell: (user) => (
        <div className="usersPage__primaryCell">
          <span>{user.username}</span>
          <small>#{user.userId}</small>
        </div>
      ),
    },
    {
      id: 'employee',
      header: 'עובד מקושר',
      cell: (user) => getEmployeeName(employeesById, user.employeeId),
    },
    { id: 'email', header: 'אימייל', cell: (user) => user.email },
    {
      id: 'roles',
      header: 'תפקידים',
      cell: (user) => (
        <div className="usersPage__badges">
          {user.roles.map((role) => (
            <Badge key={role} variant={role === 'Admin' ? 'primary' : 'neutral'}>
              {getRoleDisplayLabel(role)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: 'departments',
      header: 'מחלקות',
      cell: (user) => (
        <div className="usersPage__badges">
          {user.departments.map((department) => (
            <Badge key={department} variant="neutral">
              {department}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'סטטוס',
      cell: (user) => (
        <Badge variant={user.isActive ? 'success' : 'neutral'}>
          {user.isActive ? 'פעיל' : 'לא פעיל'}
        </Badge>
      ),
    },
    { id: 'lastLogin', header: 'כניסה אחרונה', cell: (user) => formatDate(user.lastLoginAt) },
  ];

  const isLookupLoading =
    employeesQuery.isLoading || rolesQuery.isLoading || departmentsQuery.isLoading;
  const lookupError = employeesQuery.error ?? rolesQuery.error ?? departmentsQuery.error;

  if (isLoading || isLookupLoading) {
    return (
      <PageShell title="ניהול משתמשים" wide>
        <PageSpinner />
      </PageShell>
    );
  }

  if (error || lookupError) {
    const message =
      error instanceof Error
        ? error.message
        : lookupError instanceof Error
          ? lookupError.message
          : 'טעינת ניהול המשתמשים נכשלה';

    return (
      <PageShell title="ניהול משתמשים" wide>
        <ErrorState
          message={message}
          onRetry={() => {
            refetch();
            employeesQuery.refetch();
            rolesQuery.refetch();
            departmentsQuery.refetch();
          }}
        />
      </PageShell>
    );
  }

  return (
    <PageShell title="ניהול משתמשים" wide>
      <FilterBar
        actions={
          <>
            {hasActiveFilters && (
              <Button type="button" variant="ghost" onClick={resetFilters}>
                נקה סינון
              </Button>
            )}
            <Button iconStart={<Plus size={18} />} onClick={openCreateUser}>
              משתמש חדש
            </Button>
          </>
        }
      >
        <FilterField label="חיפוש" grow>
          <Input
            placeholder="חיפוש משתמש, עובד, תפקיד או מחלקה..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
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

        <FilterField label="תפקיד">
          <Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">כל התפקידים</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {getRoleDisplayLabel(role)}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      {pageMessage && (
        <InlineAlert variant="success" onDismiss={() => setPageMessage(null)}>
          {pageMessage}
        </InlineAlert>
      )}

      <DataTable
        columns={columns}
        rows={filteredUsers}
        getRowId={(user) => user.userId}
        onRowClick={openUser}
        selectedRowId={selectedUserId}
        minWidth={980}
        emptyTitle="לא נמצאו משתמשים"
        emptyDescription="נסה לשנות סינון או להוסיף משתמש חדש"
      />

      <UserDrawer
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        user={isCreating ? null : drawerUser}
        employees={employees}
        roles={rolesQuery.data ?? []}
        departments={departmentsQuery.data ?? []}
        isLookupLoading={isLookupLoading}
        onSaved={(savedUser, message) => {
          setPageMessage(message);
          showEntity(savedUser);
        }}
      />
    </PageShell>
  );
}
