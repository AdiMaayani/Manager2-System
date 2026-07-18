import type { ProjectOverviewForm, Site } from '../types';

// Sites are owned by the customer; a project may only choose one of the selected customer's sites.
export function filterProjectSitesByCustomer(sites: Site[], customerId: number): Site[] {
  if (!customerId || customerId <= 0) return [];
  return sites.filter((site) => site.customerId === customerId);
}

// Changing the customer always invalidates the previously chosen site, so the site selection is
// cleared and must be re-picked from the new customer's site list.
export function applyProjectCustomerChange(
  form: ProjectOverviewForm,
  customerId: number,
): ProjectOverviewForm {
  return { ...form, customerId, siteId: 0 };
}

export interface HistoricalSiteOption {
  siteId: number;
  label: string;
}

export interface ProjectHistoricalSiteInput {
  isCreateMode: boolean;
  formCustomerId: number;
  formSiteId: number;
  persistedCustomerId?: number;
  persistedSiteId?: number;
  persistedSiteName?: string | null;
  activeSiteIds: number[];
}

// A persisted project may reference a site that has since been deactivated and therefore no longer
// appears in the active-site lookup. We surface it as a disabled, explicitly-labelled option so the
// historical record stays readable — but only while the original customer/site relationship is
// intact. It is never offered for new records, other customers, or after the user re-selects.
export function resolveProjectHistoricalSiteOption(
  input: ProjectHistoricalSiteInput,
): HistoricalSiteOption | null {
  const {
    isCreateMode,
    formCustomerId,
    formSiteId,
    persistedCustomerId,
    persistedSiteId,
    persistedSiteName,
    activeSiteIds,
  } = input;

  if (isCreateMode) return null;
  if (!persistedSiteId || persistedSiteId <= 0) return null;
  if (!persistedCustomerId || formCustomerId !== persistedCustomerId) return null;
  if (formSiteId !== persistedSiteId) return null;
  if (activeSiteIds.includes(persistedSiteId)) return null;

  const name = persistedSiteName?.trim() || `אתר #${persistedSiteId}`;
  return { siteId: persistedSiteId, label: `${name} — לא פעיל` };
}
