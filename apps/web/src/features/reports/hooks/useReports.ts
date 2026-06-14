import { useQuery } from '@tanstack/react-query';
import { isLocalDataMode } from '@/config/appConfig';
import { resolveDataAsync } from '@shared/data/resolveDataAsync';
import { mockReports, delayMock } from '@shared/mock';
import { getReportsAsync } from '../api/reportsApiClient';

export function useReports(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['reports', isLocalDataMode],
    queryFn: () =>
      resolveDataAsync(getReportsAsync, () => delayMock(mockReports)),
    enabled: options?.enabled ?? true,
  });
}
