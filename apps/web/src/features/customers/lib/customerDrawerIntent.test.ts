import { describe, expect, it } from 'vitest';
import {
  isCanonicalCustomerLoadIntent,
  isNestedCustomerDrawerOpen,
  resolveCanonicalCustomerQueryId,
  resolveCustomerDrawerIntentAfterCustomerChange,
  shouldFetchCanonicalCustomerDetail,
  shouldInvokeCustomerCreatedOnSave,
  type NestedCustomerDrawerIntent,
} from './customerDrawerIntent';

describe('NestedCustomerDrawerIntent', () => {
  it('treats closed as the only non-open intent', () => {
    expect(isNestedCustomerDrawerOpen('closed')).toBe(false);
    expect(isNestedCustomerDrawerOpen('create')).toBe(true);
    expect(isNestedCustomerDrawerOpen('view')).toBe(true);
    expect(isNestedCustomerDrawerOpen('manageSites')).toBe(true);
  });

  it('uses the same canonical load path for view and manageSites', () => {
    expect(isCanonicalCustomerLoadIntent('view')).toBe(true);
    expect(isCanonicalCustomerLoadIntent('manageSites')).toBe(true);
    expect(isCanonicalCustomerLoadIntent('create')).toBe(false);
    expect(isCanonicalCustomerLoadIntent('closed')).toBe(false);

    expect(
      resolveCanonicalCustomerQueryId({ intent: 'view', accessCustomerId: 42 }),
    ).toBe(42);
    expect(
      resolveCanonicalCustomerQueryId({ intent: 'manageSites', accessCustomerId: 42 }),
    ).toBe(42);
    expect(
      resolveCanonicalCustomerQueryId({ intent: 'create', accessCustomerId: 42 }),
    ).toBe(0);
    expect(
      resolveCanonicalCustomerQueryId({ intent: 'closed', accessCustomerId: 42 }),
    ).toBe(0);
  });

  it('disables the Customer detail query while the drawer intent is closed', () => {
    expect(
      shouldFetchCanonicalCustomerDetail({
        intent: 'closed',
        customerId: 10,
        canViewCustomers: true,
      }),
    ).toBe(false);
  });

  it('does not request Customer detail without viewCustomers permission', () => {
    const intents: NestedCustomerDrawerIntent[] = ['view', 'manageSites'];
    for (const intent of intents) {
      expect(
        shouldFetchCanonicalCustomerDetail({
          intent,
          customerId: 10,
          canViewCustomers: false,
        }),
      ).toBe(false);
    }
  });

  it('fetches Customer detail only for authorized view/manageSites with a real id', () => {
    expect(
      shouldFetchCanonicalCustomerDetail({
        intent: 'view',
        customerId: 10,
        canViewCustomers: true,
      }),
    ).toBe(true);
    expect(
      shouldFetchCanonicalCustomerDetail({
        intent: 'manageSites',
        customerId: 10,
        canViewCustomers: true,
      }),
    ).toBe(true);
    expect(
      shouldFetchCanonicalCustomerDetail({
        intent: 'view',
        customerId: 0,
        canViewCustomers: true,
      }),
    ).toBe(false);
    expect(
      shouldFetchCanonicalCustomerDetail({
        intent: 'create',
        customerId: 10,
        canViewCustomers: true,
      }),
    ).toBe(false);
  });

  it('invokes onCustomerCreated only for new-Customer saves', () => {
    expect(shouldInvokeCustomerCreatedOnSave('create')).toBe(true);
    expect(shouldInvokeCustomerCreatedOnSave('view')).toBe(false);
    expect(shouldInvokeCustomerCreatedOnSave('manageSites')).toBe(false);
    expect(shouldInvokeCustomerCreatedOnSave('closed')).toBe(false);
  });

  it('closes the nested drawer intent when the parent Customer changes', () => {
    expect(resolveCustomerDrawerIntentAfterCustomerChange()).toBe('closed');
  });
});
