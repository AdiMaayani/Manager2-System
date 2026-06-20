import { EmptyState } from '@shared/components/EmptyState';
import { InventoryProductCard } from '../InventoryProductCard';
import type { InventoryItem } from '../../types';
import './InventoryProductGrid.css';

interface InventoryProductGridProps {
  items: InventoryItem[];
  selectedItemId: number | null;
  onSelectItem: (item: InventoryItem) => void;
  emptyTitle: string;
  emptyDescription?: string;
}

// Card view over the same filtered product dataset the table consumes. Selection and the
// drawer are owned by the page, so both views stay perfectly in sync.
export function InventoryProductGrid({
  items,
  selectedItemId,
  onSelectItem,
  emptyTitle,
  emptyDescription,
}: InventoryProductGridProps) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="inventoryProductGrid">
      {items.map((item) => (
        <InventoryProductCard
          key={item.inventoryItemId}
          item={item}
          isSelected={item.inventoryItemId === selectedItemId}
          onSelect={onSelectItem}
        />
      ))}
    </div>
  );
}
