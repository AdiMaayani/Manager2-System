import type { QuoteProjectOption } from '../types';

/** Quote project pickers only offer projects owned by the selected customer. */
export function filterQuoteProjectsByCustomerId(
  projects: QuoteProjectOption[],
  customerId: number,
): QuoteProjectOption[] {
  if (!customerId || customerId <= 0) {
    return [];
  }

  return projects.filter((project) => project.customerId === customerId);
}

export interface QuoteCustomerProjectFields {
  customerId: string;
  projectId: string;
}

/**
 * Changing the customer clears ProjectId only when the selected project no longer
 * belongs to the new customer. Compatible selections stay stable.
 */
export function applyQuoteCustomerChange<T extends QuoteCustomerProjectFields>(
  form: T,
  customerId: string,
  projects: QuoteProjectOption[],
): T {
  const nextCustomerId = Number(customerId);
  const selectedProjectId = form.projectId ? Number(form.projectId) : 0;

  if (!selectedProjectId) {
    return { ...form, customerId, projectId: '' };
  }

  const selectedProject = projects.find((project) => project.workItemId === selectedProjectId);
  const projectBelongsToCustomer =
    selectedProject != null &&
    selectedProject.customerId != null &&
    selectedProject.customerId === nextCustomerId;

  return {
    ...form,
    customerId,
    projectId: projectBelongsToCustomer ? form.projectId : '',
  };
}
