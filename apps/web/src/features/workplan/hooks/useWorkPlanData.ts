import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isLocalDataMode } from '@/config/appConfig';
import { getCurrentUser } from '@api/auth';
import { resolveDataAsync } from '@shared/data/resolveDataAsync';
import {
  delayMock,
  mockAllWorkPlans,
  mockSmartAssignmentResponse,
  mockWorkPlanEmployees,
} from '@shared/mock';
import {
  getAllWorkPlansAsync,
  getSmartAssignmentRecommendationsAsync,
  getWorkPlanByIdAsync,
  getWorkPlanEmployeesAsync,
} from '../api/workplanApiClient';
import { buildInsightMap } from '../lib/workPlanInsights';
import {
  buildEmployeeDailyBars,
  buildGanttTasksFromWorkPlan,
  buildProjectDailyBars,
} from '../lib/workPlanScheduling';
import { mapAllWorkPlansResponse } from '../lib/workPlanMappers';
import type { WorkPlanProjectFilter, WorkPlanScope } from '../types';

export function useWorkPlanEmployees() {
  return useQuery({
    queryKey: ['workplan', 'employees', isLocalDataMode],
    queryFn: () =>
      resolveDataAsync(getWorkPlanEmployeesAsync, () => delayMock(mockWorkPlanEmployees)),
  });
}

export function useAllWorkPlans() {
  return useQuery({
    queryKey: ['workplan', 'all', isLocalDataMode],
    queryFn: () =>
      resolveDataAsync(getAllWorkPlansAsync, () =>
        delayMock(mapAllWorkPlansResponse(mockAllWorkPlans)),
      ),
  });
}

export function useWorkPlanByProject(projectId: number | null) {
  return useQuery({
    queryKey: ['workplan', 'project', projectId, isLocalDataMode],
    enabled: projectId != null && projectId > 0,
    queryFn: async () => {
      if (!projectId) return null;
      return resolveDataAsync(
        () => getWorkPlanByIdAsync(projectId),
        async () => {
          const all = mapAllWorkPlansResponse(mockAllWorkPlans);
          return all.find((wp) => wp.project.id === projectId) ?? null;
        },
      );
    },
  });
}

export function useWorkPlanScheduling(options: {
  scope: WorkPlanScope;
  projectFilter: WorkPlanProjectFilter;
  isAllProjectsMode: boolean;
  statusFilter: string;
  employeeFilterId: string;
}) {
  const { data: employees = [], isLoading: employeesLoading } = useWorkPlanEmployees();
  const { data: allWorkPlans = [], isLoading: allLoading } = useAllWorkPlans();
  const singleProjectId =
    !options.isAllProjectsMode && typeof options.projectFilter === 'number'
      ? options.projectFilter
      : null;
  const { data: singleWorkPlan, isLoading: singleLoading } = useWorkPlanByProject(singleProjectId);

  const activeWorkPlans = useMemo(() => {
    if (options.isAllProjectsMode) return allWorkPlans;
    if (singleWorkPlan) return [singleWorkPlan];
    return [];
  }, [allWorkPlans, options.isAllProjectsMode, singleWorkPlan]);

  const insightMap = useMemo(
    () => buildInsightMap(activeWorkPlans, employees),
    [activeWorkPlans, employees],
  );

  const currentUser = getCurrentUser();

  const employeeRows = useMemo(
    () =>
      buildEmployeeDailyBars(employees, activeWorkPlans, insightMap, {
        scope: options.scope,
        statusFilter: options.statusFilter,
        employeeFilterId: options.employeeFilterId,
        currentUserEmployeeId: currentUser?.employeeId ?? null,
      }),
    [
      employees,
      activeWorkPlans,
      insightMap,
      options.scope,
      options.statusFilter,
      options.employeeFilterId,
      currentUser?.employeeId,
    ],
  );

  const projectRows = useMemo(
    () => buildProjectDailyBars(activeWorkPlans, insightMap, options.statusFilter),
    [activeWorkPlans, insightMap, options.statusFilter],
  );

  const ganttTasks = useMemo(() => {
    if (!singleWorkPlan || options.isAllProjectsMode) return [];
    return buildGanttTasksFromWorkPlan(singleWorkPlan);
  }, [singleWorkPlan, options.isAllProjectsMode]);

  const projectOptions = useMemo(
    () =>
      allWorkPlans.map((wp) => ({
        id: wp.project.id,
        title: wp.project.title,
      })),
    [allWorkPlans],
  );

  return {
    employees,
    allWorkPlans,
    activeWorkPlans,
    singleWorkPlan,
    employeeRows,
    projectRows,
    ganttTasks,
    projectOptions,
    insightMap,
    isLoading: employeesLoading || allLoading || (singleProjectId != null && singleLoading),
  };
}

export async function fetchSmartAssignmentAsync(
  projectId: number | null,
  workItemIds?: number[],
) {
  return resolveDataAsync(
    () =>
      getSmartAssignmentRecommendationsAsync({
        projectId: projectId ?? undefined,
        workItemIds: workItemIds ?? undefined,
        includeLockedTasks: false,
        saveRun: false,
      }),
    () => delayMock(mockSmartAssignmentResponse),
  );
}
