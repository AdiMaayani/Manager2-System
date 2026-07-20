import type { UpsertServiceCallRequest } from '../types';
import { datetimeLocalToUtcIsoOptional } from './serviceCallDateTime';
import type { ServiceCallFormState } from './serviceCallFormState';
import { legacyRequiredRole } from '@features/workplan/lib/requiredProfessions';

function nullableString(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue || null;
}

function nullableNumber(value: string): number | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;
  const parsedValue = Number(trimmedValue);
  return Number.isFinite(parsedValue) && parsedValue >= 0
    ? Number(parsedValue.toFixed(2))
    : null;
}

/** Builds the upsert payload; datetime-local fields become UTC Z (or null when empty). */
export function buildServiceCallUpsertRequest(
  form: ServiceCallFormState,
): UpsertServiceCallRequest {
  return {
    title: form.title.trim(),
    description: nullableString(form.description),
    status: form.status,
    billingType: form.billingType,
    customerId: Number(form.customerId),
    siteId: Number(form.siteId),
    priority: nullableString(form.priority),
    plannedStart: datetimeLocalToUtcIsoOptional(form.plannedStart),
    plannedEnd: datetimeLocalToUtcIsoOptional(form.plannedEnd),
    estimatedHours: nullableNumber(form.estimatedHours),
    actualStart: datetimeLocalToUtcIsoOptional(form.actualStart),
    actualEnd: datetimeLocalToUtcIsoOptional(form.actualEnd),
    actualHours: nullableNumber(form.actualHours),
    requiredRole: legacyRequiredRole(form.requiredRoles),
    requiredRoles: form.requiredRoles,
    isLocked: form.isLocked,
  };
}
