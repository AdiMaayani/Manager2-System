import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCustomersAsync } from '@features/customers/api/customersApiClient';
import {
  reorderProjectMilestonesAsync,
  createMilestoneAsync,
  createProjectAsync,
  createSiteAsync,
  deactivateMilestoneAsync,
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
    queryKey: ['projectLifecycle', projectId],
    queryFn: () => {
      if (projectId == null) {
        throw new Error('Project id is required.');
      }

      return getProjectLifecycleAsync(projectId);
    },
    enabled: enabled && projectId != null && projectId > 0,
  });
}

export function useProjectMilestones(projectId: number | null, enabled = true) {
  return useQuery({
    queryKey: ['projectMilestones', projectId],
    queryFn: () => {
      if (projectId == null) {
        throw new Error('Project id is required.');
      }

      return getProjectMilestonesAsync(projectId);
    },
    enabled: enabled && projectId != null && projectId > 0,
  });
}

export function useProjectLookups() {
  const customersQuery = useQuery({
    queryKey: ['projectLookups', 'customers'],
    queryFn: getCustomersAsync,
  });

  const sitesQuery = useQuery({
    queryKey: ['projectLookups', 'sites'],
    queryFn: getSitesAsync,
  });

  const employeesQuery = useQuery({
    queryKey: ['projectLookups', 'employees'],
    queryFn: getProjectEmployeesAsync,
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
    }) => {
      if (projectId == null) throw new Error('Project id is required.');
      return updateMilestoneAsync(projectId, milestoneId, body);
    },
    onSuccess: invalidate,
  });

  const deactivateMutation = useMutation({
    mutationFn: (milestoneId: number) => {
      if (projectId == null) throw new Error('Project id is required.');
      return deactivateMilestoneAsync(projectId, milestoneId);
    },
    onSuccess: invalidate,
  });

  const reorderMutation = useMutation({
    mutationFn: (items: { projectMilestoneId: number; sortOrder: number }[]) => {
      if (projectId == null) throw new Error('Project id is required.');
      return reorderProjectMilestonesAsync(projectId, items);
    },
    onSuccess: invalidate,
  });

  return { createMutation, updateMutation, deactivateMutation, reorderMutation };
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
