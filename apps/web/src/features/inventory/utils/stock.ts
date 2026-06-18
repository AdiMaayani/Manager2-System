import type { InventoryItem } from '../types';

// Shared low-stock rule used by the table, cards, and drawer so the warning is consistent everywhere.
export function isLowStock(inventoryItem: InventoryItem): boolean {
  return (
    inventoryItem.minimumQuantity !== undefined &&
    inventoryItem.minimumQuantity !== null &&
    inventoryItem.quantityOnHand <= inventoryItem.minimumQuantity
  );
}

export function formatQuantity(value: number, unit: string): string {
  return `${value.toLocaleString('he-IL', { maximumFractionDigits: 3 })} ${unit}`;
}
