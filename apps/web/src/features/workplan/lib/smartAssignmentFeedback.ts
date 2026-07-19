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
