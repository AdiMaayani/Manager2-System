/** Canonical inventory usage types on work-report lines. */
export const INVENTORY_USAGE_TYPES = {
  Sold: 'Sold',
  Installed: 'Installed',
  Used: 'Used',
} as const;

export type InventoryUsageType =
  (typeof INVENTORY_USAGE_TYPES)[keyof typeof INVENTORY_USAGE_TYPES];

export const INVENTORY_USAGE_TYPE_LABELS: Record<InventoryUsageType, string> = {
  Sold: 'נמכר',
  Installed: 'הותקן',
  Used: 'נוצל',
};

export const INVENTORY_USAGE_TYPE_OPTIONS = (
  Object.keys(INVENTORY_USAGE_TYPES) as InventoryUsageType[]
).map((code) => ({
  code,
  label: INVENTORY_USAGE_TYPE_LABELS[code],
}));

export function isInventoryUsageType(
  value: string | null | undefined,
): value is InventoryUsageType {
  return (
    value === INVENTORY_USAGE_TYPES.Sold ||
    value === INVENTORY_USAGE_TYPES.Installed ||
    value === INVENTORY_USAGE_TYPES.Used
  );
}
