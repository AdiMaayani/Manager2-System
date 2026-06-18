import { Package } from 'lucide-react';
import { InventoryImage } from '../InventoryImage';
import { categoryDisplayName, resolveCategoryImage } from '../../utils/categoryImages';
import './InventoryCategoryCard.css';

interface InventoryCategoryCardProps {
  name: string;
  activeCount: number;
  onSelect: (name: string) => void;
}

// Clickable category tile shown on the inventory overview. The whole card is a single
// semantic button so it is keyboard-focusable and works with assistive technology.
export function InventoryCategoryCard({ name, activeCount, onSelect }: InventoryCategoryCardProps) {
  const label = categoryDisplayName(name);

  return (
    <button
      type="button"
      className="inventoryCategoryCard"
      onClick={() => onSelect(name)}
      aria-label={`${label} — ${activeCount} פריטים פעילים`}
    >
      <InventoryImage src={resolveCategoryImage(name)} alt={label} variant="category" />
      <div className="inventoryCategoryCard__body">
        <span className="inventoryCategoryCard__name">{label}</span>
        <span className="inventoryCategoryCard__count">
          <Package size={15} aria-hidden="true" />
          {activeCount} פריטים פעילים
        </span>
      </div>
    </button>
  );
}
