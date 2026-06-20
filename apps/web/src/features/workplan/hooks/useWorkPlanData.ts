import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from '@api/auth';
import {
  getSmartAssignmentRecommendationsAsync,
  getWorkPlanScheduleAsync,
} from '../api/workplanApiClient';
import { buildInsightMap } from '../lib/workPlanInsights';
import {
  buildEmployeeDailyBars,
  buildGanttTasksFromSchedule,
  buildProjectDailyBars,
  buildUnscheduledTaskBars,
} from '../lib/workPlanScheduling';
import { periodToUtcBounds } from '../lib/workPlanPeriod';
import {
  isWorkPlanScheduleQueryReady,
  normalizeStatusFilter,
  normalizeTaskCategoryFilter,
  resolveScheduleEmployeeId,
  resolveScheduleProjectId,
} from '../lib/workPlanQueryUtils';
import type { WorkPlanProjectFilter, WorkPlanRange, WorkPlanScope, WorkPlanTaskCategoryFilter } from '../types';

export interface WorkPlanScheduleQueryOptions {
  scope: WorkPlanScope;
  projectFilter: WorkPlanProjectFilter;
  statusFilter: string;
  taskCategoryFilter: WorkPlanTaskCategoryFilter;
  employeeFilterId: string;
  searchQuery: string;
  periodAnchor: Date;
  range: WorkPlanRange;
  enabled?: boolean;
}

function buildScheduleFilters(options: WorkPlanScheduleQueryOptions) {
  const { fromUtc, toUtc } = periodToUtcBounds(options.periodAnchor, options.range);
  const currentUser = getCurrentUser();
  const rawEmployeeId = currentUser?.employeeId ?? null;
  const currentUserEmployeeId =
    rawEmployeeId != null && rawEmployeeId > 0 ? rawEmployeeId : null;

  return {
    scope: options.scope,
    projectId: resolveScheduleProjectId(options.scope, options.projectFilter),
    employeeId: resolveScheduleEmployeeId(options.scope, options.employeeFilterId),
    status: normalizeStatusFilter(options.statusFilter),
    taskCategory: normalizeTaskCategoryFilter(options.taskCategoryFilter),
    fromUtc,
    toUtc,
    includeUnscheduled: true,
    currentUserEmployeeId,
  };
}

export function useWorkPlanSchedule(options: WorkPlanScheduleQueryOptions) {
  const filters = useMemo(() => buildScheduleFilters(options), [options]);
  const queryReady = isWorkPlanScheduleQueryReady({
    enabled: options.enabled,
    scope: options.scope,
    projectId: filters.projectId,
    employeeId: filters.employeeId,
    currentUserEmployeeId: filters.currentUserEmployeeId,
  });

  return useQuery({
    queryKey: ['workplan', 'schedule', filters],
    queryFn: () => getWorkPlanScheduleAsync(filters),
    enabled: queryReady,
    retry: false,
  });
}

