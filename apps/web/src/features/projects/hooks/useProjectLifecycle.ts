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
  assignEmployeeToProjectAsync,
  createMilestoneAsync,
  createProjectAsync,
  createSiteAsync,
  getProjectEmployeesAsync,
  getProjectLifecycleAsync,
  getProjectMilestonesAsync,
  getSitesAsync,
  updateMilestoneAsync,
  updateProjectAsync,
} from '../api/projectsApiClient';
import type {
  CreateMilestoneRequest,
  CreateProjectRequest,
  CreateSiteRequest,
  ProjectTeamForm,
  UpdateMilestoneRequest,
  UpdateProjectRequest,
} from '../types';
import {
  PROJECT_MANAGER_ROLE,
  teamFormFromProjectAssignments,
} from '../utils/projectDisplayUtils';

export function useProjectLifecycle(projectId: number | null) {
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
    enabled: projectId != null && projectId > 0,
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

  return {
    customers: customersQuery.data ?? [],
    sites: sitesQuery.data ?? [],
    employees: employeesQuery.data ?? [],
    isLoading:
      customersQuery.isLoading || sitesQuery.isLoading || employeesQuery.isLoading,
    error: customersQuery.error ?? sitesQuery.error ?? employeesQuery.error,
    refetch: () =>
      Promise.all([
        customersQuery.refetch(),
        sitesQuery.refetch(),
        employeesQuery.refetch(),
      ]),
  };
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
    mutationFn: async ({
      teamForm,
      previousTeamForm,
    }: {
      teamForm: ProjectTeamForm;
      previousTeamForm: ProjectTeamForm;
    }) => {
      if (projectId == null) {
        throw new Error('Project id is required.');
      }

      const assignments: Array<Promise<{ message: string }>> = [];

      if (
        teamForm.projectManagerEmployeeId &&
        teamForm.projectManagerEmployeeId !== previousTeamForm.projectManagerEmployeeId
      ) {
        assignments.push(
          assignEmployeeToProjectAsync(
            projectId,
            teamForm.projectManagerEmployeeId,
            PROJECT_MANAGER_ROLE,
          ),
        );
      }

      teamForm.teamEmployeeIds.forEach((employeeId) => {
        if (previousTeamForm.teamEmployeeIds.includes(employeeId)) return;

        assignments.push(
          assignEmployeeToProjectAsync(projectId, employeeId, 'מתקין'),
        );
      });

      await Promise.all(assignments);
    },
    onSuccess: () => {
      if (projectId == null) return;
      queryClient.invalidateQueries({ queryKey: ['projectLifecycle', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export { teamFormFromProjectAssignments };
