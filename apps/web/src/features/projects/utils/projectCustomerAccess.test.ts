import { describe, expect, it } from 'vitest';
import { resolveProjectCustomerAccessId } from './projectCustomerAccess';
import { applyProjectCustomerChange } from './projectSiteSelection';
import type { ProjectOverviewForm } from '../types';
import {
  resolveCustomerDrawerIntentAfterCustomerChange,
  shouldInvokeCustomerCreatedOnSave,
} from '@features/customers/lib/customerDrawerIntent';

function buildForm(overrides: Partial<ProjectOverviewForm> = {}): ProjectOverviewForm {
  return {
    title: 'פרויקט',
    description: '',
    status: 'Open',
    billingType: 'Fixed',
    customerId: 3,
    siteId: 12,
    createdAt: '',
    dealCloseDate: '',
    financeProjectNumber: '',
    invoiceNumber: '',
    ...overrides,
  };
}

describe('resolveProjectCustomerAccessId', () => {
  it('resolves persisted project customerId in review mode', () => {
    expect(
      resolveProjectCustomerAccessId({
        isEditMode: false,
        formCustomerId: 99,
        persistedCustomerId: 7,
      }),
    ).toBe(7);
  });

  it('resolves form.customerId in edit mode', () => {
    expect(
      resolveProjectCustomerAccessId({
        isEditMode: true,
        formCustomerId: 15,
        persistedCustomerId: 7,
      }),
    ).toBe(15);
  });

  it('returns 0 when the relevant customer id is missing', () => {
    expect(
      resolveProjectCustomerAccessId({
        isEditMode: false,
        formCustomerId: 15,
        persistedCustomerId: 0,
      }),
    ).toBe(0);
    expect(
      resolveProjectCustomerAccessId({
        isEditMode: true,
        formCustomerId: 0,
        persistedCustomerId: 7,
      }),
    ).toBe(0);
  });
});

describe('Project nested CustomerDrawer intent behavior', () => {
  it('closes CustomerDrawer intent when the Project customer changes', () => {
    expect(resolveCustomerDrawerIntentAfterCustomerChange()).toBe('closed');
  });

  it('does not change Project customerId or siteId for an existing-Customer save', () => {
    const form = buildForm({ customerId: 3, siteId: 12 });
    // Existing-customer onSaved must not call onCustomerCreated / applyProjectCustomerChange.
    expect(shouldInvokeCustomerCreatedOnSave('view')).toBe(false);
    expect(shouldInvokeCustomerCreatedOnSave('manageSites')).toBe(false);
    expect(form.customerId).toBe(3);
    expect(form.siteId).toBe(12);
  });

  it('still invokes onCustomerCreated only for new-Customer saves', () => {
    expect(shouldInvokeCustomerCreatedOnSave('create')).toBe(true);
  });

  it('preserves site-clearing when the Project customer changes', () => {
    const form = buildForm({ customerId: 3, siteId: 12 });
    const next = applyProjectCustomerChange(form, 8);
    expect(next.customerId).toBe(8);
    expect(next.siteId).toBe(0);
  });
});
