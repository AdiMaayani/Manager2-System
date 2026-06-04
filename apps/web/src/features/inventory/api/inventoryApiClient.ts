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

export function createInventoryItemAsync(
  request: CreateInventoryItemRequest,
): Promise<InventoryItem> {
  return apiRequest<InventoryItem>('/Inventory', {
    method: 'POST',
    body: JSON.stringify(request),
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
