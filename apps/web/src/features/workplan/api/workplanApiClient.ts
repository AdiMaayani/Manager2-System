import { ApiError, apiRequest } from '@api/client';
import { mapAllWorkPlansResponse, mapEmployeeResponse, mapWorkPlanResponse } from '../lib/workPlanMappers';
import type {
  AssignEmployeeRequest,
  CreateTaskRequest,
  DraftRecommendationRequest,
  DraftRecommendationResponse,
  InternalWorkContext,
  MappedWorkPlan,
  SmartAssignmentRequest,
  SmartAssignmentResponse,
  UpdateTaskRequest,
  WorkItemResponse,
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
  const response = await apiRequest<unknown>('/Employees/lookup');
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

// Ranked recommendations for a not-yet-saved (draft) task, scored against the draft's own context.
export async function getDraftRecommendationsAsync(
  request: DraftRecommendationRequest,
): Promise<DraftRecommendationResponse> {
  return apiRequest<DraftRecommendationResponse>('/SmartAssignment/recommend-draft', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getInternalWorkContextAsync(): Promise<InternalWorkContext> {
  return apiRequest<InternalWorkContext>('/WorkItems/internal-context');
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

export async function getWorkItemByIdAsync(workItemId: number): Promise<WorkItemResponse> {
  return apiRequest<WorkItemResponse>(`/WorkItems/${workItemId}`);
}

// Reuses the existing milestones/cancel endpoint: it soft-deletes any work
// item whose WorkType is "Task", which is exactly what WorkPlan tasks are.
export async function cancelWorkPlanTaskAsync(taskId: number): Promise<{ message?: string }> {
  return apiRequest<{ message?: string }>(`/WorkItems/milestones/${taskId}/cancel`, {
    method: 'PUT',
  });
}

export async function updateWorkItemAsync(
  workItemId: number,
  request: UpdateTaskRequest,
): Promise<{ message?: string }> {
  return apiRequest<{ message?: string }>(`/WorkItems/${workItemId}`, {
    method: 'PUT',
    body: JSON.stringify({
      workItemId,
      title: request.title,
      description: request.description,
      workType: request.workType,
      billingType: request.billingType,
      status: request.status,
      customerId: request.customerId,
      siteId: request.siteId,
      plannedStart: request.plannedStart,
      plannedEnd: request.plannedEnd,
      estimatedHours: request.estimatedHours,
      priority: request.priority,
      requiredRole: request.requiredRole,
      isLocked: request.isLocked,
      // sp_UpdateWorkItem overwrites every column, so untouched values must be
      // echoed back or the update silently NULLs them in the database.
      dealCloseDate: request.dealCloseDate,
      financeProjectNumber: request.financeProjectNumber,
      invoiceNumber: request.invoiceNumber,
      actualStart: request.actualStart,
      actualEnd: request.actualEnd,
      actualHours: request.actualHours,
    }),
  });
}
