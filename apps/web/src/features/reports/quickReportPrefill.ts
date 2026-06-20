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
