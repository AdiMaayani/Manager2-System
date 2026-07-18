import type { CreateCustomerRequest, Customer } from '../types';

/** Editable Customer detail fields only — activation is never part of the form model. */
export interface CustomerEditableFields {
  customerName: string;
  customerType: string;
  primaryPhone: string;
  primaryEmail: string;
  city: string;
  region: string;
  address: string;
  notes: string;
}

function mapDescriptiveFields(form: CustomerEditableFields): Omit<
  CreateCustomerRequest,
  'isActive' | 'status'
> {
  return {
    customerName: form.customerName.trim(),
    customerType: form.customerType,
    primaryPhone: form.primaryPhone.trim() || undefined,
    primaryEmail: form.primaryEmail.trim() || undefined,
    city: form.city.trim() || undefined,
    region: form.region.trim() || undefined,
    address: form.address.trim() || undefined,
    notes: form.notes.trim() || undefined,
  };
}

/** Prefer a meaningful persisted Status; otherwise derive from IsActive only. */
export function resolvePersistedLifecycleStatus(customer: Customer): string {
  const trimmedStatus = customer.status?.trim();
  if (trimmedStatus) return trimmedStatus;
  return customer.isActive ? 'פעיל' : 'לא פעיל';
}

/** New Customers are always created active. */
export function buildCreateCustomerRequest(
  form: CustomerEditableFields,
): CreateCustomerRequest {
  return {
    ...mapDescriptiveFields(form),
    status: 'פעיל',
    isActive: true,
  };
}

/**
 * Ordinary detail updates must preserve the persisted lifecycle state.
 * Form fields must never drive isActive / activation status.
 */
export function buildOrdinaryUpdateCustomerRequest(
  form: CustomerEditableFields,
  customer: Customer,
): CreateCustomerRequest {
  return {
    ...mapDescriptiveFields(form),
    isActive: customer.isActive,
    status: resolvePersistedLifecycleStatus(customer),
  };
}

/** Explicit restore: reactivate and set the established active status. */
export function buildRestoreCustomerRequest(customer: Customer): CreateCustomerRequest {
  return {
    customerName: customer.customerName,
    customerType: customer.customerType,
    primaryPhone: customer.primaryPhone || undefined,
    primaryEmail: customer.primaryEmail || undefined,
    city: customer.city || undefined,
    region: customer.region || undefined,
    address: customer.address || undefined,
    notes: customer.notes || undefined,
    status: 'פעיל',
    isActive: true,
  };
}
