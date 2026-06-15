import { useMemo, useState } from 'react';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { EmptyState } from '@shared/components/EmptyState';
import { Badge } from '@shared/components/Badge';
import { FilterBar } from '@shared/components/FilterBar';
import { useAuditLog } from '../../hooks/useAuditLog';
import type { AuditLogFilters } from '../../types';
import './AuditLogPage.css';

const ENTITY_TYPE_OPTIONS = [
  'User',
  'CustomerSystem',
  'CustomerSystemSecret',
  'ServiceCall',
  'WorkItem',
];

const SEVERITY_OPTIONS = ['Info', 'Warning', 'Critical'];

const SEVERITY_VARIANTS: Record<string, 'neutral' | 'warning' | 'danger'> = {
  Info: 'neutral',
  Warning: 'warning',
  Critical: 'danger',
};

function formatDateTime(value: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('he-IL');
}

// Local date input (yyyy-mm-dd) → ISO bounds covering the full day in the user's timezone.
function toDayStart(value: string): string | undefined {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00`).toISOString();
}

function toDayEnd(value: string): string | undefined {
  if (!value) return undefined;
  return new Date(`${value}T23:59:59`).toISOString();
}

export function AuditLogPage() {
  const [actionInput, setActionInput] = useState('');
  const [entityType, setEntityType] = useState('');
  const [severity, setSeverity] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const filters = useMemo<AuditLogFilters>(
    () => ({
      action: actionInput.trim() || undefined,
      entityType: entityType || undefined,
      severity: severity || undefined,
      fromUtc: toDayStart(fromDate),
      toUtc: toDayEnd(toDate),
      maxRows: 200,
    }),
    [actionInput, entityType, severity, fromDate, toDate],
  );

  const { data: entries, isLoading, error, refetch } = useAuditLog(filters);

  if (isLoading) {
    return (
      <PageShell title="יומן ביקורת" wide>
        <PageSpinner />
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell title="יומן ביקורת" wide>
        <ErrorState message={error.message} onRetry={() => refetch()} />
      </PageShell>
    );
  }

  const rows = entries ?? [];

  return (
    <PageShell title="יומן ביקורת" wide>
      <FilterBar>
        <div className="auditLogPage__filter">
          <span className="auditLogPage__filterLabel">פעולה</span>
          <input
            className="auditLogPage__input"
            placeholder="לדוגמה: LoginSucceeded"
            value={actionInput}
            onChange={(event) => setActionInput(event.target.value)}
          />
        </div>

        <div className="auditLogPage__filter">
          <span className="auditLogPage__filterLabel">סוג ישות</span>
          <select
            className="auditLogPage__select"
            value={entityType}
            onChange={(event) => setEntityType(event.target.value)}
          >
            <option value="">הכול</option>
            {ENTITY_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="auditLogPage__filter">
          <span className="auditLogPage__filterLabel">חומרה</span>
          <select
            className="auditLogPage__select"
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
          >
            <option value="">הכול</option>
            {SEVERITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="auditLogPage__filter">
          <span className="auditLogPage__filterLabel">מתאריך</span>
          <input
            className="auditLogPage__input"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </div>

        <div className="auditLogPage__filter">
          <span className="auditLogPage__filterLabel">עד תאריך</span>
          <input
            className="auditLogPage__input"
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
        </div>
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState title="לא נמצאו רשומות ביומן הביקורת" />
      ) : (
        <div className="auditLogPage__tableWrap">
          <table className="auditLogPage__table">
            <thead>
              <tr>
                <th>זמן</th>
                <th>משתמש</th>
                <th>פעולה</th>
                <th>סוג ישות</th>
                <th>מזהה ישות</th>
                <th>חומרה</th>
                <th>תיאור</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <tr key={entry.auditLogId} className="auditLogPage__row">
                  <td>{formatDateTime(entry.occurredAtUtc)}</td>
                  <td>{entry.userName ?? (entry.userId != null ? `#${entry.userId}` : '-')}</td>
                  <td>{entry.action}</td>
                  <td>{entry.entityType}</td>
                  <td>{entry.entityId ?? '-'}</td>
                  <td>
                    <Badge variant={SEVERITY_VARIANTS[entry.severity] ?? 'neutral'}>
                      {entry.severity}
                    </Badge>
                  </td>
                  <td>{entry.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
