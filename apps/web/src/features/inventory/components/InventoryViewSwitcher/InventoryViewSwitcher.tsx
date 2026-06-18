import { SegmentedControl } from '@shared/components/SegmentedControl';
import type { InventoryViewMode } from '../../types';

interface InventoryViewSwitcherProps {
  value: InventoryViewMode;
  onChange: (value: InventoryViewMode) => void;
}

const VIEW_ITEMS: { id: InventoryViewMode; label: string }[] = [
  { id: 'card', label: 'תצוגת כרטיסים' },
  { id: 'table', label: 'תצוגת טבלה' },
];

export function InventoryViewSwitcher({ value, onChange }: InventoryViewSwitcherProps) {
  return (
    <SegmentedControl
      items={VIEW_ITEMS}
      value={value}
      onChange={onChange}
      ariaLabel="בחירת תצוגת מלאי"
      size="sm"
    />
  );
}
