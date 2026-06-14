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

export function useServiceCalls(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['serviceCalls', isLocalDataMode],
    queryFn: () => resolveDataAsync(getServiceCallsAsync, () => delayMock(mockServiceCalls)),
    enabled: options?.enabled ?? true,
  });
}

// The create/edit form lookups (customers, sites, employees) are only needed by users who can manage
// service calls and read customer/site data. `enabled` lets the page skip these fetches for view-only
// roles (e.g. technicians) so they never hit the now-protected /Customers and /Sites endpoints.
export function useServiceCallLookups(options?: { enabled?: boolean }) {
  const isEnabled = options?.enabled ?? true;

  const customersQuery = useQuery({
    queryKey: ['serviceCalls', 'customers', isLocalDataMode],
    queryFn: () =>
      resolveDataAsync(getServiceCallCustomersAsync, () => delayMock(mockCustomers)),
    enabled: isEnabled,
  });

  const sitesQuery = useQuery({
    queryKey: ['serviceCalls', 'sites', isLocalDataMode],
    queryFn: () => resolveDataAsync(getServiceCallSitesAsync, () => delayMock(mockSites)),
    enabled: isEnabled,
  });

  const employeesQuery = useQuery({
    queryKey: ['serviceCalls', 'employees', isLocalDataMode],
    queryFn: () =>
      resolveDataAsync(getServiceCallEmployeesAsync, () => delayMock(mockEmployees)),
    enabled: isEnabled,
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
