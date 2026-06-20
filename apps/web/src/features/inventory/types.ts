export type InventoryStatusFilter = 'active' | 'inactive' | 'all';

export interface InventoryItem {
  inventoryItemId: number;
  skuCode: string;
  itemName: string;
  category?: string;
  quantityOnHand: number;
  unit: string;
  minimumQuantity?: number;
  locationName?: string;
  notes?: string;
  isActive: boolean;
  // Absolute, browser-usable product image URL returned by the API. Absent when no image is set.
  imageUrl?: string;
}

export interface InventoryFilters {
  search?: string;
  category?: string;
  status: InventoryStatusFilter;
  lowStockOnly: boolean;
}

export type InventoryViewMode = 'card' | 'table';

export interface InventoryCategorySummary {
  name: string;
  activeCount: number;
  totalCount: number;
}

export interface CreateInventoryItemRequest {
  skuCode: string;
  itemName: string;
  category?: string;
  quantityOnHand: number;
  unit: string;
  minimumQuantity?: number;
  locationName?: string;
  notes?: string;
  isActive: boolean;
}
