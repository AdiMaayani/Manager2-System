import type { WorkPlanRange, WorkPlanScope } from './types';

export const WORKPLAN_QUERY = {
  PROJECT_ID: 'projectId',
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
