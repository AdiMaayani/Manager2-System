import { useQuery } from '@tanstack/react-query';
import { isLocalDataMode } from '@/config/appConfig';
import { resolveDataAsync } from '@shared/data/resolveDataAsync';
import { mockCustomers, delayMock } from '@shared/mock';
import { getCustomersAsync } from '../api/customersApiClient';

export function useCustomers() {
  return useQuery({
    queryKey: ['customers', isLocalDataMode],
    queryFn: () =>
      resolveDataAsync(getCustomersAsync, () => delayMock(mockCustomers)),
  });
}
