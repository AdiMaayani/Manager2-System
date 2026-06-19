import type { WorkPlanProjectFilter, WorkPlanScope, WorkPlanTaskCategoryFilter } from '../types';

export function parsePositiveInt(value: string | null | undefined): number | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function resolveScheduleProjectId(
  scope: WorkPlanScope,
  projectFilter: WorkPlanProjectFilter,
): number | null {
  if (scope !== 'project') return null;
  if (typeof projectFilter === 'number' && projectFilter > 0) return projectFilter;
  return null;
}

export function resolveScheduleEmployeeId(
  scope: WorkPlanScope,
  employeeFilterId: string,
): number | null {
  if (scope !== 'employee') return null;
  return parsePositiveInt(employeeFilterId);
}

export function normalizeTaskCategoryFilter(
  taskCategoryFilter: WorkPlanTaskCategoryFilter,
): string | null {
  return taskCategoryFilter === 'all' ? null : taskCategoryFilter;
}

export function normalizeStatusFilter(statusFilter: string): string | null {
  return statusFilter === 'all' ? null : statusFilter;
}

export function isWorkPlanScheduleQueryReady(options: {
  enabled?: boolean;
  scope: WorkPlanScope;
  projectId: number | null;
  employeeId: number | null;
  currentUserEmployeeId: number | null;
}): boolean {
  if (options.enabled === false) return false;
  if (options.scope === 'project' && options.projectId == null) return false;
  if (options.scope === 'employee' && options.employeeId == null) return false;
  if (options.scope === 'personal' && options.currentUserEmployeeId == null) return false;
  return true;
}
