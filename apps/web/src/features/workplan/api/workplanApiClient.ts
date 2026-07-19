import { apiRequest } from '@api/client';
import { mapWorkPlanSchedule } from '../lib/workPlanMappers';
import type {
  AssignEmployeeRequest,
  CreateTaskRequest,
  DraftRecommendationRequest,
  DraftRecommendationResponse,
  ReplaceEmployeeAssignmentRequest,
  SmartAssignmentRequest,
  SmartAssignmentResponse,
  SmartAssignmentAssignmentFeedback,
  SmartAssignmentFeedbackRecord,
  SmartAssignmentFeedbackRequest,
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
      professions: mapStringArray(employee.professions),
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
  signal?: AbortSignal,
): Promise<DraftRecommendationResponse> {
  const response = await apiRequest<Record<string, unknown>>('/SmartAssignment/recommend-draft', {
    method: 'POST',
    body: JSON.stringify(request),
    signal,
  });
  return mapDraftRecommendationResponse(response);
}

function mapRecommendationFactor(raw: Record<string, unknown>) {
  const sourceValues =
    typeof raw.sourceValues === 'object' && raw.sourceValues !== null && !Array.isArray(raw.sourceValues)
      ? (raw.sourceValues as Record<string, unknown>)
      : undefined;

  return {
    key: String(raw.key ?? ''),
    label: String(raw.label ?? ''),
    score: raw.score != null ? Number(raw.score) : null,
    weightPercent: Number(raw.weightPercent ?? 0),
    weightedContribution:
      raw.weightedContribution != null ? Number(raw.weightedContribution) : null,
    explanation: String(raw.explanation ?? ''),
    dataSource: String(raw.dataSource ?? ''),
    hasData: raw.hasData === true,
    isDefaulted: raw.isDefaulted === true,
    missingInputCodes: Array.isArray(raw.missingInputCodes)
      ? raw.missingInputCodes.map(String)
      : [],
    sourceValues,
  };
}

function mapStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function mapDraftRecommendationResponse(
  response: Record<string, unknown>,
): DraftRecommendationResponse {
  const candidates = Array.isArray(response.candidates)
    ? response.candidates.map((candidate) => {
        const raw = candidate as Record<string, unknown>;
        return {
          rankOrder: raw.rankOrder != null ? Number(raw.rankOrder) : null,
          employeeId: Number(raw.employeeId),
          fullName: raw.fullName as string | null,
          primaryRole: raw.primaryRole as string | null,
          professions: mapStringArray(raw.professions),
          requiredRoles: mapStringArray(raw.requiredRoles),
          matchedRoles: mapStringArray(raw.matchedRoles),
          missingRoles: mapStringArray(raw.missingRoles),
          totalScore: raw.totalScore != null ? Number(raw.totalScore) : null,
          isEligible: raw.isEligible === true,
          exclusionReason: raw.exclusionReason as string | null,
          status: String(raw.status ?? ''),
          recommendationSummary: raw.recommendationSummary as string | null,
          warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : [],
          rejectionReasonCodes: Array.isArray(raw.rejectionReasons)
            ? raw.rejectionReasons
                .map((reason) => (reason as Record<string, unknown>)?.code)
                .filter((code): code is string => typeof code === 'string' && code.length > 0)
            : Array.isArray(raw.rejectionReasonCodes)
              ? raw.rejectionReasonCodes.map(String)
              : [],
          missingInputCodes: Array.isArray(raw.missingInputCodes)
            ? raw.missingInputCodes.map(String)
            : [],
          policyProfileKey: raw.policyProfileKey as string | null,
          policyVersion: raw.policyVersion != null ? Number(raw.policyVersion) : null,
          policyDisplayName: raw.policyDisplayName as string | null,
          originTypeUsed: raw.originTypeUsed as string | null,
          travelMinutes: raw.travelMinutes != null ? Number(raw.travelMinutes) : null,
          distanceKm: raw.distanceKm != null ? Number(raw.distanceKm) : null,
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

export function saveSmartAssignmentFeedbackAsync(
  request: SmartAssignmentFeedbackRequest,
): Promise<SmartAssignmentFeedbackRecord> {
  return apiRequest<SmartAssignmentFeedbackRecord>('/SmartAssignment/feedback', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function getSmartAssignmentAssignmentFeedbackAsync(
  workItemId: number,
  assignedEmployeeId: number,
): Promise<SmartAssignmentAssignmentFeedback> {
  const params = new URLSearchParams({
    assignedEmployeeId: String(assignedEmployeeId),
  });
  return apiRequest<SmartAssignmentAssignmentFeedback>(
    `/SmartAssignment/work-items/${workItemId}/assignment-feedback?${params.toString()}`,
  );
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

export async function replaceEmployeeAssignmentAsync(
  workItemId: number,
  assignmentId: number,
  request: ReplaceEmployeeAssignmentRequest,
): Promise<AssignEmployeeResponse> {
  return apiRequest<AssignEmployeeResponse>(
    `/WorkItems/${workItemId}/employee-assignments/${assignmentId}`,
    {
      method: 'PUT',
      body: JSON.stringify(request),
    },
  );
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
  return apiRequest<{ message?: string }>(`/WorkItems/task/${workItemId}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}
