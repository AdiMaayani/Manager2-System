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
}

export interface InventoryFilters {
  search?: string;
  category?: string;
  status: InventoryStatusFilter;
  lowStockOnly: boolean;
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
