import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
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

const DEFAULT_ACTIVE_FILTER: ActiveFilter = 'הכול';

const ACTIVE_FILTER_ITEMS: SegmentItem<ActiveFilter>[] = ACTIVE_FILTERS.map((f) => ({
  id: f,
  label: f,
}));

// Hebrew SegmentedControl ids stay unchanged; URL uses stable English values.
// Default "הכול" omits the status parameter; "all" is accepted for direct links.
function statusFilterToUrlParam(status: ActiveFilter): string | null {
  if (status === 'פעילים') return 'active';
  if (status === 'מחוקים') return 'inactive';
  return null;
}

function resolveStatusFilterParam(value: string | null): ActiveFilter {
  if (value === 'active') return 'פעילים';
  if (value === 'inactive') return 'מחוקים';
  if (value === 'all' || value == null || value === '') return DEFAULT_ACTIVE_FILTER;
  return DEFAULT_ACTIVE_FILTER;
}

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
  const [searchParams, setSearchParams] = useSearchParams();

  // Status / role are derived from the URL so back/forward restores them without a sync effect.
  const activeFilter = resolveStatusFilterParam(searchParams.get('status'));
  const roleFilter = searchParams.get('role') ?? '';
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

  // List filters only — never touch userId / new / unrelated params.
  const updateListFilterParams = useCallback(
    (updates: Partial<Record<'search' | 'status' | 'role', string | null>>) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        (Object.entries(updates) as Array<
          ['search' | 'status' | 'role', string | null | undefined]
        >).forEach(([key, value]) => {
          if (value == null || value === '') {
            next.delete(key);
          } else {
            next.set(key, value);
          }
        });
        return next;
      });
    },
    [setSearchParams],
  );

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
    Boolean(search.trim()) || activeFilter !== DEFAULT_ACTIVE_FILTER || Boolean(roleFilter);

  const resetFilters = () => {
    updateListFilterParams({ search: null, status: null, role: null });
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
      width: '16%',
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
      width: '16%',
      cell: (user) => getEmployeeName(employeesById, user.employeeId),
    },
    {
      id: 'email',
      header: 'אימייל',
      width: '18%',
      cell: (user) => user.email,
    },
    {
      id: 'roles',
      header: 'תפקידים',
      width: '16%',
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
      width: '14%',
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
      width: '100px',
      align: 'center',
      cell: (user) => (
        <Badge variant={user.isActive ? 'success' : 'neutral'}>
          {user.isActive ? 'פעיל' : 'לא פעיל'}
        </Badge>
      ),
    },
    {
      id: 'lastLogin',
      header: 'כניסה אחרונה',
      width: '140px',
      align: 'end',
      cell: (user) => formatDate(user.lastLoginAt),
    },
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
            aria-label="חיפוש משתמשים"
            value={search}
            onChange={(event) => {
              const value = event.target.value;
              setSearch(value);
              updateListFilterParams({ search: value.trim() || null });
            }}
          />
        </FilterField>

        <FilterField label="סטטוס">
          <div className="usersPage__statusControl">
            <SegmentedControl
              items={ACTIVE_FILTER_ITEMS}
              value={activeFilter}
              onChange={(value) => {
                updateListFilterParams({ status: statusFilterToUrlParam(value) });
              }}
              ariaLabel="סינון לפי סטטוס"
              size="sm"
            />
          </div>
        </FilterField>

        <FilterField label="תפקיד">
          <Select
            value={roleFilter}
            aria-label="סינון לפי תפקיד"
            onChange={(event) => {
              updateListFilterParams({ role: event.target.value || null });
            }}
          >
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
