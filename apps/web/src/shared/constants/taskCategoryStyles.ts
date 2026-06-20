import { TASK_CATEGORIES } from './taskCategories';

export type TaskCategoryStyleKey = 'regular' | 'project' | 'serviceCall';

const CATEGORY_TO_STYLE: Record<string, TaskCategoryStyleKey> = {
  [TASK_CATEGORIES.Regular]: 'regular',
  [TASK_CATEGORIES.Project]: 'project',
  [TASK_CATEGORIES.ServiceCall]: 'serviceCall',
};

/** Maps API task category to a stable CSS modifier used across WorkPlan views. */
export function resolveTaskCategoryStyleKey(category?: string | null): TaskCategoryStyleKey {
  if (!category) return 'project';
  return CATEGORY_TO_STYLE[category] ?? 'project';
}

export function taskCategoryModifierClass(baseClass: string, category?: string | null): string {
  return `${baseClass} ${baseClass}--${resolveTaskCategoryStyleKey(category)}`;
}

export const TASK_CATEGORY_LEGEND_ITEMS: Array<{ modifier: TaskCategoryStyleKey; label: string }> = [
  { modifier: 'regular', label: 'משימה כללית' },
  { modifier: 'project', label: 'משימת פרויקט' },
  { modifier: 'serviceCall', label: 'קריאת שירות' },
];
