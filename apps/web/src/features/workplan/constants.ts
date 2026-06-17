import type { WorkPlanPriorityCode, WorkPlanRange, WorkPlanScope, WorkPlanStatusCode } from './types';

export const WORKPLAN_QUERY = {
  PROJECT_ID: 'projectId',
  SEARCH: 'q',
  DATE: 'date',
  WORK_ITEM_ID: 'workItemId',
} as const;

export const WORKPLAN_SCOPES: Record<string, WorkPlanScope> = {
  COMPANY: 'company',
  PERSONAL: 'personal',
  EMPLOYEE: 'employee',
  PROJECT: 'project',
} as const;

export const WORKPLAN_RANGES: Record<string, WorkPlanRange> = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const;

export const WORKPLAN_DEFAULTS = {
  SCOPE: 'company' as WorkPlanScope,
  RANGE: 'daily' as WorkPlanRange,
  PROJECT_FILTER: 'all' as const,
};

export const HOUR_LABELS = Array.from({ length: 24 }, (_, hour) => `${hour}:00`);

export const WEEKDAY_LABELS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export const WORKPLAN_STATUS_OPTIONS: Array<{ code: WorkPlanStatusCode; display: string }> = [
  { code: 'Planned', display: 'מתוכנן' },
  { code: 'Execution', display: 'בביצוע' },
  { code: 'Done', display: 'הושלם' },
  { code: 'Closed', display: 'סגור' },
  { code: 'Blocked', display: 'תקוע' },
];

export const WORKPLAN_PRIORITY_OPTIONS: Array<{ code: WorkPlanPriorityCode; display: string }> = [
  { code: 'Low', display: 'נמוך' },
  { code: 'Medium', display: 'רגיל' },
  { code: 'High', display: 'גבוה' },
  { code: 'Urgent', display: 'דחוף' },
];

export const STATUS_FILTER_OPTIONS = [
  { id: 'all', label: 'הכל' },
  { id: 'planned', label: 'מתוכנן' },
  { id: 'in-progress', label: 'בביצוע' },
  { id: 'done', label: 'הושלם' },
] as const;

export const SCOPE_LABELS: Record<WorkPlanScope, string> = {
  company: 'כללי',
  personal: 'אישי',
  employee: 'לפי עובד',
  project: 'לפי פרויקט',
};

export const RANGE_LABELS: Record<WorkPlanRange, string> = {
  daily: 'יומי',
  weekly: 'שבועי',
  monthly: 'חודשי',
  yearly: 'שנתי',
};

const LEGACY_STATUS_ALIASES: Record<string, WorkPlanStatusCode> = {
  planned: 'Planned',
  open: 'Planned',
  'בתכנון': 'Planned',
  'תכנון': 'Planned',
  'מתוכנן': 'Planned',
  execution: 'Execution',
  'ביצוע': 'Execution',
  'בביצוע': 'Execution',
  done: 'Done',
  completed: 'Done',
  complete: 'Done',
  'הושלם': 'Done',
  'סיום': 'Closed',
  closed: 'Closed',
  close: 'Closed',
  'סגור': 'Closed',
  'נסגר': 'Closed',
  blocked: 'Blocked',
  stuck: 'Blocked',
  'תקוע': 'Blocked',
};

const PROJECT_STATUS_DISPLAYS: Record<string, string> = {
  Open: 'פתוח',
  Design: 'תוכניות',
  Wiring: 'השחלה',
  Cancelled: 'מבוטל',
};

const LEGACY_PRIORITY_ALIASES: Record<string, WorkPlanPriorityCode> = {
  low: 'Low',
  'נמוך': 'Low',
  'נמוכה': 'Low',
  normal: 'Medium',
  medium: 'Medium',
  regular: 'Medium',
  'רגיל': 'Medium',
  'בינונית': 'Medium',
  high: 'High',
  'גבוה': 'High',
  'גבוהה': 'High',
  urgent: 'Urgent',
  critical: 'Urgent',
  'דחוף': 'Urgent',
};

function normalizeLookupValue(value?: string | null): string {
  return String(value ?? '').trim().toLowerCase();
}

export function normalizeWorkPlanStatusCode(status?: string | null): WorkPlanStatusCode | null {
  const normalizedStatus = normalizeLookupValue(status);
  if (!normalizedStatus) return null;

  return LEGACY_STATUS_ALIASES[normalizedStatus] ?? null;
}

export function normalizeWorkPlanPriorityCode(priority?: string | null): WorkPlanPriorityCode | null {
  const normalizedPriority = normalizeLookupValue(priority);
  if (!normalizedPriority) return null;

  return LEGACY_PRIORITY_ALIASES[normalizedPriority] ?? null;
}

export function getWorkPlanStatusDisplay(status?: string | null): string {
  const canonicalStatus = normalizeWorkPlanStatusCode(status);
  if (canonicalStatus) {
    return WORKPLAN_STATUS_OPTIONS.find((option) => option.code === canonicalStatus)?.display ?? canonicalStatus;
  }

  const trimmedStatus = String(status ?? '').trim();
  return PROJECT_STATUS_DISPLAYS[trimmedStatus] ?? trimmedStatus;
}

export function getWorkPlanPriorityDisplay(priority?: string | null): string {
  const canonicalPriority = normalizeWorkPlanPriorityCode(priority);
  if (canonicalPriority) {
    return WORKPLAN_PRIORITY_OPTIONS.find((option) => option.code === canonicalPriority)?.display ?? canonicalPriority;
  }

  return String(priority ?? '').trim();
}

export function matchesWorkPlanStatusFilter(status: string | null | undefined, filter: string): boolean {
  if (filter === 'all') return true;

  const canonicalStatus = normalizeWorkPlanStatusCode(status);
  if (filter === 'planned') return canonicalStatus === 'Planned';
  if (filter === 'in-progress') return canonicalStatus === 'Execution';
  if (filter === 'done') return canonicalStatus === 'Done' || canonicalStatus === 'Closed';

  return true;
}

export function isWorkPlanStatusDone(status?: string | null): boolean {
  const canonicalStatus = normalizeWorkPlanStatusCode(status);
  return canonicalStatus === 'Done' || canonicalStatus === 'Closed';
}

export function isWorkPlanStatusInProgress(status?: string | null): boolean {
  return normalizeWorkPlanStatusCode(status) === 'Execution';
}

export function isWorkPlanPriorityUrgent(priority?: string | null): boolean {
  return normalizeWorkPlanPriorityCode(priority) === 'Urgent';
}
