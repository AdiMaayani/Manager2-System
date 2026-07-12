import { describe, expect, it } from 'vitest';
import {
  filterServiceCallSitesByCustomer,
  getCreatedServiceCallSiteSelection,
} from './serviceCallSiteSelection';

describe('serviceCallSiteSelection', () => {
  it('returns only sites owned by the selected customer', () => {
    expect(
      filterServiceCallSitesByCustomer(
        [
          { siteId: 1, customerId: 3 },
          { siteId: 2, customerId: 4 },
          { siteId: 3, customerId: 3 },
        ],
        3,
      ),
    ).toEqual([
      { siteId: 1, customerId: 3 },
      { siteId: 3, customerId: 3 },
    ]);
  });

  it('selects a newly created site owned by the selected customer', () => {
    expect(
      getCreatedServiceCallSiteSelection(3, { siteId: 12, customerId: 3 }),
    ).toBe('12');
  });

  it('rejects a newly created site owned by another customer', () => {
    expect(() =>
      getCreatedServiceCallSiteSelection(3, { siteId: 12, customerId: 4 }),
    ).toThrow('אינו שייך');
  });
});
