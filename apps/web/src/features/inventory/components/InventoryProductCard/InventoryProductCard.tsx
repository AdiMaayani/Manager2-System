import { Badge } from '@shared/components/Badge';
import { InventoryImage } from '../InventoryImage';
import { resolveInventoryItemImage } from '../../utils/productImages';
import { formatQuantity, isLowStock } from '../../utils/stock';
import type { InventoryItem } from '../../types';
import './InventoryProductCard.css';

interface InventoryProductCardProps {
  item: InventoryItem;
  isSelected: boolean;
  onSelect: (item: InventoryItem) => void;
}

// Image-first product tile. The whole card is a semantic button that opens the shared
// product drawer; it shows the most useful identity/stock information without overloading.
export function InventoryProductCard({ item, isSelected, onSelect }: InventoryProductCardProps) {
  const lowStock = isLowStock(item);
  // Product image only: uploaded → seeded SKU image → explicit missing state. Never a category image.
  const productImage = resolveInventoryItemImage(item);

  return (
    <button
      type="button"
      className={`inventoryProductCard ${isSelected ? 'inventoryProductCard--selected' : ''}`.trim()}
      onClick={() => onSelect(item)}
      aria-label={`פתיחת פרטי הפריט ${item.itemName}`}
    >
      <InventoryImage
        sources={productImage.sources}
        alt={item.itemName}
        variant="card"
        showMissingState
      />

      <div className="inventoryProductCard__body">
        <div className="inventoryProductCard__header">
          <span className="inventoryProductCard__name">{item.itemName}</span>
          <span className="inventoryProductCard__sku">{item.skuCode}</span>
        </div>

        {item.category && (
          <span className="inventoryProductCard__category">{item.category}</span>
        )}

        <div className="inventoryProductCard__stock">
          <span className={lowStock ? 'inventoryProductCard__quantity--low' : undefined}>
            {formatQuantity(item.quantityOnHand, item.unit)}
          </span>
        </div>

        <div className="inventoryProductCard__badges">
          <Badge variant={item.isActive ? 'success' : 'neutral'}>
            {item.isActive ? 'פעיל' : 'לא פעיל'}
          </Badge>
          {lowStock && <Badge variant="warning">מלאי נמוך</Badge>}
        </div>
      </div>
    </button>
  );
}
