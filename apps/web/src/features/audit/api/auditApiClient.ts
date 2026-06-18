import { apiRequest } from '@api/client';
import type { AuditLogEntry, AuditLogFilters } from '../types';

// GET /api/audit with optional filters. Empty filters return the most recent rows (server-capped).
export function getAuditLogAsync(filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams();

  if (filters.search) params.set('search', filters.search);
  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.severity) params.set('severity', filters.severity);
  if (filters.fromUtc) params.set('fromUtc', filters.fromUtc);
  if (filters.toUtc) params.set('toUtc', filters.toUtc);
  if (filters.maxRows) params.set('maxRows', String(filters.maxRows));

  const queryString = params.toString();
  return apiRequest<AuditLogEntry[]>(`/audit${queryString ? `?${queryString}` : ''}`);
}
