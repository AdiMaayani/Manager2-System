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
  searchQuery: string;
  selectedDate: Date;
}) {
  const {
    data: employees = [],
    isLoading: employeesLoading,
    error: employeesError,
  } = useWorkPlanEmployees();
  const {
    data: allWorkPlans = [],
    isLoading: allLoading,
    error: allWorkPlansError,
  } = useAllWorkPlans();
  const singleProjectId =
    !options.isAllProjectsMode && typeof options.projectFilter === 'number'
      ? options.projectFilter
      : null;
  const {
    data: singleWorkPlan,
    isLoading: singleLoading,
    error: singleWorkPlanError,
  } = useWorkPlanByProject(singleProjectId);

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
  // Treat a missing or non-positive employeeId (e.g. an admin account that is
  // not linked to an employee row) as "no linked employee" so personal scope
  // never falls back to another employee.
  const rawCurrentUserEmployeeId = currentUser?.employeeId ?? null;
  const currentUserEmployeeId =
    rawCurrentUserEmployeeId != null && rawCurrentUserEmployeeId > 0
      ? rawCurrentUserEmployeeId
      : null;
  const currentUserIsAdmin = currentUser?.roles?.includes('Admin') ?? false;

  const currentUserEmployee = useMemo(
    () =>
      currentUserEmployeeId != null
        ? (employees.find((employee) => employee.employeeId === currentUserEmployeeId) ?? null)
        : null,
    [employees, currentUserEmployeeId],
  );

  const employeeRows = useMemo(
    () =>
      buildEmployeeDailyBars(employees, activeWorkPlans, insightMap, {
        scope: options.scope,
        statusFilter: options.statusFilter,
        employeeFilterId: options.employeeFilterId,
        currentUserEmployeeId,
        searchQuery: options.searchQuery,
        selectedDate: options.selectedDate,
      }),
    [
      employees,
      activeWorkPlans,
      insightMap,
      options.scope,
      options.statusFilter,
      options.employeeFilterId,
      options.searchQuery,
      options.selectedDate,
      currentUserEmployeeId,
    ],
  );

  const projectRows = useMemo(
    () =>
      buildProjectDailyBars(
        activeWorkPlans,
        insightMap,
        options.statusFilter,
        options.searchQuery,
        options.selectedDate,
      ),
    [activeWorkPlans, insightMap, options.statusFilter, options.searchQuery, options.selectedDate],
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
    currentUserEmployeeId,
    currentUserEmployee,
    currentUserIsAdmin,
    isLoading: employeesLoading || allLoading || (singleProjectId != null && singleLoading),
    error: employeesError ?? allWorkPlansError ?? singleWorkPlanError ?? null,
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
