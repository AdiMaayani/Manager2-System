import './SegmentedControl.css';

export interface SegmentItem<T extends string> {
  id: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  items: SegmentItem<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
}

/**
 * Canonical pill segmented control for filter/scope/view switches. Replaces the
 * various local chip implementations so all toggles look and behave the same.
 */
export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  size = 'md',
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`segmented segmented--${size}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const isActive = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`segmented__item ${isActive ? 'segmented__item--active' : ''}`.trim()}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
