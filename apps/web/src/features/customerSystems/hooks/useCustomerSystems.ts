import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCustomerSystemAsync,
  createCustomerSystemSecretAsync,
  deactivateCustomerSystemAsync,
  deactivateCustomerSystemSecretAsync,
  getCustomerSystemSecretsAsync,
  getCustomerSystemsAsync,
  updateCustomerSystemAsync,
  updateCustomerSystemSecretAsync,
} from '../api/customerSystemsApiClient';
import type {
  CreateSecretRequest,
  SaveCustomerSystemRequest,
  UpdateSecretRequest,
} from '../types';

const systemsKey = (customerId: number) => ['customerSystems', customerId];
const secretsKey = (customerSystemId: number) => ['customerSystemSecrets', customerSystemId];

export function useCustomerSystems(customerId: number, enabled: boolean) {
  return useQuery({
    queryKey: systemsKey(customerId),
    queryFn: () => getCustomerSystemsAsync(customerId),
    enabled: enabled && customerId > 0,
  });
}

export function useCustomerSystemMutations(customerId: number) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: systemsKey(customerId) });

  const createMutation = useMutation({
    mutationFn: (request: SaveCustomerSystemRequest) =>
      createCustomerSystemAsync({ ...request, customerId }),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, request }: { id: number; request: SaveCustomerSystemRequest }) =>
      updateCustomerSystemAsync(id, request),
    onSuccess: invalidate,
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => deactivateCustomerSystemAsync(id),
    onSuccess: invalidate,
  });

  return { createMutation, updateMutation, deactivateMutation };
}

export function useCustomerSystemSecrets(customerSystemId: number, enabled: boolean) {
  return useQuery({
    queryKey: secretsKey(customerSystemId),
    queryFn: () => getCustomerSystemSecretsAsync(customerSystemId),
    enabled: enabled && customerSystemId > 0,
  });
}

export function useCustomerSystemSecretMutations(customerSystemId: number) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: secretsKey(customerSystemId) });

  const createMutation = useMutation({
    mutationFn: (request: CreateSecretRequest) =>
      createCustomerSystemSecretAsync(customerSystemId, request),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ secretId, request }: { secretId: number; request: UpdateSecretRequest }) =>
      updateCustomerSystemSecretAsync(customerSystemId, secretId, request),
    onSuccess: invalidate,
  });

  const deactivateMutation = useMutation({
    mutationFn: (secretId: number) =>
      deactivateCustomerSystemSecretAsync(customerSystemId, secretId),
    onSuccess: invalidate,
  });

  return { createMutation, updateMutation, deactivateMutation };
}
