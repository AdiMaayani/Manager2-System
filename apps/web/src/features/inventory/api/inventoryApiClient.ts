import { apiRequest } from '@api/client';
import type { CreateInventoryItemRequest, InventoryFilters, InventoryItem } from '../types';

function buildInventoryQuery(filters: InventoryFilters): string {
  const params = new URLSearchParams();

  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.category?.trim()) params.set('category', filters.category.trim());
  params.set('status', filters.status);
  if (filters.lowStockOnly) params.set('lowStockOnly', 'true');

  const query = params.toString();
  return query ? `?${query}` : '';
}

export function getInventoryItemsAsync(filters: InventoryFilters): Promise<InventoryItem[]> {
  return apiRequest<InventoryItem[]>(`/Inventory${buildInventoryQuery(filters)}`);
}

export function getInventoryItemByIdAsync(id: number): Promise<InventoryItem> {
  return apiRequest<InventoryItem>(`/Inventory/${id}`);
}

// Atomic create: the item and its (required) image are created in a single multipart request,
// so a new active item can never be persisted without an image and a retry cannot duplicate it.
export function createInventoryItemWithImageAsync(
  request: CreateInventoryItemRequest,
  file: File,
): Promise<InventoryItem> {
  const formData = new FormData();
  formData.append('skuCode', request.skuCode);
  formData.append('itemName', request.itemName);
  if (request.category != null) formData.append('category', request.category);
  formData.append('quantityOnHand', String(request.quantityOnHand));
  formData.append('unit', request.unit);
  if (request.minimumQuantity != null) {
    formData.append('minimumQuantity', String(request.minimumQuantity));
  }
  if (request.locationName != null) formData.append('locationName', request.locationName);
  if (request.notes != null) formData.append('notes', request.notes);
  formData.append('isActive', String(request.isActive));
  formData.append('file', file);

  return apiRequest<InventoryItem>('/Inventory/with-image', {
    method: 'POST',
    body: formData,
  });
}

export function updateInventoryItemAsync(
  id: number,
  request: CreateInventoryItemRequest,
): Promise<InventoryItem> {
  return apiRequest<InventoryItem>(`/Inventory/${id}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export function deactivateInventoryItemAsync(id: number): Promise<void> {
  return apiRequest<void>(`/Inventory/${id}`, { method: 'DELETE' });
}

export function uploadInventoryItemImageAsync(id: number, file: File): Promise<InventoryItem> {
  const formData = new FormData();
  formData.append('file', file);

  return apiRequest<InventoryItem>(`/Inventory/${id}/image`, {
    method: 'POST',
    body: formData,
  });
}

export function removeInventoryItemImageAsync(id: number): Promise<InventoryItem> {
  return apiRequest<InventoryItem>(`/Inventory/${id}/image`, { method: 'DELETE' });
}
