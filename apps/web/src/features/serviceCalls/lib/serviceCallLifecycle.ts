/** Canonical Service Call lifecycle statuses used by cancel / reopen UX. */
export const SERVICE_CALL_PLANNED_STATUS = 'Planned';
export const SERVICE_CALL_OPEN_STATUS = 'Open';
export const SERVICE_CALL_IN_PROGRESS_STATUS = 'InProgress';
export const SERVICE_CALL_DONE_STATUS = 'Done';
export const SERVICE_CALL_CANCELLED_STATUS = 'Cancelled';

const CANCELLABLE_STATUSES = new Set([
  SERVICE_CALL_PLANNED_STATUS.toLowerCase(),
  SERVICE_CALL_OPEN_STATUS.toLowerCase(),
  SERVICE_CALL_IN_PROGRESS_STATUS.toLowerCase(),
]);

export function isServiceCallCancelled(status?: string | null): boolean {
  return (status ?? '').trim().toLowerCase() === SERVICE_CALL_CANCELLED_STATUS.toLowerCase();
}

export function isServiceCallOpen(status?: string | null): boolean {
  return (status ?? '').trim().toLowerCase() === SERVICE_CALL_OPEN_STATUS.toLowerCase();
}

export function canCancelServiceCall(status?: string | null, closedAt?: string | null): boolean {
  const normalized = (status ?? '').trim().toLowerCase();
  return CANCELLABLE_STATUSES.has(normalized) && !closedAt;
}

export function canReopenServiceCall(status?: string | null, closedAt?: string | null): boolean {
  return (
    isServiceCallCancelled(status) ||
    (isServiceCallOpen(status) && Boolean(closedAt))
  );
}

/** Edit-mode status options — Cancelled is only reachable via ביטול קריאה. */
export const SERVICE_CALL_EDIT_STATUS_OPTIONS = [
  { value: 'Planned', label: 'מתוכננת' },
  { value: 'Open', label: 'פתוחה' },
  { value: 'InProgress', label: 'בטיפול' },
  { value: 'Done', label: 'בוצעה' },
] as const;
