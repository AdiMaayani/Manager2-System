/** Report LifecycleStatus — stock/editability state machine (independent of Hebrew WorkflowStatus). */
export const REPORT_LIFECYCLE_STATUSES = {
  Draft: 'Draft',
  Finalized: 'Finalized',
  Reversed: 'Reversed',
} as const;

export type ReportLifecycleStatus =
  (typeof REPORT_LIFECYCLE_STATUSES)[keyof typeof REPORT_LIFECYCLE_STATUSES];

export const REPORT_LIFECYCLE_LABELS: Record<ReportLifecycleStatus, string> = {
  Draft: 'טיוטת מלאי',
  Finalized: 'מסופק',
  Reversed: 'הוחזר',
};

export function isReportLifecycleStatus(
  value: string | null | undefined,
): value is ReportLifecycleStatus {
  return (
    value === REPORT_LIFECYCLE_STATUSES.Draft ||
    value === REPORT_LIFECYCLE_STATUSES.Finalized ||
    value === REPORT_LIFECYCLE_STATUSES.Reversed
  );
}

export function canEditReportInventory(lifecycleStatus?: string | null): boolean {
  return lifecycleStatus === REPORT_LIFECYCLE_STATUSES.Draft;
}

export function canEditReportAttachments(lifecycleStatus?: string | null): boolean {
  return (
    lifecycleStatus === REPORT_LIFECYCLE_STATUSES.Draft ||
    lifecycleStatus === REPORT_LIFECYCLE_STATUSES.Finalized
  );
}

export function canEditReportText(lifecycleStatus?: string | null): boolean {
  return (
    lifecycleStatus === REPORT_LIFECYCLE_STATUSES.Draft ||
    lifecycleStatus === REPORT_LIFECYCLE_STATUSES.Finalized
  );
}

export function canFinalizeReport(lifecycleStatus?: string | null): boolean {
  return lifecycleStatus === REPORT_LIFECYCLE_STATUSES.Draft;
}

export function canReverseReport(lifecycleStatus?: string | null): boolean {
  return lifecycleStatus === REPORT_LIFECYCLE_STATUSES.Finalized;
}

export function canAmendReport(lifecycleStatus?: string | null): boolean {
  return lifecycleStatus === REPORT_LIFECYCLE_STATUSES.Reversed;
}
