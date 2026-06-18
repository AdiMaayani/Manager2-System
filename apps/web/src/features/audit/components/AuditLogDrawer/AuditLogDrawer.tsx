import { Drawer, useDrawerMaximize } from '@shared/components/Drawer';
import { DetailsSection } from '@shared/components/DetailsSection';
import { DetailsField } from '@shared/components/DetailsField';
import { StatusBadge } from '@shared/components/StatusBadge';
import { resolveStatus } from '@shared/status/statusRegistry';
import {
  buildAuditDisplaySummary,
  localizeAuditEntityType,
  localizeAuditLoginReason,
  localizeAuditMetadataKey,
} from '../../auditLabels';
import type { AuditLogEntry } from '../../types';
import './AuditLogDrawer.css';

interface AuditLogDrawerProps {
  entry: AuditLogEntry | null;
  isOpen: boolean;
  onClose: () => void;
}

function formatDateTime(value: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('he-IL');
}

interface MetadataRow {
  key: string;
  label: string;
  value: string;
}

// Localize a single metadata value. Status/priority codes reuse the shared status registry;
// login failure reasons reuse the audit reason map; arrays/booleans get readable Hebrew text.
function formatMetadataValue(key: string, value: unknown): string {
  if (value == null) return '—';

  if (Array.isArray(value)) {
    return value.length > 0 ? value.map((item) => String(item)).join(', ') : '—';
  }

  if (typeof value === 'boolean') {
    return value ? 'כן' : 'לא';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  const raw = String(value);

  if (key === 'reason') return localizeAuditLoginReason(raw);
  if (key === 'status') return resolveStatus('serviceCall', raw).label;
  if (key === 'priority') return resolveStatus('serviceCallPriority', raw).label;

  return raw;
}

// Parse the sanitized metadata JSON into localized key/value rows. Invalid JSON is ignored so a
// single bad row never breaks the drawer; the raw JSON is still available in the technical section.
function parseMetadataRows(metadataJson: string | null): MetadataRow[] {
  if (!metadataJson) return [];

  try {
    const parsed = JSON.parse(metadataJson) as Record<string, unknown>;
    if (parsed == null || typeof parsed !== 'object') return [];

    return Object.entries(parsed).map(([key, value]) => ({
      key,
      label: localizeAuditMetadataKey(key),
      value: formatMetadataValue(key, value),
    }));
  } catch {
    return [];
  }
}

export function AuditLogDrawer({ entry, isOpen, onClose }: AuditLogDrawerProps) {
  const { isMaximized, toggleMaximize } = useDrawerMaximize(isOpen);

  if (!isOpen || !entry) return null;

  const displaySummary = buildAuditDisplaySummary(entry);
  const metadataRows = parseMetadataRows(entry.metadataJson);
  const userDisplay = entry.userName ?? (entry.userId != null ? `#${entry.userId}` : '—');

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={displaySummary}
      isMaximized={isMaximized}
      onToggleMaximize={toggleMaximize}
      headerActions={<StatusBadge domain="severity" status={entry.severity} />}
    >
      <div className="auditLogDrawer">
        <DetailsSection title="מתי ומי">
          <div className="auditLogDrawer__grid">
            <DetailsField label="זמן" value={formatDateTime(entry.occurredAtUtc)} />
            <DetailsField label="משתמש" value={userDisplay} />
          </div>
        </DetailsSection>

        <DetailsSection title="ישות מטרה">
          <div className="auditLogDrawer__grid">
            <DetailsField label="סוג ישות" value={localizeAuditEntityType(entry.entityType)} />
            <DetailsField
              label="מזהה ישות"
              value={entry.entityId != null ? `#${entry.entityId}` : undefined}
            />
          </div>
        </DetailsSection>

        {metadataRows.length > 0 && (
          <DetailsSection title="הקשר">
            <div className="auditLogDrawer__grid">
              {metadataRows.map((row) => (
                <DetailsField key={row.key} label={row.label} value={row.value} />
              ))}
            </div>
          </DetailsSection>
        )}

        <DetailsSection title="מידע טכני">
          <div className="auditLogDrawer__grid">
            <DetailsField label="תיאור (מקור)" value={entry.summary} />
            <DetailsField label="קוד פעולה" value={entry.action} />
            <DetailsField label="קוד סוג ישות" value={entry.entityType} />
            <DetailsField label="כתובת IP" value={entry.clientIp} />
            <DetailsField label="מזהה רשומה" value={`#${entry.auditLogId}`} />
          </div>
          <DetailsField label="דפדפן (User Agent)" value={entry.userAgent} />
        </DetailsSection>
      </div>
    </Drawer>
  );
}
