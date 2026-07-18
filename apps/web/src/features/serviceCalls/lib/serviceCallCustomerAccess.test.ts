import { describe, expect, it } from 'vitest';
import { resolveServiceCallCustomerAccessId } from './serviceCallCustomerAccess';
import {
  resolveCompatibleServiceCallSiteId,
} from './serviceCallSiteSelection';
import {
  resolveCustomerDrawerIntentAfterCustomerChange,
  shouldInvokeCustomerCreatedOnSave,
} from '@features/customers/lib/customerDrawerIntent';

const sites = [
  { siteId: 1, customerId: 3 },
  { siteId: 2, customerId: 4 },
  { siteId: 3, customerId: 3 },
];

describe('resolveServiceCallCustomerAccessId', () => {
  it('resolves currentServiceCall.customerId in review mode', () => {
    expect(
      resolveServiceCallCustomerAccessId({
        isEditing: false,
        formCustomerId: '99',
        persistedCustomerId: 7,
      }),
    ).toBe(7);
  });

  it('resolves form.customerId in edit mode', () => {
    expect(
      resolveServiceCallCustomerAccessId({
        isEditing: true,
        formCustomerId: '15',
        persistedCustomerId: 7,
      }),
    ).toBe(15);
  });

  it('returns 0 when the relevant customer id is missing', () => {
    expect(
      resolveServiceCallCustomerAccessId({
        isEditing: false,
        formCustomerId: '15',
        persistedCustomerId: null,
      }),
    ).toBe(0);
    expect(
      resolveServiceCallCustomerAccessId({
        isEditing: true,
        formCustomerId: '',
        persistedCustomerId: 7,
      }),
    ).toBe(0);
  });
});

describe('Service Call nested CustomerDrawer intent behavior', () => {
  it('closes CustomerDrawer intent when the Service Call customer changes', () => {
    expect(resolveCustomerDrawerIntentAfterCustomerChange()).toBe('closed');
  });

  it('does not treat existing-Customer saves as customer creation', () => {
    expect(shouldInvokeCustomerCreatedOnSave('view')).toBe(false);
    expect(shouldInvokeCustomerCreatedOnSave('manageSites')).toBe(false);
  });

  it('clears an incompatible site when the Service Call customer changes', () => {
    expect(resolveCompatibleServiceCallSiteId(2, sites, 3)).toBe('');
    expect(resolveCompatibleServiceCallSiteId(1, sites, 3)).toBe('1');
  });
});
