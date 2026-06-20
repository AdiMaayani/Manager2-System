import { apiRequest } from '@api/client';
import { mapWorkPlanSchedule } from '../lib/workPlanMappers';
import type {
  AssignEmployeeRequest,
  CreateTaskRequest,
  DraftRecommendationRequest,
  DraftRecommendationResponse,
  SmartAssignmentRequest,
  SmartAssignmentResponse,
  UpdateTaskRequest,
  WorkItemResponse,
  WorkPlanEmployee,
  WorkPlanSchedule,
  WorkPlanScheduleFilters,
} from '../types';

interface CreateWorkItemResponse {
  workItemId?: number;
}

interface AssignEmployeeResponse {
  message?: string;
}

function buildWorkPlanQuery(filters: WorkPlanScheduleFilters): string {
  const params = new URLSearchParams();
  params.set('scope', filters.scope);
  if (filters.projectId != null && filters.projectId > 0) {
    params.set('projectId', String(filters.projectId));
  }
  if (filters.employeeId != null && filters.employeeId > 0) {
    params.set('employeeId', String(filters.employeeId));
  }
  if (filters.status && filters.status !== 'all') {
    params.set('status', filters.status);
  }
  if (filters.taskCategory && filters.taskCategory !== 'all') {
    params.set('taskCategory', filters.taskCategory);
  }
  params.set('fromUtc', filters.fromUtc);
  params.set('toUtc', filters.toUtc);
  params.set('includeUnscheduled', String(filters.includeUnscheduled ?? true));
  return `?${params.toString()}`;
}

export async function getWorkPlanScheduleAsync(
  filters: WorkPlanScheduleFilters,
): Promise<WorkPlanSchedule> {
  const response = await apiRequest<unknown>(`/WorkItems/work-plan${buildWorkPlanQuery(filters)}`);
  return mapWorkPlanSchedule(response);
}

export async function getWorkPlanEmployeesAsync(): Promise<WorkPlanEmployee[]> {
  const response = await apiRequest<unknown>('/Employees/lookup');
  if (!Array.isArray(response)) {
    throw new Error('מבנה נתוני העובדים מהשרת אינו תקין');
  }
  return (response as Array<Record<string, unknown>>)
    .filter((employee) => employee.employeeId != null)
    .map((employee) => ({
      employeeId: Number(employee.employeeId),
      fullName: String(employee.fullName ?? ''),
      primaryRole: String(employee.primaryRole ?? ''),
      dailyCapacityHours:
        employee.dailyCapacityHours != null ? Number(employee.dailyCapacityHours) : null,
      isAssignable: employee.isAssignable !== false,
      isActive: employee.isActive !== false,
    }));
}

export async function getSmartAssignmentRecommendationsAsync(
  request: SmartAssignmentRequest,
): Promise<SmartAssignmentResponse> {
  return apiRequest<SmartAssignmentResponse>('/SmartAssignment/recommend', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getDraftRecommendationsAsync(
  request: DraftRecommendationRequest,
): Promise<DraftRecommendationResponse> {
  const response = await apiRequest<Record<string, unknown>>('/SmartAssignment/recommend-draft', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return mapDraftRecommendationResponse(response);
}

function mapRecommendationFactor(raw: Record<string, unknown>) {
  return {
    key: String(raw.key ?? ''),
    label: String(raw.label ?? ''),
    score: raw.score != null ? Number(raw.score) : null,
    weightPercent: Number(raw.weightPercent ?? 0),
    explanation: String(raw.explanation ?? ''),
    dataSource: String(raw.dataSource ?? ''),
    hasData: raw.hasData === true,
  };
}

function mapDraftRecommendationResponse(response: Record<string, unknown>): DraftRecommendationResponse {
  const candidates = Array.isArray(response.candidates)
    ? response.candidates.map((candidate) => {
        const raw = candidate as Record<string, unknown>;
        return {
          rankOrder: raw.rankOrder != null ? Number(raw.rankOrder) : null,
          employeeId: Number(raw.employeeId),
          fullName: raw.fullName as string | null,
          primaryRole: raw.primaryRole as string | null,
          totalScore: raw.totalScore != null ? Number(raw.totalScore) : null,
          isEligible: raw.isEligible === true,
          exclusionReason: raw.exclusionReason as string | null,
          status: String(raw.status ?? ''),
          recommendationSummary: raw.recommendationSummary as string | null,
          warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : [],
          factors: Array.isArray(raw.factors)
            ? raw.factors.map((factor) => mapRecommendationFactor(factor as Record<string, unknown>))
            : [],
        };
      })
    : [];

  return {
    generatedAt: String(response.generatedAt ?? ''),
    message: String(response.message ?? ''),
    candidates,
  };
}

export function getEmployeePrimaryRolesAsync(): Promise<string[]> {
  return apiRequest<string[]>('/Employees/primary-roles');
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

export async function deleteWorkPlanTaskAsync(taskId: number): Promise<void> {
  await apiRequest<void>(`/WorkItems/tasks/${taskId}`, {
    method: 'DELETE',
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
      ...request,
    }),
  });
}
