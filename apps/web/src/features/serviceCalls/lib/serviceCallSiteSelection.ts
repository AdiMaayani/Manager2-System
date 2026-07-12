export function filterServiceCallSitesByCustomer<
  TSite extends { customerId: number },
>(sites: TSite[], customerId: number | null): TSite[] {
  if (customerId == null || customerId <= 0) return [];
  return sites.filter((site) => site.customerId === customerId);
}

export function getCreatedServiceCallSiteSelection(
  selectedCustomerId: number,
  createdSite: { siteId: number; customerId: number },
): string {
  if (createdSite.customerId !== selectedCustomerId) {
    throw new Error('האתר החדש אינו שייך ללקוח שנבחר.');
  }
  return String(createdSite.siteId);
}
