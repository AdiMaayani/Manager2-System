import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isLocalDataMode } from '@/config/appConfig';
import { resolveDataAsync } from '@shared/data/resolveDataAsync';
import { mockCustomers, delayMock } from '@shared/mock';
import {
  getCustomersAsync,
  createCustomerAsync,
  updateCustomerAsync,
  deactivateCustomerAsync,
} from '../api/customersApiClient';
import type { CreateCustomerRequest } from '../types';

export function useCustomers() {
  return useQuery({
    queryKey: ['customers', isLocalDataMode],
    queryFn: () =>
      resolveDataAsync(getCustomersAsync, () => delayMock(mockCustomers)),
  });
}

export function useCustomerMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['customers'] });

  const createMutation = useMutation({
    mutationFn: (request: CreateCustomerRequest) =>
      isLocalDataMode
        ? createCustomerAsync(request)
        : delayMock({ ...request, customerId: Date.now() } as never),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, request }: { id: number; request: CreateCustomerRequest }) =>
      isLocalDataMode ? updateCustomerAsync(id, request) : delayMock(undefined),
    onSuccess: invalidate,
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) =>
      isLocalDataMode ? deactivateCustomerAsync(id) : delayMock(undefined),
    onSuccess: invalidate,
  });

  return { createMutation, updateMutation, deactivateMutation };
}
