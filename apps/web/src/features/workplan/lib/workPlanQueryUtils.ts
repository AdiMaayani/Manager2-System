import type { WorkPlanProjectFilter, WorkPlanScope, WorkPlanTaskCategoryFilter } from '../types';

export function parsePositiveInt(value: string | null | undefined): number | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function resolveCurrentUserEmployeeId(
  employeeId: number | null | undefined,
): number | null {
  if (employeeId == null || employeeId <= 0) return null;
  return employeeId;
}

export function buildWorkPlanEmployeeFilterOptions(
  employees: Array<{ employeeId: number; fullName: string; primaryRole?: string | null }>,
  selectedEmployeeId: string,
): Array<{ employeeId: number; fullName: string; primaryRole?: string | null }> {
  const parsedSelectedId = parsePositiveInt(selectedEmployeeId);
  if (parsedSelectedId == null) return employees;
  if (employees.some((employee) => employee.employeeId === parsedSelectedId)) return employees;
  return [
    ...employees,
    { employeeId: parsedSelectedId, fullName: `עובד #${parsedSelectedId}` },
  ];
}

export function buildWorkPlanProjectFilterOptions(
  projects: Array<{ id: number; title: string; projectNumber?: string; customerName?: string }>,
  selectedProjectId: number | null,
): Array<{ id: number; title: string; projectNumber?: string; customerName?: string }> {
  if (selectedProjectId == null) return projects;
  if (projects.some((project) => project.id === selectedProjectId)) return projects;
  return [{ id: selectedProjectId, title: `פרויקט #${selectedProjectId}` }, ...projects];
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
