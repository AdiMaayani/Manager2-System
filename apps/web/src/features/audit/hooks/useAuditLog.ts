import { useQuery } from '@tanstack/react-query';
import { getAuditLogAsync } from '../api/auditApiClient';
import type { AuditLogEntry, AuditLogFilters } from '../types';

export function useAuditLog(filters: AuditLogFilters) {
  return useQuery<AuditLogEntry[]>({
    queryKey: ['auditLog', filters],
    queryFn: () => getAuditLogAsync(filters),
  });
}
