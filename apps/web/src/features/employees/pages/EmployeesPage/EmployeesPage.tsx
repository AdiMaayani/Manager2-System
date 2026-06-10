import { useMemo, useState } from 'react';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { EmptyState } from '@shared/components/EmptyState';
import { Badge } from '@shared/components/Badge';
import { FilterBar } from '@shared/components/FilterBar';
import { Input } from '@shared/components/Input';
import { Button } from '@shared/components/Button';
import { getCurrentUser } from '@api/auth';
import { EmployeeDrawer } from '../../components/EmployeeDrawer';
import { useEmployees } from '../../hooks/useEmployees';
import type { Employee } from '../../types';
import './EmployeesPage.css';

export function EmployeesPage() {
  const { data: employees, isLoading, error, refetch } = useEmployees();
  const [search, setSearch] = useState('');
  // undefined = drawer closed, null = create mode, Employee = review existing.
  const [drawerEmployee, setDrawerEmployee] = useState<Employee | null | undefined>(undefined);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const currentUser = getCurrentUser();
  const canManageEmployees = currentUser?.roles.includes('Admin') ?? false;

  const isDrawerOpen = drawerEmployee !== undefined;
  const selectedEmployeeId = drawerEmployee?.employeeId ?? null;

  const filtered = useMemo(() => {
    if (!employees) return [];
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        e.primaryRole.toLowerCase().includes(q) ||
        (e.email ?? '').toLowerCase().includes(q) ||
        (e.phone ?? '').includes(q),
    );
  }, [employees, search]);

  const openEmployee = (employee: Employee) => {
    setDrawerEmployee(employee);
  };

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
          canManageEmployees ? (
            <Button onClick={() => setDrawerEmployee(null)}>+ עובד חדש</Button>
          ) : undefined
        }
      >
        <div className="employeesPage__filter employeesPage__filter--search">
          <span className="employeesPage__filterLabel">חיפוש</span>
          <Input
            placeholder="חיפוש עובד..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </FilterBar>

      {!canManageEmployees && (
        <p className="employeesPage__readonlyNote">
          ניהול עובדים זמין למנהלים בלבד. הרשימה מוצגת לקריאה בלבד.
        </p>
      )}

      {pageMessage && <p className="employeesPage__success">{pageMessage}</p>}

      {filtered.length === 0 ? (
        <EmptyState title="לא נמצאו עובדים" />
      ) : (
        <div className="employeesPage__tableWrap">
          <table className="employeesPage__table">
            <thead>
              <tr>
                <th>שם</th>
                <th>תפקיד</th>
                <th>טלפון</th>
                <th>אימייל</th>
                <th>קיבולת יומית</th>
                <th>ניתן לשיבוץ</th>
                <th>סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((employee) => (
                <tr
                  key={employee.employeeId}
                  role="button"
                  tabIndex={0}
                  className={`employeesPage__row ${
                    selectedEmployeeId === employee.employeeId
                      ? 'employeesPage__row--selected'
                      : ''
                  }`.trim()}
                  onClick={() => openEmployee(employee)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openEmployee(employee);
                    }
                  }}
                >
                  <td>{employee.fullName}</td>
                  <td>{employee.primaryRole || '—'}</td>
                  <td>{employee.phone ?? '—'}</td>
                  <td>{employee.email ?? '—'}</td>
                  <td>{employee.dailyCapacityHours ?? '—'}</td>
                  <td>
                    <Badge variant={employee.isAssignable ? 'success' : 'neutral'}>
                      {employee.isAssignable ? 'כן' : 'לא'}
                    </Badge>
                  </td>
                  <td>
                    <Badge variant={employee.isActive ? 'success' : 'neutral'}>
                      {employee.isActive ? 'פעיל' : 'לא פעיל'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EmployeeDrawer
        isOpen={isDrawerOpen}
        employee={drawerEmployee}
        canEdit={canManageEmployees}
        onClose={() => setDrawerEmployee(undefined)}
        onSaved={(savedEmployee, message) => {
          setPageMessage(message);
          setDrawerEmployee(savedEmployee);
          void refetch();
        }}
      />
    </PageShell>
  );
}
