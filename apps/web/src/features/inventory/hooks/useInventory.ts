import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createInventoryItemAsync,
  deactivateInventoryItemAsync,
  getInventoryItemsAsync,
  updateInventoryItemAsync,
} from '../api/inventoryApiClient';
import type { CreateInventoryItemRequest, InventoryFilters } from '../types';

export function useInventory(filters: InventoryFilters) {
  return useQuery({
    queryKey: ['inventoryItems', filters],
    queryFn: () => getInventoryItemsAsync(filters),
    placeholderData: (previousData) => previousData,
  });
}

export function useInventoryMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });

  const createMutation = useMutation({
    mutationFn: (request: CreateInventoryItemRequest) => createInventoryItemAsync(request),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, request }: { id: number; request: CreateInventoryItemRequest }) =>
      updateInventoryItemAsync(id, request),
    onSuccess: invalidate,
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => deactivateInventoryItemAsync(id),
    onSuccess: invalidate,
  });

  return { createMutation, updateMutation, deactivateMutation };
}
