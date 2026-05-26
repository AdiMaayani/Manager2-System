import { apiRequest } from '@api/client';
import type {
  CreateMilestoneRequest,
  CreateProjectRequest,
  CreateSiteRequest,
  ProjectLifecycle,
  ProjectListItem,
  ProjectMilestone,
  Site,
  UpdateMilestoneRequest,
  UpdateProjectRequest,
} from '../types';

export function getProjectsListAsync(): Promise<ProjectListItem[]> {
  return apiRequest<ProjectListItem[]>('/WorkItems/projects-list');
}

export function getProjectLifecycleAsync(projectId: number): Promise<ProjectLifecycle> {
  return apiRequest<ProjectLifecycle>(`/Projects/${projectId}/lifecycle`);
}

export function getProjectMilestonesAsync(projectId: number): Promise<ProjectMilestone[]> {
  return apiRequest<ProjectMilestone[]>(`/WorkItems/${projectId}/milestones`);
}

export function createProjectAsync(body: CreateProjectRequest): Promise<{ workItemId: number }> {
  return apiRequest<{ workItemId: number; message: string }>('/WorkItems/project', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateProjectAsync(
  projectId: number,
  body: UpdateProjectRequest,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/WorkItems/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function createMilestoneAsync(
  projectId: number,
  body: CreateMilestoneRequest,
): Promise<{ workItemId: number }> {
  return apiRequest<{ workItemId: number; message: string }>(
    `/WorkItems/${projectId}/milestones`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

export function updateMilestoneAsync(
  milestoneId: number,
  body: UpdateMilestoneRequest,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/WorkItems/milestones/${milestoneId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function cancelMilestoneAsync(milestoneId: number): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/WorkItems/milestones/${milestoneId}/cancel`, {
    method: 'PUT',
  });
}

export function getSitesAsync(): Promise<Site[]> {
  return apiRequest<Site[]>('/Sites');
}

export function createSiteAsync(body: CreateSiteRequest): Promise<Site> {
  return apiRequest<Site>('/Sites', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
