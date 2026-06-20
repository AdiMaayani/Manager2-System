import { useEffect, useMemo, useState } from 'react';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { StatusBadge } from '@shared/components/StatusBadge';
import { Button } from '@shared/components/Button';
import { FilterBar, FilterField } from '@shared/components/FilterBar';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { SegmentedControl, type SegmentItem } from '@shared/components/SegmentedControl';
import { DataTable, type DataTableColumn } from '@shared/components/DataTable';
import { useAuditLog } from '../../hooks/useAuditLog';
import { AuditLogDrawer } from '../../components/AuditLogDrawer';
import {
  buildAuditDisplaySummary,
  localizeAuditAction,
  localizeAuditEntityType,
} from '../../auditLabels';
import type { AuditLogEntry, AuditLogFilters } from '../../types';
import './AuditLogPage.css';

const ENTITY_TYPE_OPTIONS = [
  'User',
  'CustomerSystem',
  'CustomerSystemSecret',
  'ServiceCall',
  'WorkItem',
];

const SEVERITY_FILTER_ITEMS: SegmentItem<string>[] = [
  { id: '', label: 'הכול' },
  { id: 'Info', label: 'מידע' },
  { id: 'Warning', label: 'אזהרה' },
  { id: 'Critical', label: 'קריטי' },
];

function formatDateTime(value: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('he-IL');
}

export function AuditLogPage() {
  // Single free-text search drives the backend `search` param (server-filtered + capped endpoint).
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [entityType, setEntityType] = useState('');
  const [severity, setSeverity] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const filters = useMemo<AuditLogFilters>(
    () => ({
      search: debouncedSearch.trim() || undefined,
      entityType: entityType || undefined,
      severity: severity || undefined,
      maxRows: 200,
    }),
    [debouncedSearch, entityType, severity],
  );

  const { data: entries, isLoading, error, refetch } = useAuditLog(filters);

  const hasActiveFilters =
    Boolean(search.trim()) || Boolean(entityType) || Boolean(severity);

  const resetFilters = () => {
    setSearch('');
    setEntityType('');
    setSeverity('');
  };

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
    { id: 'action', header: 'פעולה', cell: (entry) => localizeAuditAction(entry.action) },
    {
      id: 'entityType',
      header: 'סוג ישות',
      cell: (entry) => localizeAuditEntityType(entry.entityType),
    },
    { id: 'entityId', header: 'מזהה ישות', cell: (entry) => entry.entityId ?? '-' },
    {
      id: 'severity',
      header: 'חומרה',
      cell: (entry) => <StatusBadge domain="severity" status={entry.severity} />,
    },
    { id: 'summary', header: 'תיאור', cell: (entry) => buildAuditDisplaySummary(entry) },
  ];

  return (
    <PageShell title="יומן ביקורת" wide>
      <FilterBar
        actions={
          hasActiveFilters ? (
            <Button type="button" variant="ghost" onClick={resetFilters}>
              נקה סינון
            </Button>
          ) : undefined
        }
      >
        <FilterField label="חיפוש" grow>
          <Input
            type="search"
            placeholder="פעולה, תיאור, משתמש, סוג ישות או מזהה..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </FilterField>

        <FilterField label="סוג ישות">
          <Select value={entityType} onChange={(event) => setEntityType(event.target.value)}>
            <option value="">הכול</option>
            {ENTITY_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {localizeAuditEntityType(option)}
              </option>
            ))}
          </Select>
        </FilterField>

        <FilterField label="חומרה">
          <SegmentedControl
            items={SEVERITY_FILTER_ITEMS}
            value={severity}
            onChange={setSeverity}
            ariaLabel="סינון לפי חומרה"
            size="sm"
          />
        </FilterField>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(entry) => entry.auditLogId}
        onRowClick={(entry) => setSelectedEntry(entry)}
        selectedRowId={selectedEntry?.auditLogId ?? null}
        minWidth={980}
        emptyTitle="לא נמצאו רשומות ביומן הביקורת"
      />

      <AuditLogDrawer
        entry={selectedEntry}
        isOpen={selectedEntry != null}
        onClose={() => setSelectedEntry(null)}
      />
    </PageShell>
  );
}
