import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isLocalDataMode } from '@/config/appConfig';
import { resolveDataAsync } from '@shared/data/resolveDataAsync';
import { mockEmployees, delayMock } from '@shared/mock';
import {
  createEmployeeAsync,
  getEmployeesAsync,
  setEmployeeActiveStatusAsync,
  updateEmployeeAsync,
} from '../api/employeesApiClient';
import type { UpsertEmployeeRequest } from '../types';

export function useEmployees() {
  return useQuery({
    queryKey: ['employees', isLocalDataMode],
    queryFn: () =>
      resolveDataAsync(getEmployeesAsync, () => delayMock(mockEmployees)),
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
