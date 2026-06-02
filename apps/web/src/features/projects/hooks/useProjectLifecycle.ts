import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isLocalDataMode } from '@/config/appConfig';
import { getCustomersAsync } from '@features/customers/api/customersApiClient';
import { resolveDataAsync } from '@shared/data/resolveDataAsync';
import {
  delayMock,
  mockCustomers,
  mockProjectLifecycle,
  mockProjectMilestones,
  mockSites,
} from '@shared/mock';
import {
  cancelMilestoneAsync,
  createMilestoneAsync,
  createProjectAsync,
  createSiteAsync,
  getProjectEmployeesAsync,
  getProjectLifecycleAsync,
  getProjectMilestonesAsync,
  getSitesAsync,
  syncProjectEmployeeAssignmentsAsync,
  updateMilestoneAsync,
  updateProjectAsync,
} from '../api/projectsApiClient';
import type {
  CreateMilestoneRequest,
  CreateProjectRequest,
  CreateSiteRequest,
  ProjectTeamForm,
  SyncProjectEmployeeAssignmentsRequest,
  UpdateMilestoneRequest,
  UpdateProjectRequest,
} from '../types';
import {
  PROJECT_MANAGER_ROLE,
  teamFormFromProjectAssignments,
} from '../utils/projectDisplayUtils';

const TEAM_MEMBER_ROLE = 'מתקין';

function buildProjectTeamAssignments(
  teamForm: ProjectTeamForm,
): SyncProjectEmployeeAssignmentsRequest {
  const employees: SyncProjectEmployeeAssignmentsRequest['employees'] = [];
  const assignedEmployeeIds = new Set<number>();

  if (teamForm.projectManagerEmployeeId != null) {
    employees.push({
      employeeId: teamForm.projectManagerEmployeeId,
      assignmentRole: PROJECT_MANAGER_ROLE,
    });
    assignedEmployeeIds.add(teamForm.projectManagerEmployeeId);
  }

  teamForm.teamEmployeeIds.forEach((employeeId) => {
    if (assignedEmployeeIds.has(employeeId)) return;

    employees.push({
      employeeId,
      assignmentRole: TEAM_MEMBER_ROLE,
    });
    assignedEmployeeIds.add(employeeId);
  });

  return { employees };
}

export function useProjectLifecycle(projectId: number | null, enabled = true) {
  return useQuery({
    queryKey: ['projectLifecycle', projectId, isLocalDataMode],
    queryFn: () => {
      if (projectId == null) {
        throw new Error('Project id is required.');
      }

      return resolveDataAsync(
        () => getProjectLifecycleAsync(projectId),
        () => delayMock(mockProjectLifecycle(projectId)),
      );
    },
    enabled: enabled && projectId != null && projectId > 0,
  });
}

export function useProjectMilestones(projectId: number | null, enabled = true) {
  return useQuery({
    queryKey: ['projectMilestones', projectId, isLocalDataMode],
    queryFn: () => {
      if (projectId == null) {
        throw new Error('Project id is required.');
      }

      return resolveDataAsync(
        () => getProjectMilestonesAsync(projectId),
        () => delayMock(mockProjectMilestones(projectId)),
      );
    },
    enabled: enabled && projectId != null && projectId > 0,
  });
}

export function useProjectLookups() {
  const customersQuery = useQuery({
    queryKey: ['projectLookups', 'customers', isLocalDataMode],
    queryFn: () =>
      resolveDataAsync(getCustomersAsync, () => delayMock(mockCustomers)),
  });

  const sitesQuery = useQuery({
    queryKey: ['projectLookups', 'sites', isLocalDataMode],
    queryFn: () => resolveDataAsync(getSitesAsync, () => delayMock(mockSites)),
  });

  const employeesQuery = useQuery({
    queryKey: ['projectLookups', 'employees', isLocalDataMode],
    queryFn: () => resolveDataAsync(getProjectEmployeesAsync, () => delayMock([])),
  });
  const refetchCustomers = customersQuery.refetch;
  const refetchSites = sitesQuery.refetch;
  const refetchEmployees = employeesQuery.refetch;

  const refetch = useCallback(
    () =>
      Promise.all([
        refetchCustomers(),
        refetchSites(),
        refetchEmployees(),
      ]),
    [refetchCustomers, refetchEmployees, refetchSites],
  );

  return useMemo(
    () => ({
      customers: customersQuery.data ?? [],
      sites: sitesQuery.data ?? [],
      employees: employeesQuery.data ?? [],
      isLoading:
        customersQuery.isLoading || sitesQuery.isLoading || employeesQuery.isLoading,
      error: customersQuery.error ?? sitesQuery.error ?? employeesQuery.error,
      refetch,
    }),
    [
      customersQuery.data,
      customersQuery.error,
      customersQuery.isLoading,
      employeesQuery.data,
      employeesQuery.error,
      employeesQuery.isLoading,
      refetch,
      sitesQuery.data,
      sitesQuery.error,
      sitesQuery.isLoading,
    ],
  );
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateProjectRequest) => createProjectAsync(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      body,
    }: {
      projectId: number;
      body: UpdateProjectRequest;
    }) => updateProjectAsync(projectId, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({
        queryKey: ['projectLifecycle', variables.projectId],
      });
    },
  });
}

export function useMilestoneMutations(projectId: number | null) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    if (projectId == null) return;
    queryClient.invalidateQueries({ queryKey: ['projectLifecycle', projectId] });
    queryClient.invalidateQueries({ queryKey: ['projectMilestones', projectId] });
  };

  const createMutation = useMutation({
    mutationFn: (body: CreateMilestoneRequest) => {
      if (projectId == null) throw new Error('Project id is required.');
      return createMilestoneAsync(projectId, body);
    },
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      milestoneId,
      body,
    }: {
      milestoneId: number;
      body: UpdateMilestoneRequest;
    }) => updateMilestoneAsync(milestoneId, body),
    onSuccess: invalidate,
  });

  const cancelMutation = useMutation({
    mutationFn: (milestoneId: number) => cancelMilestoneAsync(milestoneId),
    onSuccess: invalidate,
  });

  return { createMutation, updateMutation, cancelMutation };
}

export function useCreateSite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateSiteRequest) => createSiteAsync(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectLookups', 'sites'] });
    },
  });
}

export function useAssignProjectTeam(projectId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teamForm: ProjectTeamForm) => {
      if (projectId == null) {
        throw new Error('Project id is required.');
      }

      return syncProjectEmployeeAssignmentsAsync(
        projectId,
        buildProjectTeamAssignments(teamForm),
      );
    },
    onSuccess: () => {
      if (projectId == null) return;
      queryClient.invalidateQueries({ queryKey: ['projectLifecycle', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export { teamFormFromProjectAssignments };
export { buildProjectTeamAssignments };
