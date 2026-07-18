/**
 * Source of truth for which Customer record a Service Call may open in-page.
 * Review uses the persisted service-call customer; edit uses the unsaved form selection.
 */
export function resolveServiceCallCustomerAccessId(input: {
  isEditing: boolean;
  formCustomerId: number | string;
  persistedCustomerId?: number | null;
}): number {
  if (input.isEditing) {
    const formCustomerId = Number(input.formCustomerId) || 0;
    return formCustomerId > 0 ? formCustomerId : 0;
  }

  const persistedCustomerId = input.persistedCustomerId ?? 0;
  return persistedCustomerId > 0 ? persistedCustomerId : 0;
}
