import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createInventoryItemWithImageAsync,
  deactivateInventoryItemAsync,
  getInventoryItemsAsync,
  removeInventoryItemImageAsync,
  updateInventoryItemAsync,
  uploadInventoryItemImageAsync,
} from '../api/inventoryApiClient';
import type { CreateInventoryItemRequest, InventoryFilters } from '../types';

export function useInventory(filters: InventoryFilters, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['inventoryItems', filters],
    queryFn: () => getInventoryItemsAsync(filters),
    placeholderData: (previousData) => previousData,
    enabled: options?.enabled ?? true,
  });
}

export function useInventoryMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });

  // New products are always created through the image-required multipart endpoint. There is no
  // image-less JSON create mutation, so an active item can never be created without an image.
  const createWithImageMutation = useMutation({
    mutationFn: ({ request, file }: { request: CreateInventoryItemRequest; file: File }) =>
      createInventoryItemWithImageAsync(request, file),
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

  const uploadImageMutation = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) =>
      uploadInventoryItemImageAsync(id, file),
    onSuccess: invalidate,
  });

  const removeImageMutation = useMutation({
    mutationFn: (id: number) => removeInventoryItemImageAsync(id),
    onSuccess: invalidate,
  });

  return {
    createWithImageMutation,
    updateMutation,
    deactivateMutation,
    uploadImageMutation,
    removeImageMutation,
  };
}