export function useWorkPlanScheduling(options: WorkPlanScheduleQueryOptions) {
  const filters = useMemo(() => buildScheduleFilters(options), [options]);
  const queryReady = isWorkPlanScheduleQueryReady({
    enabled: options.enabled,
    scope: options.scope,
    projectId: filters.projectId,
    employeeId: filters.employeeId,
    currentUserEmployeeId: filters.currentUserEmployeeId,
  });
  const scheduleQuery = useWorkPlanSchedule(options);

  const schedule = useMemo(
    () =>
      scheduleQuery.data ?? {
        scheduledTasks: [],
        unscheduledTasks: [],
        employees: [],
        assignments: [],
      },
    [scheduleQuery.data],
  );

  const currentUser = getCurrentUser();
  const rawCurrentUserEmployeeId = currentUser?.employeeId ?? null;
  const currentUserEmployeeId =
    rawCurrentUserEmployeeId != null && rawCurrentUserEmployeeId > 0
      ? rawCurrentUserEmployeeId
      : null;
  const currentUserIsAdmin = currentUser?.roles?.includes('Admin') ?? false;

  const insightMap = useMemo(
    () => buildInsightMap(schedule, schedule.employees),
    [schedule],
  );

  const currentUserEmployee = useMemo(
    () =>
      currentUserEmployeeId != null
        ? (schedule.employees.find((e) => e.employeeId === currentUserEmployeeId) ?? null)
        : null,
    [schedule.employees, currentUserEmployeeId],
  );

  const employeeRows = useMemo(
    () =>
      buildEmployeeDailyBars(schedule, insightMap, {
        scope: options.scope,
        statusFilter: options.statusFilter,
        taskCategoryFilter: options.taskCategoryFilter,
        employeeFilterId: options.employeeFilterId,
        currentUserEmployeeId,
        searchQuery: options.searchQuery,
        selectedDate: options.periodAnchor,
      }),
    [
      schedule,
      insightMap,
      options.scope,
      options.statusFilter,
      options.taskCategoryFilter,
      options.employeeFilterId,
      options.searchQuery,
      options.periodAnchor,
      currentUserEmployeeId,
    ],
  );

  const projectRows = useMemo(
    () =>
      buildProjectDailyBars(
        schedule,
        insightMap,
        options.statusFilter,
        options.taskCategoryFilter,
        options.searchQuery,
        options.periodAnchor,
      ),
    [
      schedule,
      insightMap,
      options.statusFilter,
      options.taskCategoryFilter,
      options.searchQuery,
      options.periodAnchor,
    ],
  );

  const unscheduledBars = useMemo(
    () =>
      buildUnscheduledTaskBars(
        schedule,
        insightMap,
        options.statusFilter,
        options.taskCategoryFilter,
        options.searchQuery,
      ),
    [schedule, insightMap, options.statusFilter, options.taskCategoryFilter, options.searchQuery],
  );

  const ganttTasks = useMemo(() => buildGanttTasksFromSchedule(schedule), [schedule]);

  const scopeMessage = useMemo(() => {
    if (queryReady) return null;
    if (options.scope === 'project') {
      return 'יש לבחור פרויקט כדי להציג את תוכנית העבודה בחתך פרויקט.';
    }
    if (options.scope === 'employee') {
      return 'יש לבחור עובד כדי להציג את תוכנית העבודה בחתך עובד.';
    }
    if (options.scope === 'personal') {
      return 'לא ניתן להציג תצוגה אישית: למשתמש המחובר אין עובד משויך.';
    }
    return null;
  }, [options.scope, queryReady]);

  return {
    schedule,
    employees: schedule.employees,
    employeeRows,
    projectRows,
    unscheduledBars,
    ganttTasks,
    insightMap,
    currentUserEmployeeId,
    currentUserEmployee,
    currentUserIsAdmin,
    isLoading: queryReady && scheduleQuery.isLoading,
    scheduleError: scheduleQuery.error ?? null,
    scopeMessage,
    isScopeSelectionPending: !queryReady,
  };
}

export async function fetchSmartAssignmentAsync(
  projectId: number | null,
  workItemIds?: number[],
) {
  return getSmartAssignmentRecommendationsAsync({
    projectId: projectId ?? undefined,
    workItemIds: workItemIds ?? undefined,
    includeLockedTasks: false,
    saveRun: false,
  });
}

export const WORKPLAN_INVALIDATION_KEYS = {
  schedule: ['workplan', 'schedule'] as const,
  all: ['workplan'] as const,
  projects: ['projects'] as const,
  projectLifecycle: (projectId: number) => ['projectLifecycle', projectId] as const,
  projectMilestones: (projectId: number) => ['projectMilestones', projectId] as const,
  serviceCalls: ['serviceCalls'] as const,
};

export async function invalidateWorkPlanQueries(
  queryClient: { invalidateQueries: (opts: { queryKey: readonly unknown[] }) => Promise<void> },
  projectId?: number | null,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: WORKPLAN_INVALIDATION_KEYS.schedule }),
    queryClient.invalidateQueries({ queryKey: WORKPLAN_INVALIDATION_KEYS.all }),
    queryClient.invalidateQueries({ queryKey: WORKPLAN_INVALIDATION_KEYS.projects }),
    ...(projectId != null
      ? [
          queryClient.invalidateQueries({
            queryKey: WORKPLAN_INVALIDATION_KEYS.projectLifecycle(projectId),
          }),
          queryClient.invalidateQueries({
            queryKey: WORKPLAN_INVALIDATION_KEYS.projectMilestones(projectId),
          }),
        ]
      : []),
  ]);
}
