import { describe, expect, it } from 'vitest';
import {
  buildEntityDrawerSearchParams,
  CREATE_ENTITY_PARAM_VALUE,
  parseEntityDrawerParam,
  parseEntityIdParam,
  resolveDrawerEntity,
  selectEntityById,
} from './urlEntityDrawer';

interface TestRecord {
  id: number;
  name: string;
}

const records: TestRecord[] = [
  { id: 1, name: 'first' },
  { id: 2, name: 'second' },
];

const getId = (record: TestRecord) => record.id;

describe('parseEntityIdParam', () => {
  it('parses a plain positive decimal id', () => {
    expect(parseEntityIdParam('7')).toBe(7);
    expect(parseEntityIdParam('1234')).toBe(1234);
  });

  it('returns null for missing, blank, or non-numeric values', () => {
    expect(parseEntityIdParam(null)).toBeNull();
    expect(parseEntityIdParam('')).toBeNull();
    expect(parseEntityIdParam('   ')).toBeNull();
    expect(parseEntityIdParam('abc')).toBeNull();
  });

  it('rejects surrounding whitespace (no trimming)', () => {
    expect(parseEntityIdParam(' 7 ')).toBeNull();
    expect(parseEntityIdParam(' 7')).toBeNull();
    expect(parseEntityIdParam('7 ')).toBeNull();
  });

  it('rejects plus-decoded whitespace produced by URLSearchParams ("?id=+5" -> " 5")', () => {
    expect(parseEntityIdParam(new URLSearchParams('id=+5').get('id'))).toBeNull();
    // Explicitly encoded surrounding spaces (%20) decode to whitespace and are rejected too.
    expect(parseEntityIdParam(new URLSearchParams('id=%205%20').get('id'))).toBeNull();
  });

  it('rejects non-positive and non-integer ids so malformed links fail safely', () => {
    expect(parseEntityIdParam('0')).toBeNull();
    expect(parseEntityIdParam('-3')).toBeNull();
    expect(parseEntityIdParam('1.5')).toBeNull();
  });

  it('rejects hexadecimal, scientific notation, signs, and leading zeros', () => {
    expect(parseEntityIdParam('0x10')).toBeNull();
    expect(parseEntityIdParam('1e3')).toBeNull();
    expect(parseEntityIdParam('+5')).toBeNull();
    expect(parseEntityIdParam('01')).toBeNull();
  });

  it('rejects ids beyond the safe integer range', () => {
    expect(parseEntityIdParam(String(Number.MAX_SAFE_INTEGER + 1))).toBeNull();
    expect(parseEntityIdParam(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('parseEntityDrawerParam', () => {
  it('treats a missing or blank parameter as closed', () => {
    expect(parseEntityDrawerParam(null)).toEqual({ kind: 'closed' });
    expect(parseEntityDrawerParam('')).toEqual({ kind: 'closed' });
    expect(parseEntityDrawerParam('   ')).toEqual({ kind: 'closed' });
  });

  it('treats the exact reserved value as create mode, but rejects padded variants', () => {
    expect(parseEntityDrawerParam(CREATE_ENTITY_PARAM_VALUE)).toEqual({ kind: 'create' });
    expect(parseEntityDrawerParam(' new ')).toEqual({ kind: 'closed' });
    expect(parseEntityDrawerParam('New')).toEqual({ kind: 'closed' });
  });

  it('treats a positive integer as an existing record', () => {
    expect(parseEntityDrawerParam('5')).toEqual({ kind: 'existing', id: 5 });
  });

  it('fails safe (closed) for invalid values, including plus-decoded whitespace', () => {
    expect(parseEntityDrawerParam('0')).toEqual({ kind: 'closed' });
    expect(parseEntityDrawerParam('-3')).toEqual({ kind: 'closed' });
    expect(parseEntityDrawerParam('1.5')).toEqual({ kind: 'closed' });
    expect(parseEntityDrawerParam('abc')).toEqual({ kind: 'closed' });
    expect(parseEntityDrawerParam(new URLSearchParams('id=+5').get('id'))).toEqual({ kind: 'closed' });
  });
});

describe('selectEntityById', () => {
  it('returns null while data is still loading (items undefined)', () => {
    expect(selectEntityById(undefined, 1, getId)).toBeNull();
  });

  it('resolves the requested record once data has loaded', () => {
    expect(selectEntityById(records, 2, getId)).toEqual({ id: 2, name: 'second' });
  });

  it('returns null for a missing id or an id absent from loaded data', () => {
    expect(selectEntityById(records, null, getId)).toBeNull();
    expect(selectEntityById(records, 99, getId)).toBeNull();
  });
});

describe('resolveDrawerEntity (saved-record fallback)', () => {
  const savedRecord: TestRecord = { id: 5, name: 'freshly saved' };
  // The list observed at save time. The fallback is only trusted while the list is still this exact
  // reference (pre-refresh).
  const preRefreshItems: TestRecord[] = [];
  const pending = { entity: savedRecord, itemsRef: preRefreshItems };

  it('shows the saved record before the refresh, while the list is still the pre-refresh reference', () => {
    expect(resolveDrawerEntity(preRefreshItems, 5, getId, pending)).toEqual(savedRecord);
  });

  it('lets a freshly saved UPDATE win over the stale pre-refresh list record with the same id', () => {
    // The pre-refresh list already contains id 5 with the OLD values; showEntity stored the freshly
    // saved version. With the same items reference, the saved record must win over the stale list row.
    const staleItems: TestRecord[] = [{ id: 5, name: 'old' }];
    const savedUpdate: TestRecord = { id: 5, name: 'freshly saved' };
    const updatePending = { entity: savedUpdate, itemsRef: staleItems };

    expect(resolveDrawerEntity(staleItems, 5, getId, updatePending)).toEqual(savedUpdate);

    // After the refresh (new array reference), the loaded list is authoritative again.
    const refreshedWith: TestRecord[] = [{ id: 5, name: 'from server' }];
    expect(resolveDrawerEntity(refreshedWith, 5, getId, updatePending)).toEqual({
      id: 5,
      name: 'from server',
    });

    const refreshedWithout: TestRecord[] = [{ id: 9, name: 'other' }];
    expect(resolveDrawerEntity(refreshedWithout, 5, getId, updatePending)).toBeNull();
  });

  it('prefers the refreshed list record once it arrives, reconciling the fallback', () => {
    const refreshedItems: TestRecord[] = [{ id: 5, name: 'reconciled from server' }];
    expect(resolveDrawerEntity(refreshedItems, 5, getId, pending)).toEqual({
      id: 5,
      name: 'reconciled from server',
    });
  });

  it('expires the fallback once ANY refreshed list arrives that omits the record (returns null)', () => {
    // A new array reference (refresh completed) that does not contain id 5 must not fall back to the
    // stale saved snapshot.
    const refreshedWithout: TestRecord[] = [{ id: 9, name: 'other' }];
    expect(resolveDrawerEntity(refreshedWithout, 5, getId, pending)).toBeNull();
  });

  it('ignores the fallback when the URL requests a different id', () => {
    expect(resolveDrawerEntity(records, 2, getId, pending)).toEqual({ id: 2, name: 'second' });
    expect(resolveDrawerEntity(preRefreshItems, 2, getId, pending)).toBeNull();
  });

  it('ignores the fallback when the drawer is closed (no requested id)', () => {
    expect(resolveDrawerEntity(preRefreshItems, null, getId, pending)).toBeNull();
  });

  it('ignores a null pending fallback (helpers cleared it) even with a matching id', () => {
    expect(resolveDrawerEntity(preRefreshItems, 5, getId, null)).toBeNull();
  });
});

describe('buildEntityDrawerSearchParams (drawer transitions)', () => {
  it('closed to create writes the reserved value and preserves unrelated params', () => {
    const current = new URLSearchParams('search=abc&status=Open');
    const next = buildEntityDrawerSearchParams(current, 'contactId', { kind: 'create' });
    expect(next.get('contactId')).toBe(CREATE_ENTITY_PARAM_VALUE);
    expect(next.get('search')).toBe('abc');
    expect(next.get('status')).toBe('Open');
  });

  it('create to existing replaces the reserved value with the saved id', () => {
    const current = new URLSearchParams('contactId=new&search=abc');
    const next = buildEntityDrawerSearchParams(current, 'contactId', { kind: 'existing', id: 7 });
    expect(next.get('contactId')).toBe('7');
    expect(next.get('search')).toBe('abc');
  });

  it('existing to create swaps the id for the reserved value', () => {
    const current = new URLSearchParams('contactId=7');
    const next = buildEntityDrawerSearchParams(current, 'contactId', { kind: 'create' });
    expect(next.get('contactId')).toBe(CREATE_ENTITY_PARAM_VALUE);
  });

  it('close removes the parameter and normalizes the URL', () => {
    const current = new URLSearchParams('contactId=7&search=abc');
    const next = buildEntityDrawerSearchParams(current, 'contactId', { kind: 'closed' });
    expect(next.has('contactId')).toBe(false);
    expect(next.get('search')).toBe('abc');
  });

  it('does not mutate the incoming params', () => {
    const current = new URLSearchParams('contactId=7');
    buildEntityDrawerSearchParams(current, 'contactId', { kind: 'closed' });
    expect(current.get('contactId')).toBe('7');
  });
});
