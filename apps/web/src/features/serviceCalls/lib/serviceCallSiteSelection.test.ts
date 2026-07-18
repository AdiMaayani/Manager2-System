import { describe, expect, it } from 'vitest';
import {
  filterServiceCallSitesByCustomer,
  resolveCompatibleServiceCallSiteId,
  resolveServiceCallHistoricalSiteOption,
} from './serviceCallSiteSelection';

const sites = [
  { siteId: 1, customerId: 3 },
  { siteId: 2, customerId: 4 },
  { siteId: 3, customerId: 3 },
];

describe('filterServiceCallSitesByCustomer', () => {
  it('returns only sites owned by the selected customer', () => {
    expect(filterServiceCallSitesByCustomer(sites, 3)).toEqual([
      { siteId: 1, customerId: 3 },
      { siteId: 3, customerId: 3 },
    ]);
  });

  it('returns no sites when no customer is selected', () => {
    expect(filterServiceCallSitesByCustomer(sites, null)).toEqual([]);
  });
});

describe('resolveCompatibleServiceCallSiteId', () => {
  it('keeps a site that belongs to the selected customer', () => {
    expect(resolveCompatibleServiceCallSiteId(1, sites, 3)).toBe('1');
  });

  it('clears a site that belongs to a different customer', () => {
    expect(resolveCompatibleServiceCallSiteId(2, sites, 3)).toBe('');
  });

  it('clears the site when the customer is cleared', () => {
    expect(resolveCompatibleServiceCallSiteId(1, sites, null)).toBe('');
  });
});

describe('resolveServiceCallHistoricalSiteOption', () => {
  const base = {
    isExistingServiceCall: true,
    formCustomerId: 3,
    formSiteId: 12,
    persistedCustomerId: 3,
    persistedSiteId: 12,
    persistedSiteName: 'מרפאה מרכזית',
    activeSiteIds: [] as number[],
  };

  it('returns no historical option when the current site is still active', () => {
    expect(
      resolveServiceCallHistoricalSiteOption({ ...base, activeSiteIds: [12] }),
    ).toBeNull();
  });

  it('surfaces a disabled historical option for a persisted missing site', () => {
    expect(resolveServiceCallHistoricalSiteOption(base)).toEqual({
      siteId: 12,
      label: 'מרפאה מרכזית — לא פעיל',
    });
  });

  it('hides the historical option when the customer changed', () => {
    expect(
      resolveServiceCallHistoricalSiteOption({ ...base, formCustomerId: 9, formSiteId: 0 }),
    ).toBeNull();
  });

  it('hides the historical option when the site changed', () => {
    expect(
      resolveServiceCallHistoricalSiteOption({ ...base, formSiteId: 77 }),
    ).toBeNull();
  });

  it('never shows a historical option in create mode', () => {
    expect(
      resolveServiceCallHistoricalSiteOption({ ...base, isExistingServiceCall: false }),
    ).toBeNull();
  });
});
