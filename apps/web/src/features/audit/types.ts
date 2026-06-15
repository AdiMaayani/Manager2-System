// Mirrors AuditLogResponseDto from the API (GET /api/audit).
export interface AuditLogEntry {
  auditLogId: number;
  occurredAtUtc: string;
  userId: number | null;
  userName: string | null;
  action: string;
  entityType: string;
  entityId: number | null;
  severity: string;
  summary: string;
  metadataJson: string | null;
  clientIp: string | null;
  userAgent: string | null;
}

// Optional filters accepted by the audit list endpoint.
export interface AuditLogFilters {
  action?: string;
  entityType?: string;
  severity?: string;
  fromUtc?: string;
  toUtc?: string;
  maxRows?: number;
}
