import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCustomersAsync,
  createCustomerAsync,
  updateCustomerAsync,
  deactivateCustomerAsync,
} from '../api/customersApiClient';
import type { CreateCustomerRequest } from '../types';

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: getCustomersAsync,
  });
}

export function useCustomerMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['customers'] });

  const createMutation = useMutation({
    mutationFn: (request: CreateCustomerRequest) => createCustomerAsync(request),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, request }: { id: number; request: CreateCustomerRequest }) =>
      updateCustomerAsync(id, request),
    onSuccess: invalidate,
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => deactivateCustomerAsync(id),
    onSuccess: invalidate,
  });

  return { createMutation, updateMutation, deactivateMutation };
}
