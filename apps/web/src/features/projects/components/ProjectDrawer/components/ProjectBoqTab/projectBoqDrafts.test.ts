import { describe, expect, it } from 'vitest';
import type { ProjectBoqItem } from '../../../../types';
import {
  applyBoqDraftOverride,
  buildBoqDraftMap,
  clearBoqDraftOverride,
  draftFromBoqItem,
} from './projectBoqDrafts';

function makeItem(overrides: Partial<ProjectBoqItem> = {}): ProjectBoqItem {
  return {
    projectBoqItemId: 1,
    projectId: 100,
    itemDescription: 'Cable',
    quantity: 3,
    unit: 'מ׳',
    unitPrice: 12,
    sortOrder: 1,
    ...overrides,
  };
}

describe('buildBoqDraftMap', () => {
  it('derives every row from the server when there are no overrides', () => {
    const items = [makeItem({ projectBoqItemId: 1 }), makeItem({ projectBoqItemId: 2, itemDescription: 'Switch' })];
    const map = buildBoqDraftMap(items, {});
    expect(map[1]).toEqual(draftFromBoqItem(items[0]));
    expect(map[2].itemDescription).toBe('Switch');
  });

  it('keeps an edited field while untouched fields on the SAME dirty row follow server refreshes', () => {
    // User edits only the quantity on row 1 (server currently at quantity 3, unitPrice 10).
    const overrides = applyBoqDraftOverride({}, 1, { quantity: '99' });

    // A background refresh changes the server row's quantity and price.
    const refreshedItems = [makeItem({ projectBoqItemId: 1, quantity: 5, unitPrice: 15 })];
    const map = buildBoqDraftMap(refreshedItems, overrides);

    // The edited field stays at 99; the untouched unitPrice moves from the old value (10) to the
    // refreshed server value (15) on the very same dirty row.
    expect(map[1].quantity).toBe('99');
    expect(map[1].unitPrice).toBe('15');
  });

  it('keeps a dirty row edited while unrelated rows reflect refreshed server values', () => {
    const overrides = applyBoqDraftOverride({}, 1, { quantity: '99' });

    const refreshedItems = [
      makeItem({ projectBoqItemId: 1, unitPrice: 15 }),
      makeItem({ projectBoqItemId: 2, unitPrice: 25 }),
    ];
    const map = buildBoqDraftMap(refreshedItems, overrides);

    expect(map[1].quantity).toBe('99');
    expect(map[2].unitPrice).toBe('25');
  });
});

describe('applyBoqDraftOverride', () => {
  it('stores only the edited fields (partial override)', () => {
    const overrides = applyBoqDraftOverride({}, 1, { itemDescription: 'Cable XL' });
    expect(overrides[1]).toEqual({ itemDescription: 'Cable XL' });
  });

  it('merges multiple edits to the same row without dropping earlier fields', () => {
    const first = applyBoqDraftOverride({}, 1, { itemDescription: 'Cable XL' });
    const second = applyBoqDraftOverride(first, 1, { quantity: '7' });
    expect(second[1]).toEqual({ itemDescription: 'Cable XL', quantity: '7' });
  });

  it('does not affect unrelated rows', () => {
    const overrides = applyBoqDraftOverride(applyBoqDraftOverride({}, 1, { quantity: '9' }), 2, {
      unit: 'קומפ׳',
    });
    expect(overrides[1]).toEqual({ quantity: '9' });
    expect(overrides[2]).toEqual({ unit: 'קומפ׳' });
  });
});

describe('clearBoqDraftOverride', () => {
  it('reverts a row to the server value by dropping its override', () => {
    const items = [makeItem({ projectBoqItemId: 1, quantity: 3 })];
    const overrides = applyBoqDraftOverride({}, 1, { quantity: '99' });
    const cleared = clearBoqDraftOverride(overrides, 1);
    expect(cleared[1]).toBeUndefined();
    expect(buildBoqDraftMap(items, cleared)[1].quantity).toBe('3');
  });

  it('clears only the target row, leaving other dirty rows intact', () => {
    const overrides = applyBoqDraftOverride(applyBoqDraftOverride({}, 1, { quantity: '99' }), 2, {
      quantity: '5',
    });
    const cleared = clearBoqDraftOverride(overrides, 1);
    expect(cleared[1]).toBeUndefined();
    expect(cleared[2]).toEqual({ quantity: '5' });
  });

  it('returns the same object when there is nothing to clear', () => {
    const overrides = {};
    expect(clearBoqDraftOverride(overrides, 5)).toBe(overrides);
  });
});
