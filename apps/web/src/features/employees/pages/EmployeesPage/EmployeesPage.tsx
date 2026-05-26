import { useMemo, useState } from 'react';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { EmptyState } from '@shared/components/EmptyState';
import { Badge } from '@shared/components/Badge';
import { Input } from '@shared/components/Input';
import { useEmployees } from '../../hooks/useEmployees';
import './EmployeesPage.css';

export function EmployeesPage() {
  const { data: employees, isLoading, error, refetch } = useEmployees();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!employees) return [];
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.username.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.phone ?? '').includes(q),
    );
  }, [employees, search]);

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
      <Input
        placeholder="חיפוש עובד..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {filtered.length === 0 ? (
        <EmptyState title="לא נמצאו עובדים" />
      ) : (
        <div className="employeesPage__tableWrap">
          <table className="employeesPage__table">
            <thead>
              <tr>
                <th>שם</th>
                <th>אימייל</th>
                <th>טלפון</th>
                <th>תפקיד</th>
                <th>סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.userId}>
                  <td>{e.username}</td>
                  <td>{e.email}</td>
                  <td>{e.phone ?? '-'}</td>
                  <td>{e.roles.join(', ') || '-'}</td>
                  <td>
                    <Badge variant={e.isActive ? 'success' : 'neutral'}>
                      {e.isActive ? 'פעיל' : 'לא פעיל'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
