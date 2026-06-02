import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isLocalDataMode } from '@/config/appConfig';
import { resolveDataAsync } from '@shared/data/resolveDataAsync';
import { delayMock, mockCustomers, mockEmployees, mockServiceCalls, mockSites } from '@shared/mock';
import {
  assignEmployeeToServiceCallAsync,
  closeServiceCallAsync,
  createServiceCallAsync,
  getServiceCallCustomersAsync,
  getServiceCallEmployeesAsync,
  getServiceCallsAsync,
  getServiceCallSitesAsync,
  updateServiceCallAsync,
} from '../api/serviceCallsApiClient';
import type { AssignServiceCallEmployeeRequest, UpsertServiceCallRequest } from '../types';

export function useServiceCalls() {
  return useQuery({
    queryKey: ['serviceCalls', isLocalDataMode],
    queryFn: () => resolveDataAsync(getServiceCallsAsync, () => delayMock(mockServiceCalls)),
  });
}

export function useServiceCallLookups() {
  const customersQuery = useQuery({
    queryKey: ['serviceCalls', 'customers', isLocalDataMode],
    queryFn: () =>
      resolveDataAsync(getServiceCallCustomersAsync, () => delayMock(mockCustomers)),
  });

  const sitesQuery = useQuery({
    queryKey: ['serviceCalls', 'sites', isLocalDataMode],
    queryFn: () => resolveDataAsync(getServiceCallSitesAsync, () => delayMock(mockSites)),
  });

  const employeesQuery = useQuery({
    queryKey: ['serviceCalls', 'employees', isLocalDataMode],
    queryFn: () =>
      resolveDataAsync(getServiceCallEmployeesAsync, () => delayMock(mockEmployees)),
  });

  return {
    customers: customersQuery.data ?? [],
    sites: sitesQuery.data ?? [],
    employees: employeesQuery.data ?? [],
    isLoading: customersQuery.isLoading || sitesQuery.isLoading || employeesQuery.isLoading,
    error: customersQuery.error ?? sitesQuery.error ?? employeesQuery.error,
    refetch: () => Promise.all([customersQuery.refetch(), sitesQuery.refetch(), employeesQuery.refetch()]),
  };
}

export function useServiceCallMutations() {
  const queryClient = useQueryClient();
  const invalidateServiceCalls = () => queryClient.invalidateQueries({ queryKey: ['serviceCalls'] });

  const createMutation = useMutation({
    mutationFn: (request: UpsertServiceCallRequest) => createServiceCallAsync(request),
    onSuccess: invalidateServiceCalls,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, request }: { id: number; request: UpsertServiceCallRequest }) =>
      updateServiceCallAsync(id, request),
    onSuccess: invalidateServiceCalls,
  });

  const closeMutation = useMutation({
    mutationFn: (id: number) => closeServiceCallAsync(id),
    onSuccess: invalidateServiceCalls,
  });

  const assignEmployeeMutation = useMutation({
    mutationFn: ({
      id,
      request,
    }: {
      id: number;
      request: AssignServiceCallEmployeeRequest;
    }) => assignEmployeeToServiceCallAsync(id, request),
    onSuccess: invalidateServiceCalls,
  });

  return { createMutation, updateMutation, closeMutation, assignEmployeeMutation };
}
