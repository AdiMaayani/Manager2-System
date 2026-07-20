import type {
  SmartAssignmentAssignmentFeedback,
  SmartAssignmentFeedbackRequest,
} from '../types';

export interface SmartAssignmentFeedbackContext {
  recommendationRunId: number;
  workItemId: number;
  recommendedEmployeeId: number;
  policyProfileKey: string;
  policyVersion: number;
}

export function isValidRecommendationRating(value: number | null): value is number {
  return value != null && Number.isInteger(value) && value >= 1 && value <= 10;
}

export function buildSmartAssignmentFeedbackRequest(
  context: SmartAssignmentFeedbackContext,
  rating: number,
  comment: string,
): SmartAssignmentFeedbackRequest {
  const normalizedComment = comment.trim();
  return {
    ...context,
    rating,
    comment: normalizedComment || null,
  };
}

export function smartAssignmentFeedbackQueryKey(
  workItemId: number,
  assignedEmployeeId: number,
) {
  return [
    'smartAssignment',
    'assignment-feedback',
    workItemId,
    assignedEmployeeId,
  ] as const;
}

/** True only when the panel holds a confirmed direct smart assignment employee. */
export function canQueryAssignmentFeedback(params: {
  taskId: number;
  assignmentWorkItemId: number;
  assignmentSource?: string | null;
  isManualAssignment?: boolean | null;
  assignedEmployeeId?: number | null;
}): boolean {
  return (
    params.taskId > 0
    && params.assignmentWorkItemId === params.taskId
    && params.assignmentSource === 'Task'
    && params.isManualAssignment === false
    && params.assignedEmployeeId != null
    && params.assignedEmployeeId > 0
  );
}

export interface AssignmentFeedbackQueryClient {
  cancelQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown>;
  removeQueries: (filters: { queryKey: readonly unknown[] }) => void;
}

/**
 * Phase 1 — stop any in-flight feedback fetch for employees who are about to leave the assignment.
 * Do not remove/invalidate yet: the read-only panel may still be observing the previous employee until
 * work-plan data refreshes.
 */
export async function cancelStaleAssignmentFeedbackQueries(
  queryClient: AssignmentFeedbackQueryClient,
  params: {
    workItemId: number;
    previousEmployeeIds: readonly (number | null | undefined)[];
  },
): Promise<void> {
  const previousEmployeeIds = uniquePositiveEmployeeIds(params.previousEmployeeIds);
  await Promise.all(
    previousEmployeeIds.map((employeeId) =>
      queryClient.cancelQueries({
        queryKey: smartAssignmentFeedbackQueryKey(params.workItemId, employeeId),
      })),
  );
}

/**
 * Phase 2 — after assignment/work-plan data has refreshed, drop obsolete previous-employee queries.
 * The newly confirmed employee query is left to load naturally from the updated assignment props.
 */
export function purgeStaleAssignmentFeedbackQueries(
  queryClient: AssignmentFeedbackQueryClient,
  params: {
    workItemId: number;
    previousEmployeeIds: readonly (number | null | undefined)[];
    nextEmployeeIds?: readonly (number | null | undefined)[];
  },
): void {
  const previousEmployeeIds = uniquePositiveEmployeeIds(params.previousEmployeeIds);
  const nextEmployeeIds = uniquePositiveEmployeeIds(params.nextEmployeeIds ?? []);

  for (const employeeId of previousEmployeeIds) {
    if (nextEmployeeIds.includes(employeeId)) continue;
    queryClient.removeQueries({
      queryKey: smartAssignmentFeedbackQueryKey(params.workItemId, employeeId),
    });
  }
}

function uniquePositiveEmployeeIds(
  employeeIds: readonly (number | null | undefined)[],
): number[] {
  return [...new Set(
    employeeIds.filter(
      (employeeId): employeeId is number => employeeId != null && employeeId > 0,
    ),
  )];
}

export function getAssignmentFeedbackContext(
  summary: SmartAssignmentAssignmentFeedback | null | undefined,
): SmartAssignmentFeedbackContext | null {
  if (!summary) return null;

  const source = summary.feedback ?? summary;
  const recommendationRunId = source.recommendationRunId;
  const policyProfileKey = source.policyProfileKey;
  const policyVersion = source.policyVersion;

  if (
    recommendationRunId == null
    || recommendationRunId <= 0
    || !policyProfileKey
    || policyVersion == null
    || policyVersion <= 0
    || summary.workItemId <= 0
    || summary.assignedEmployeeId <= 0
  ) {
    return null;
  }

  return {
    recommendationRunId,
    workItemId: summary.workItemId,
    recommendedEmployeeId: summary.assignedEmployeeId,
    policyProfileKey,
    policyVersion,
  };
}
