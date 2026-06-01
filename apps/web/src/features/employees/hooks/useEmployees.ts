import { useQuery } from '@tanstack/react-query';
import { isLocalDataMode } from '@/config/appConfig';
import { resolveDataAsync } from '@shared/data/resolveDataAsync';
import { mockEmployees, delayMock } from '@shared/mock';
import { getEmployeesAsync } from '../api/employeesApiClient';

export function useEmployees() {
  return useQuery({
    queryKey: ['employees', isLocalDataMode],
    queryFn: () =>
      resolveDataAsync(getEmployeesAsync, () => delayMock(mockEmployees)),
  });
}
