import { useMemo, useState } from 'react';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { StatusBadge } from '@shared/components/StatusBadge';
import { FilterBar, FilterField } from '@shared/components/FilterBar';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { DataTable, type DataTableColumn } from '@shared/components/DataTable';
import { useAuditLog } from '../../hooks/useAuditLog';
import type { AuditLogEntry, AuditLogFilters } from '../../types';
import './AuditLogPage.css';

const ENTITY_TYPE_OPTIONS = [
  'User',
  'CustomerSystem',
  'CustomerSystemSecret',
  'ServiceCall',
  'WorkItem',
];

const SEVERITY_OPTIONS = ['Info', 'Warning', 'Critical'];

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

  const columns: DataTableColumn<AuditLogEntry>[] = [
    { id: 'time', header: 'זמן', cell: (entry) => formatDateTime(entry.occurredAtUtc) },
    {
      id: 'user',
      header: 'משתמש',
      cell: (entry) => entry.userName ?? (entry.userId != null ? `#${entry.userId}` : '-'),
    },
    { id: 'action', header: 'פעולה', cell: (entry) => entry.action },
    { id: 'entityType', header: 'סוג ישות', cell: (entry) => entry.entityType },
    { id: 'entityId', header: 'מזהה ישות', cell: (entry) => entry.entityId ?? '-' },
    {
      id: 'severity',
      header: 'חומרה',
      cell: (entry) => <StatusBadge domain="severity" status={entry.severity} />,
    },
    { id: 'summary', header: 'תיאור', cell: (entry) => entry.summary },
  ];

  return (
    <PageShell title="יומן ביקורת" wide>
      <FilterBar>
        <FilterField label="פעולה" grow>
          <Input
            placeholder="לדוגמה: LoginSucceeded"
            value={actionInput}
            onChange={(event) => setActionInput(event.target.value)}
          />
        </FilterField>

        <FilterField label="סוג ישות">
          <Select value={entityType} onChange={(event) => setEntityType(event.target.value)}>
            <option value="">הכול</option>
            {ENTITY_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </FilterField>

        <FilterField label="חומרה">
          <Select value={severity} onChange={(event) => setSeverity(event.target.value)}>
            <option value="">הכול</option>
            {SEVERITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </FilterField>

        <FilterField label="מתאריך">
          <Input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </FilterField>

        <FilterField label="עד תאריך">
          <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </FilterField>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(entry) => entry.auditLogId}
        minWidth={980}
        emptyTitle="לא נמצאו רשומות ביומן הביקורת"
      />
    </PageShell>
  );
}
