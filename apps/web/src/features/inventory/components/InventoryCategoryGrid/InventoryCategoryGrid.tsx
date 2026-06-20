import { InventoryCategoryCard } from '../InventoryCategoryCard';
import type { InventoryCategorySummary } from '../../types';
import './InventoryCategoryGrid.css';

interface InventoryCategoryGridProps {
  categories: InventoryCategorySummary[];
  onSelectCategory: (name: string) => void;
}

export function InventoryCategoryGrid({ categories, onSelectCategory }: InventoryCategoryGridProps) {
  return (
    <div className="inventoryCategoryGrid">
      {categories.map((category) => (
        <InventoryCategoryCard
          key={category.name}
          name={category.name}
          activeCount={category.activeCount}
          onSelect={onSelectCategory}
        />
      ))}
    </div>
  );
}
