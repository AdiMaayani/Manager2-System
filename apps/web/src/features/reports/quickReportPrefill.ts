import { localDateKeyFromUtc, localTimeFromUtc } from '@shared/utils/utcDateTime';
import type { WorkItemReportTarget } from './types';
import { resolveQuickReportWorkers } from './quickReportWorkers';

export const QUICK_REPORT_STORAGE_KEY = 'manager2_quick_report_prefill';

export interface QuickReportPrefill {
  workItemId: number;
  taskCategory: string;
  title?: string;
  date?: string;
  start?: string;
  end?: string;
  reporterId?: number | null;
  reporterName?: string;
  reporterRole?: string;
  relatedWorkerIds?: number[];
  customerName?: string;
  site?: string;
  projectId?: number | null;
  projectTitle?: string;
}

export type ReportTargetTypeValue = 'regular' | 'project' | 'service_call';

export function taskCategoryToReportTargetType(taskCategory: string): ReportTargetTypeValue {
  if (taskCategory === 'ServiceCall') return 'service_call';
  if (taskCategory === 'Project') return 'project';
  return 'regular';
}

export function readQuickReportPrefill(raw: string | null): QuickReportPrefill | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<QuickReportPrefill>;
    const workItemId = Number(parsed.workItemId);
    if (!Number.isInteger(workItemId) || workItemId <= 0) return null;
    if (!parsed.taskCategory) return null;
    return {
      workItemId,
      taskCategory: parsed.taskCategory,
      title: parsed.title,
      date: parsed.date,
      start: parsed.start,
      end: parsed.end,
      reporterId: parsed.reporterId ?? null,
      reporterName: parsed.reporterName,
      reporterRole: parsed.reporterRole,
      relatedWorkerIds: Array.from(
        new Set(
          (parsed.relatedWorkerIds ?? [])
            .map(Number)
            .filter((employeeId) => Number.isInteger(employeeId) && employeeId > 0),
        ),
      ),
      customerName: parsed.customerName,
      site: parsed.site,
      projectId: parsed.projectId ?? null,
      projectTitle: parsed.projectTitle,
    };
  } catch {
    return null;
  }
}

export function writeQuickReportPrefill(prefill: QuickReportPrefill): void {
  sessionStorage.setItem(QUICK_REPORT_STORAGE_KEY, JSON.stringify(prefill));
}

export function enrichQuickReportPrefill(
  prefill: QuickReportPrefill,
  target: WorkItemReportTarget,
): QuickReportPrefill {
  const targetAssignments = target.assignments;
  const hasAssignmentContract = targetAssignments !== undefined;
  const targetWorkers = targetAssignments
    ? resolveQuickReportWorkers(targetAssignments, prefill.reporterId)
    : null;

  return {
    ...prefill,
    taskCategory: target.taskCategory,
    title: prefill.title || target.title,
    date:
      prefill.date ||
      (target.plannedStart ? localDateKeyFromUtc(target.plannedStart) : undefined),
    start:
      prefill.start ||
      (target.plannedStart ? localTimeFromUtc(target.plannedStart) : undefined),
    end:
      prefill.end ||
      (target.plannedEnd ? localTimeFromUtc(target.plannedEnd) : undefined),
    reporterId: hasAssignmentContract
      ? targetWorkers?.reporterId ?? null
      : prefill.reporterId ?? null,
    reporterName:
      (hasAssignmentContract ? targetWorkers?.reporterName : prefill.reporterName) ||
      target.assigneeName ||
      undefined,
    reporterRole:
      targetWorkers?.reporterRole || prefill.reporterRole || target.requiredRole || undefined,
    relatedWorkerIds: hasAssignmentContract
      ? targetWorkers?.relatedWorkerIds ?? []
      : prefill.relatedWorkerIds ?? [],
    customerName: prefill.customerName || target.customerName || undefined,
    site: prefill.site || target.siteName || undefined,
    projectId: target.projectId ?? prefill.projectId ?? null,
    projectTitle: prefill.projectTitle || target.projectTitle || undefined,
  };
}
