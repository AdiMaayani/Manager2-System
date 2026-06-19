/** Canonical TaskCategory values — server derives WorkType from these. */
export const TASK_CATEGORIES = {
  Regular: 'Regular',
  Project: 'Project',
  ServiceCall: 'ServiceCall',
} as const;

export type TaskCategory = (typeof TASK_CATEGORIES)[keyof typeof TASK_CATEGORIES];

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  Regular: 'משימה רגילה',
  Project: 'משימת פרויקט',
  ServiceCall: 'קריאת שירות',
};

export const TASK_CATEGORY_FILTER_OPTIONS = [
  { id: 'all', label: 'כל הסוגים' },
  { id: TASK_CATEGORIES.Regular, label: TASK_CATEGORY_LABELS.Regular },
  { id: TASK_CATEGORIES.Project, label: TASK_CATEGORY_LABELS.Project },
  { id: TASK_CATEGORIES.ServiceCall, label: TASK_CATEGORY_LABELS.ServiceCall },
] as const;

export function isTaskCategory(value: string | null | undefined): value is TaskCategory {
  return (
    value === TASK_CATEGORIES.Regular ||
    value === TASK_CATEGORIES.Project ||
    value === TASK_CATEGORIES.ServiceCall
  );
}

export function getTaskCategoryLabel(category?: string | null): string {
  if (category && isTaskCategory(category)) {
    return TASK_CATEGORY_LABELS[category];
  }
  return category?.trim() || '—';
}
