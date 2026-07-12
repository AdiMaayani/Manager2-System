export function getCreatedProjectSiteSelection(
  selectedCustomerId: number,
  createdSite: { siteId: number; customerId: number },
): number {
  if (createdSite.customerId !== selectedCustomerId) {
    throw new Error('האתר החדש אינו שייך ללקוח שנבחר.');
  }
  return createdSite.siteId;
}
