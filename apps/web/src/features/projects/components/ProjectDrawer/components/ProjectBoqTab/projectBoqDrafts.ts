import type { ProjectBoqItem } from '../../../../types';
import { BOQ_UNIT_OPTIONS } from '../../../../utils/projectDisplayUtils';

export interface BoqDraft {
  systemName: string;
  inventoryCategory: string;
  inventoryItemId: string;
  itemDescription: string;
  quantity: string;
  unit: string;
  unitPrice: string;
}

export const EMPTY_BOQ_DRAFT: BoqDraft = {
  systemName: '',
  inventoryCategory: '',
  inventoryItemId: '',
  itemDescription: '',
  quantity: '1',
  unit: BOQ_UNIT_OPTIONS[0],
  unitPrice: '',
};

// A row's dirty state stores only the fields the user has actually edited. Untouched fields are not
// captured, so they keep tracking the latest server value even while the row is dirty.
export type BoqDraftOverride = Partial<BoqDraft>;
export type BoqDraftOverrides = Record<number, BoqDraftOverride>;

export function formatBoqQuantity(quantity: number): string {
  return String(quantity);
}

// The editable draft that mirrors a server row's current values. Used as the display value for
// rows the user has not touched.
export function draftFromBoqItem(item: ProjectBoqItem): BoqDraft {
  return {
    systemName: item.systemName ?? '',
    inventoryCategory: item.inventoryCategory ?? '',
    inventoryItemId: item.inventoryItemId ? String(item.inventoryItemId) : '',
    itemDescription: item.itemDescription,
    quantity: formatBoqQuantity(item.quantity),
    unit: item.unit,
    unitPrice: item.unitPrice != null ? String(item.unitPrice) : '',
  };
}

// The draft shown for a single row: the fresh server draft with only the user's edited fields
// layered on top. Edited fields therefore survive background query refreshes, while every untouched
// field in the same row (and in untouched rows) always reflects the freshest server data.
export function resolveBoqDraft(
  item: ProjectBoqItem,
  overrides: BoqDraftOverrides,
): BoqDraft {
  const serverDraft = draftFromBoqItem(item);
  const override = overrides[item.projectBoqItemId];
  return override ? { ...serverDraft, ...override } : serverDraft;
}

// Build the full id → draft map from the server rows plus any dirty partial overrides.
export function buildBoqDraftMap(
  items: readonly ProjectBoqItem[],
  overrides: BoqDraftOverrides,
): Record<number, BoqDraft> {
  return Object.fromEntries(
    items.map((item) => [item.projectBoqItemId, resolveBoqDraft(item, overrides)]),
  );
}

// Merge an edited-field patch onto the row's existing partial override (or start a new one). Only
// the touched fields are retained, so repeated edits accumulate while untouched fields keep
// following the server value.
export function applyBoqDraftOverride(
  overrides: BoqDraftOverrides,
  boqItemId: number,
  patch: Partial<BoqDraft>,
): BoqDraftOverrides {
  return {
    ...overrides,
    [boqItemId]: { ...(overrides[boqItemId] ?? {}), ...patch },
  };
}

// Drop a row's override so it reverts to (reconciles with) the server value — used after a
// successful save or delete so the refreshed server row becomes the source of truth again.
export function clearBoqDraftOverride(
  overrides: BoqDraftOverrides,
  boqItemId: number,
): BoqDraftOverrides {
  if (!(boqItemId in overrides)) return overrides;
  const next = { ...overrides };
  delete next[boqItemId];
  return next;
}
