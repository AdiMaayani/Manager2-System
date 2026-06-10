import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { EmptyState } from '@shared/components/EmptyState';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { FilterBar } from '@shared/components/FilterBar';
import { Input } from '@shared/components/Input';
import { getEmployeesAsync, type Employee } from '@features/employees';
import { UserDrawer } from '../../components/UserDrawer';
import { useUserLookups, useUsers } from '../../hooks/useUsers';
import type { User } from '../../types';
import './UsersPage.css';

const ACTIVE_FILTERS = ['הכל', 'פעילים', 'לא פעילים'] as const;
type ActiveFilter = (typeof ACTIVE_FILTERS)[number];

function formatDate(value?: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getRoleDisplayLabel(role: string): string {
  const labels: Record<string, string> = {
    Admin: 'מנהל',
    DepartmentManager: 'מנהל מחלקה',
    TeamLeader: 'ראש צוות',
  };

  return labels[role] ?? role;
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
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('הכל');
  // undefined = drawer closed, null = create mode, User = review existing.
  const [drawerUser, setDrawerUser] = useState<User | null | undefined>(undefined);
  const [pageMessage, setPageMessage] = useState<string | null>(null);

  // Deep link: ?userId opens that user in read-only review mode, then the
  // param is removed (matching the Quotes ?quoteId behavior).
  useEffect(() => {
    const userIdParam = searchParams.get('userId');
    if (!userIdParam || !users) return;

    const requestedUser = users.find((user) => user.userId === Number(userIdParam));
    if (requestedUser) {
      setDrawerUser(requestedUser);
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('userId');
    setSearchParams(nextParams, { replace: true });
  }, [users, searchParams, setSearchParams]);

  const isDrawerOpen = drawerUser !== undefined;
  const selectedUserId = drawerUser?.userId ?? null;

  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);
  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [employee.employeeId, employee])),
    [employees],
  );

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
        activeFilter === 'הכל' ||
        (activeFilter === 'פעילים' && user.isActive) ||
        (activeFilter === 'לא פעילים' && !user.isActive);

      return matchesSearch && matchesActive;
    });
  }, [users, employeesById, search, activeFilter]);

  const openUser = (user: User) => {
    setPageMessage(null);
    setDrawerUser(user);
  };

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
          <Button
            onClick={() => {
              setPageMessage(null);
              setDrawerUser(null);
            }}
          >
            + משתמש חדש
          </Button>
        }
      >
        <div className="usersPage__filter usersPage__filter--search">
          <span className="usersPage__filterLabel">חיפוש</span>
          <Input
            placeholder="חיפוש משתמש, עובד, תפקיד או מחלקה..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="usersPage__filter">
          <span className="usersPage__filterLabel">סטטוס</span>
          <div className="usersPage__chips">
            {ACTIVE_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                className={`usersPage__chip${activeFilter === filter ? ' usersPage__chip--active' : ''}`}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </FilterBar>

      {pageMessage && <p className="usersPage__success">{pageMessage}</p>}

      {filteredUsers.length === 0 ? (
        <EmptyState
          title="לא נמצאו משתמשים"
          description="נסה לשנות סינון או להוסיף משתמש חדש"
        />
      ) : (
        <div className="usersPage__tableWrap">
          <table className="usersPage__table">
            <thead>
              <tr>
                <th>שם משתמש</th>
                <th>עובד מקושר</th>
                <th>אימייל</th>
                <th>תפקידים</th>
                <th>מחלקות</th>
                <th>סטטוס</th>
                <th>כניסה אחרונה</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.userId}
                  role="button"
                  tabIndex={0}
                  className={`usersPage__row ${
                    selectedUserId === user.userId ? 'usersPage__row--selected' : ''
                  }`.trim()}
                  onClick={() => openUser(user)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openUser(user);
                    }
                  }}
                >
                  <td>
                    <div className="usersPage__primaryCell">
                      <span>{user.username}</span>
                      <small>#{user.userId}</small>
                    </div>
                  </td>
                  <td>{getEmployeeName(employeesById, user.employeeId)}</td>
                  <td>{user.email}</td>
                  <td>
                    <div className="usersPage__badges">
                      {user.roles.map((role) => (
                        <Badge key={role} variant={role === 'Admin' ? 'primary' : 'neutral'}>
                          {getRoleDisplayLabel(role)}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="usersPage__badges">
                      {user.departments.map((department) => (
                        <Badge key={department} variant="neutral">
                          {department}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td>
                    <Badge variant={user.isActive ? 'success' : 'neutral'}>
                      {user.isActive ? 'פעיל' : 'לא פעיל'}
                    </Badge>
                  </td>
                  <td>{formatDate(user.lastLoginAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UserDrawer
        isOpen={isDrawerOpen}
        onClose={() => setDrawerUser(undefined)}
        user={drawerUser}
        employees={employees}
        roles={rolesQuery.data ?? []}
        departments={departmentsQuery.data ?? []}
        isLookupLoading={isLookupLoading}
        onSaved={(savedUser, message) => {
          setPageMessage(message);
          setDrawerUser(savedUser);
        }}
      />
    </PageShell>
  );
}
