import { describe, expect, it } from 'vitest';
import type { ProjectOverviewForm, Site } from '../types';
import {
  applyProjectCustomerChange,
  filterProjectSitesByCustomer,
  resolveProjectHistoricalSiteOption,
} from './projectSiteSelection';

function buildSite(siteId: number, customerId: number): Site {
  return {
    siteId,
    customerId,
    siteName: `אתר ${siteId}`,
    isPrimary: false,
    createdAt: '2026-01-01',
  };
}

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

describe('filterProjectSitesByCustomer', () => {
  it('returns only sites owned by the selected customer', () => {
    const sites = [buildSite(1, 3), buildSite(2, 4), buildSite(3, 3)];
    expect(filterProjectSitesByCustomer(sites, 3)).toEqual([
      buildSite(1, 3),
      buildSite(3, 3),
    ]);
  });

  it('returns no sites when no customer is selected', () => {
    const sites = [buildSite(1, 3)];
    expect(filterProjectSitesByCustomer(sites, 0)).toEqual([]);
  });
});

describe('applyProjectCustomerChange', () => {
  it('clears the selected site when the customer changes', () => {
    const form = buildForm({ customerId: 3, siteId: 12 });
    const next = applyProjectCustomerChange(form, 7);
    expect(next.customerId).toBe(7);
    expect(next.siteId).toBe(0);
  });

  it('keeps unrelated form fields intact', () => {
    const form = buildForm({ title: 'שדרוג מערכת', siteId: 5 });
    const next = applyProjectCustomerChange(form, 9);
    expect(next.title).toBe('שדרוג מערכת');
    expect(next.siteId).toBe(0);
  });

  it('does not resolve the old persisted site after a customer change', () => {
    // Persisted project on customer 3 / site 12; user switches to customer 7.
    const changed = applyProjectCustomerChange(buildForm({ customerId: 3, siteId: 12 }), 7);
    expect(changed.siteId).toBe(0);

    const historical = resolveProjectHistoricalSiteOption({
      isCreateMode: false,
      formCustomerId: changed.customerId,
      formSiteId: changed.siteId,
      persistedCustomerId: 3,
      persistedSiteId: 12,
      persistedSiteName: 'אתר ישן',
      activeSiteIds: [],
    });
    expect(historical).toBeNull();
  });
});

describe('resolveProjectHistoricalSiteOption', () => {
  const base = {
    isCreateMode: false,
    formCustomerId: 3,
    formSiteId: 12,
    persistedCustomerId: 3,
    persistedSiteId: 12,
    persistedSiteName: 'אתר ראשי',
    activeSiteIds: [] as number[],
  };

  it('returns no historical option when the current site is still active', () => {
    expect(
      resolveProjectHistoricalSiteOption({ ...base, activeSiteIds: [12] }),
    ).toBeNull();
  });

  it('surfaces a disabled historical option for a persisted missing site', () => {
    expect(resolveProjectHistoricalSiteOption(base)).toEqual({
      siteId: 12,
      label: 'אתר ראשי — לא פעיל',
    });
  });

  it('hides the historical option when the customer changed', () => {
    expect(
      resolveProjectHistoricalSiteOption({ ...base, formCustomerId: 9, formSiteId: 0 }),
    ).toBeNull();
  });

  it('hides the historical option when the site changed', () => {
    expect(
      resolveProjectHistoricalSiteOption({ ...base, formSiteId: 50 }),
    ).toBeNull();
  });

  it('never shows a historical option in create mode', () => {
    expect(
      resolveProjectHistoricalSiteOption({ ...base, isCreateMode: true }),
    ).toBeNull();
  });
});
