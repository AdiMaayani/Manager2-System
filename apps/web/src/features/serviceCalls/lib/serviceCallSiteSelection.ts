export function filterServiceCallSitesByCustomer<
  TSite extends { customerId: number },
>(sites: TSite[], customerId: number | null): TSite[] {
  if (customerId == null || customerId <= 0) return [];
  return sites.filter((site) => site.customerId === customerId);
}

// A service call may only keep a site that belongs to its selected customer. When the customer
// changes (or is cleared) any previously chosen site becomes incompatible and is dropped so the
// user must re-pick from the new customer's active sites.
export function resolveCompatibleServiceCallSiteId<
  TSite extends { siteId: number; customerId: number },
>(currentSiteId: number | null, sites: TSite[], customerId: number | null): string {
  if (customerId == null || customerId <= 0 || !currentSiteId || currentSiteId <= 0) {
    return '';
  }
  const match = sites.find(
    (site) => site.siteId === currentSiteId && site.customerId === customerId,
  );
  return match ? String(currentSiteId) : '';
}

export interface ServiceCallHistoricalSiteOption {
  siteId: number;
  label: string;
}

export interface ServiceCallHistoricalSiteInput {
  isExistingServiceCall: boolean;
  formCustomerId: number;
  formSiteId: number;
  persistedCustomerId?: number;
  persistedSiteId?: number;
  persistedSiteName?: string | null;
  activeSiteIds: number[];
}

// An existing service call may reference a site that has since been deactivated and dropped from
// the active-site lookup. Surface it as a disabled, labelled option so the historical record stays
// readable — but only while the original customer/site relationship is intact, never in create mode
// or for another customer, and it disappears once the user re-selects.
export function resolveServiceCallHistoricalSiteOption(
  input: ServiceCallHistoricalSiteInput,
): ServiceCallHistoricalSiteOption | null {
  const {
    isExistingServiceCall,
    formCustomerId,
    formSiteId,
    persistedCustomerId,
    persistedSiteId,
    persistedSiteName,
    activeSiteIds,
  } = input;

  if (!isExistingServiceCall) return null;
  if (!persistedSiteId || persistedSiteId <= 0) return null;
  if (!persistedCustomerId || formCustomerId !== persistedCustomerId) return null;
  if (formSiteId !== persistedSiteId) return null;
  if (activeSiteIds.includes(persistedSiteId)) return null;

  const name = persistedSiteName?.trim() || `אתר #${persistedSiteId}`;
  return { siteId: persistedSiteId, label: `${name} — לא פעיל` };
}
