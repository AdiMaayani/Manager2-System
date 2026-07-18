/**
 * Nested CustomerDrawer intent used from Project / Service Call drawers.
 * One drawer instance serves create, general record view, and site management.
 */
export type NestedCustomerDrawerIntent = 'closed' | 'create' | 'view' | 'manageSites';

export function isNestedCustomerDrawerOpen(intent: NestedCustomerDrawerIntent): boolean {
  return intent !== 'closed';
}

/** Intents that require a full canonical Customer payload (GET /Customers/{id}). */
export function isCanonicalCustomerLoadIntent(intent: NestedCustomerDrawerIntent): boolean {
  return intent === 'view' || intent === 'manageSites';
}

/**
 * Only newly created customers may update the parent selection via onCustomerCreated.
 * Viewing or managing sites of an existing customer must leave parent customerId/siteId alone.
 */
export function shouldInvokeCustomerCreatedOnSave(
  intent: NestedCustomerDrawerIntent,
): boolean {
  return intent === 'create';
}

/** Changing the parent Customer selection always dismisses any nested CustomerDrawer. */
export function resolveCustomerDrawerIntentAfterCustomerChange(): NestedCustomerDrawerIntent {
  return 'closed';
}

/**
 * Resolves the customerId used for the shared detail query.
 * Returns 0 while closed/create so the query stays disabled.
 */
export function resolveCanonicalCustomerQueryId(input: {
  intent: NestedCustomerDrawerIntent;
  accessCustomerId: number;
}): number {
  if (!isCanonicalCustomerLoadIntent(input.intent)) return 0;
  return input.accessCustomerId > 0 ? input.accessCustomerId : 0;
}

/**
 * Gate for getCustomerByIdAsync — never fetch while closed, for create, without an id,
 * or when the user lacks viewCustomers.
 */
export function shouldFetchCanonicalCustomerDetail(input: {
  intent: NestedCustomerDrawerIntent;
  customerId: number;
  canViewCustomers: boolean;
}): boolean {
  return (
    isCanonicalCustomerLoadIntent(input.intent) &&
    input.customerId > 0 &&
    input.canViewCustomers
  );
}
