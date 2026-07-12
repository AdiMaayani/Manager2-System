import { describe, expect, it } from 'vitest';
import { getCreatedProjectSiteSelection } from './projectSiteSelection';

describe('getCreatedProjectSiteSelection', () => {
  it('selects a newly created site owned by the project customer', () => {
    expect(
      getCreatedProjectSiteSelection(3, { siteId: 12, customerId: 3 }),
    ).toBe(12);
  });

  it('rejects a newly created site owned by another customer', () => {
    expect(() =>
      getCreatedProjectSiteSelection(3, { siteId: 12, customerId: 4 }),
    ).toThrow('אינו שייך');
  });
});
