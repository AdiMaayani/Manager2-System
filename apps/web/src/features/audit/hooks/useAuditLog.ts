import { useQuery } from '@tanstack/react-query';
import { resolveDataAsync } from '@shared/data/resolveDataAsync';
import { isLocalDataMode } from '@/config/appConfig';
import { getAuditLogAsync } from '../api/auditApiClient';
import type { AuditLogEntry, AuditLogFilters } from '../types';

// Audit data is admin-only and has no meaningful mock fixture, so mock mode resolves to an empty list.
export function useAuditLog(filters: AuditLogFilters) {
  return useQuery<AuditLogEntry[]>({
    queryKey: ['auditLog', filters, isLocalDataMode],
    queryFn: () =>
      resolveDataAsync(
        () => getAuditLogAsync(filters),
        () => Promise.resolve<AuditLogEntry[]>([]),
      ),
  });
}
