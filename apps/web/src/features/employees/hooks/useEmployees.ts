import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isLocalDataMode } from '@/config/appConfig';
import { resolveDataAsync } from '@shared/data/resolveDataAsync';
import { mockEmployees, delayMock } from '@shared/mock';
import {
  createEmployeeAsync,
  getEmployeeLookupAsync,
  getEmployeesAsync,
  setEmployeeActiveStatusAsync,
  updateEmployeeAsync,
} from '../api/employeesApiClient';
import type { EmployeeLookupItem, UpsertEmployeeRequest } from '../types';

export function useEmployees() {
  return useQuery({
    queryKey: ['employees', isLocalDataMode],
    queryFn: () =>
      resolveDataAsync(getEmployeesAsync, () => delayMock(mockEmployees)),
  });
}

// Lightweight employee lookup (id/name/scheduling fields only). Used where full roster access is not
// granted (e.g. the shared dashboard) and gated by the caller via `enabled`.
export function useEmployeeLookup(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['employees', 'lookup', isLocalDataMode],
    queryFn: () =>
      resolveDataAsync<EmployeeLookupItem[]>(
        getEmployeeLookupAsync,
        () => delayMock(mockEmployees as EmployeeLookupItem[]),
      ),
    enabled: options?.enabled ?? true,
  });
}

export function useEmployeeMutations() {
  const queryClient = useQueryClient();
  const invalidateEmployees = () => queryClient.invalidateQueries({ queryKey: ['employees'] });

  const createMutation = useMutation({
    mutationFn: (request: UpsertEmployeeRequest) => createEmployeeAsync(request),
    onSuccess: invalidateEmployees,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, request }: { id: number; request: UpsertEmployeeRequest }) =>
      updateEmployeeAsync(id, request),
    onSuccess: invalidateEmployees,
  });

  const activeStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      setEmployeeActiveStatusAsync(id, { isActive }),
    onSuccess: invalidateEmployees,
  });

  return { createMutation, updateMutation, activeStatusMutation };
}
