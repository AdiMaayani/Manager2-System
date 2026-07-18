/**
 * Source of truth for which Customer record Project may open in-page.
 * Review uses the persisted project customer; edit uses the unsaved form selection.
 */
export function resolveProjectCustomerAccessId(input: {
  isEditMode: boolean;
  formCustomerId: number;
  persistedCustomerId?: number | null;
}): number {
  if (input.isEditMode) {
    return input.formCustomerId > 0 ? input.formCustomerId : 0;
  }

  const persistedCustomerId = input.persistedCustomerId ?? 0;
  return persistedCustomerId > 0 ? persistedCustomerId : 0;
}
