/** Report business workflow Status — independent of LifecycleStatus. */
export const REPORT_WORKFLOW_STATUSES = {
  Draft: 'טיוטה',
  Submitted: 'הוגש',
  TransferredToAccounting: 'הועבר להנה״ח',
} as const;

export type ReportWorkflowStatus =
  (typeof REPORT_WORKFLOW_STATUSES)[keyof typeof REPORT_WORKFLOW_STATUSES];

export const REPORT_TYPES = {
  Regular: 'regular',
  Project: 'project',
  ServiceCall: 'service_call',
} as const;

export type ReportTypeValue = (typeof REPORT_TYPES)[keyof typeof REPORT_TYPES];

export function isReportWorkflowStatus(
  value: string | null | undefined,
): value is ReportWorkflowStatus {
  return (
    value === REPORT_WORKFLOW_STATUSES.Draft ||
    value === REPORT_WORKFLOW_STATUSES.Submitted ||
    value === REPORT_WORKFLOW_STATUSES.TransferredToAccounting
  );
}

export function isReportType(value: string | null | undefined): value is ReportTypeValue {
  return (
    value === REPORT_TYPES.Regular ||
    value === REPORT_TYPES.Project ||
    value === REPORT_TYPES.ServiceCall
  );
}

export function isDraftWorkflowStatus(status: string | null | undefined): boolean {
  return status === REPORT_WORKFLOW_STATUSES.Draft;
}

export function isSubmittedWorkflowStatus(status: string | null | undefined): boolean {
  return (
    status === REPORT_WORKFLOW_STATUSES.Submitted ||
    status === REPORT_WORKFLOW_STATUSES.TransferredToAccounting
  );
}
