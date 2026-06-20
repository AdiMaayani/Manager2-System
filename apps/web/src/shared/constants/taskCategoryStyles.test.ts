import { describe, expect, it } from 'vitest';
import { TASK_CATEGORIES } from './taskCategories';
import {
  resolveTaskCategoryStyleKey,
  taskCategoryModifierClass,
} from './taskCategoryStyles';

describe('taskCategoryStyles', () => {
  it('maps canonical API categories to stable CSS modifiers', () => {
    expect(resolveTaskCategoryStyleKey(TASK_CATEGORIES.Regular)).toBe('regular');
    expect(resolveTaskCategoryStyleKey(TASK_CATEGORIES.Project)).toBe('project');
    expect(resolveTaskCategoryStyleKey(TASK_CATEGORIES.ServiceCall)).toBe('serviceCall');
  });

  it('builds modifier classes for WorkPlan surfaces', () => {
    expect(taskCategoryModifierClass('workPlanDailyGrid__task', TASK_CATEGORIES.Regular)).toBe(
      'workPlanDailyGrid__task workPlanDailyGrid__task--regular',
    );
    expect(taskCategoryModifierClass('workPlanDailyGrid__task', TASK_CATEGORIES.ServiceCall)).toBe(
      'workPlanDailyGrid__task workPlanDailyGrid__task--serviceCall',
    );
  });

  it('falls back to project styling for unknown categories', () => {
    expect(resolveTaskCategoryStyleKey('unknown')).toBe('project');
    expect(resolveTaskCategoryStyleKey(null)).toBe('project');
  });
});
