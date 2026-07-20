import type { ServiceCallDetails } from '../types';
import { apiDateTimeToDateTimeLocal } from './serviceCallDateTime';
import { normalizeRequiredProfessions } from '@features/workplan/lib/requiredProfessions';

export interface ServiceCallFormState {
  title: string;
  description: string;
  status: string;
  billingType: string;
  customerId: string;
  siteId: string;
  priority: string;
  plannedStart: string;
  plannedEnd: string;
  estimatedHours: string;
  actualStart: string;
  actualEnd: string;
  actualHours: string;
  requiredRoles: string[];
  isLocked: boolean;
}

// Build the editable form state from a service call, or the create-mode defaults when none is
// supplied. This is the single source for both the initial mount value and the draft created when
// the user enters edit mode / cancels, so review display (derived from the record) and the edit
// draft never drift.
export function buildServiceCallFormState(
  serviceCall: ServiceCallDetails | null | undefined,
): ServiceCallFormState {
  return {
    title: serviceCall?.title ?? '',
    description: serviceCall?.description ?? '',
    status: serviceCall?.status ?? 'Open',
    billingType: serviceCall?.billingType ?? 'Hourly',
    customerId: serviceCall?.customerId ? String(serviceCall.customerId) : '',
    siteId: serviceCall?.siteId ? String(serviceCall.siteId) : '',
    priority: serviceCall?.priority ?? '',
    plannedStart: apiDateTimeToDateTimeLocal(serviceCall?.plannedStart),
    plannedEnd: apiDateTimeToDateTimeLocal(serviceCall?.plannedEnd),
    estimatedHours: serviceCall?.estimatedHours != null ? String(serviceCall.estimatedHours) : '',
    actualStart: apiDateTimeToDateTimeLocal(serviceCall?.actualStart),
    actualEnd: apiDateTimeToDateTimeLocal(serviceCall?.actualEnd),
    actualHours: serviceCall?.actualHours != null ? String(serviceCall.actualHours) : '',
    requiredRoles: normalizeRequiredProfessions(
      serviceCall?.requiredRoles?.length
        ? serviceCall.requiredRoles
        : serviceCall?.requiredRole
          ? [serviceCall.requiredRole]
          : [],
    ),
    isLocked: serviceCall?.isLocked ?? false,
  };
}
