import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  amendWorkReportAsync,
  finalizeWorkReportAsync,
  getReportByIdAsync,
  getReportsAsync,
  REPORTS_INVALIDATION,
  reverseWorkReportAsync,
} from '../api/reportsApiClient';

export function useReports(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['reports'],
    queryFn: getReportsAsync,
    enabled: options?.enabled ?? true,
  });
}

export function useReportDetail(reportId: number | null, enabled = true) {
  return useQuery({
    queryKey: REPORTS_INVALIDATION.detail(reportId ?? 0),
    queryFn: () => getReportByIdAsync(reportId!),
    enabled: enabled && reportId != null && reportId > 0,
  });
}

export function useFinalizeReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reportId: number) => finalizeWorkReportAsync(reportId),
    onSuccess: async (_data, reportId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: REPORTS_INVALIDATION.list }),
        queryClient.invalidateQueries({ queryKey: REPORTS_INVALIDATION.detail(reportId) }),
        queryClient.invalidateQueries({ queryKey: REPORTS_INVALIDATION.inventory }),
      ]);
    },
  });
}

export function useReverseReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, reason }: { reportId: number; reason: string }) =>
      reverseWorkReportAsync(reportId, { reason }),
    onSuccess: async (_data, { reportId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: REPORTS_INVALIDATION.list }),
        queryClient.invalidateQueries({ queryKey: REPORTS_INVALIDATION.detail(reportId) }),
        queryClient.invalidateQueries({ queryKey: REPORTS_INVALIDATION.inventory }),
      ]);
    },
  });
}

export function useAmendReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reportId: number) => amendWorkReportAsync(reportId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: REPORTS_INVALIDATION.list });
    },
  });
}
