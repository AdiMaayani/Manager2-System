import { ApiError, apiRequest } from '@api/client';
import { mapAllWorkPlansResponse, mapEmployeeResponse, mapWorkPlanResponse } from '../lib/workPlanMappers';
import type {
  AssignEmployeeRequest,
  CreateTaskRequest,
  MappedWorkPlan,
  SmartAssignmentRequest,
  SmartAssignmentResponse,
  WorkPlanEmployee,
} from '../types';

interface CreateWorkItemResponse {
  workItemId?: number;
}

interface AssignEmployeeResponse {
  message?: string;
}

export async function getWorkPlanByIdAsync(projectId: number): Promise<MappedWorkPlan | null> {
  try {
    const response = await apiRequest<unknown>(`/WorkItems/${projectId}/work-plan`);
    return mapWorkPlanResponse(response as Parameters<typeof mapWorkPlanResponse>[0]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function getAllWorkPlansAsync(): Promise<MappedWorkPlan[]> {
  const response = await apiRequest<unknown>('/WorkItems/work-plan/all');
  return mapAllWorkPlansResponse(response);
}

export async function getWorkPlanEmployeesAsync(): Promise<WorkPlanEmployee[]> {
  const response = await apiRequest<unknown>('/Employees');
  return mapEmployeeResponse(response);
}

export async function getSmartAssignmentRecommendationsAsync(
  request: SmartAssignmentRequest,
): Promise<SmartAssignmentResponse> {
  return apiRequest<SmartAssignmentResponse>('/SmartAssignment/recommend', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function createWorkItemAsync(
  request: CreateTaskRequest,
): Promise<CreateWorkItemResponse> {
  return apiRequest<CreateWorkItemResponse>('/WorkItems/task', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function assignEmployeeToWorkItemAsync(
  workItemId: number,
  request: AssignEmployeeRequest,
): Promise<AssignEmployeeResponse> {
  return apiRequest<AssignEmployeeResponse>(`/WorkItems/${workItemId}/assign-employee`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
