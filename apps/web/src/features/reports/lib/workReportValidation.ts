import {
  isDraftWorkflowStatus,
  isReportType,
  isReportWorkflowStatus,
  isSubmittedWorkflowStatus,
  REPORT_TYPES,
} from '@shared/constants/reportWorkflow';

export interface WorkReportValidationInput {
  reportType?: string | null;
  date?: string | null;
  status?: string | null;
  workItemId?: number | null;
  projectId?: number | null;
  serviceCallId?: number | null;
  reporterId?: number | null;
  start?: string | null;
  end?: string | null;
  summary?: string | null;
}

function hasLinkedWorkItem(input: WorkReportValidationInput): boolean {
  return (
    (input.workItemId != null && input.workItemId > 0) ||
    (input.projectId != null && input.projectId > 0) ||
    (input.serviceCallId != null && input.serviceCallId > 0)
  );
}

function isValidReportDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    const parsed = Date.parse(date);
    return !Number.isNaN(parsed);
  }

  const [yearText, monthText, dayText] = date.trim().split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function parseReportTime(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] != null ? Number(match[3]) : 0;
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    Number.isNaN(seconds) ||
    hours > 23 ||
    minutes > 59 ||
    seconds > 59
  ) {
    return null;
  }
  return hours * 3600 + minutes * 60 + seconds;
}

function hasValidTimeRange(start?: string | null, end?: string | null): boolean {
  if (!start || !end) return false;
  const startSeconds = parseReportTime(start);
  const endSeconds = parseReportTime(end);
  if (startSeconds == null || endSeconds == null) return false;
  return endSeconds > startSeconds;
}

/**
 * Frontend parity with CreateWorkReportRequestValidator.
 * Draft may be incomplete; submitted requires the full business contract.
 */
export function validateWorkReportRequest(input: WorkReportValidationInput): string | null {
  if (!input.date?.trim()) return 'יש להזין תאריך דיווח';
  if (!isValidReportDate(input.date)) return 'תאריך הדיווח אינו תקין';
  if (!isReportType(input.reportType)) return 'סוג הדיווח אינו תקין';
  if (!isReportWorkflowStatus(input.status)) return 'סטטוס הדיווח אינו תקין';

  if (
    input.reportType === REPORT_TYPES.Regular &&
    input.projectId != null &&
    input.projectId > 0
  ) {
    return 'דיווח על משימה כללית אינו יכול לכלול הקשר פרויקט';
  }

  if (
    isDraftWorkflowStatus(input.status) &&
    input.start &&
    input.end &&
    !hasValidTimeRange(input.start, input.end)
  ) {
    return 'שעת הסיום חייבת להיות אחרי שעת ההתחלה';
  }

  if (!isSubmittedWorkflowStatus(input.status)) {
    return null;
  }

  if (!hasLinkedWorkItem(input)) return 'יש לבחור משימה או קריאת שירות';
  if (input.reporterId == null || input.reporterId <= 0) return 'יש לבחור מדווח';
  if (!input.start || !input.end) return 'יש להזין שעות עבודה';
  if (!hasValidTimeRange(input.start, input.end)) {
    return 'שעת הסיום חייבת להיות אחרי שעת ההתחלה';
  }
  if (!input.summary?.trim()) return 'יש להזין סיכום עבודה';

  return null;
}
