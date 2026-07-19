import { describe, expect, it } from 'vitest';
import {
  buildSmartAssignmentFeedbackRequest,
  getAssignmentFeedbackContext,
  isValidRecommendationRating,
  smartAssignmentFeedbackQueryKey,
} from './smartAssignmentFeedback';

const context = {
  recommendationRunId: 17,
  workItemId: 42,
  recommendedEmployeeId: 8,
  policyProfileKey: 'balanced',
  policyVersion: 3,
};

describe('smart assignment feedback', () => {
  it('accepts only whole ratings from 1 through 10', () => {
    expect(isValidRecommendationRating(1)).toBe(true);
    expect(isValidRecommendationRating(10)).toBe(true);
    expect(isValidRecommendationRating(0)).toBe(false);
    expect(isValidRecommendationRating(11)).toBe(false);
    expect(isValidRecommendationRating(4.5)).toBe(false);
    expect(isValidRecommendationRating(null)).toBe(false);
  });

  it('builds the exact feedback contract and trims an optional comment', () => {
    expect(buildSmartAssignmentFeedbackRequest(context, 9, '  Very useful  ')).toEqual({
      ...context,
      rating: 9,
      comment: 'Very useful',
    });
    expect(buildSmartAssignmentFeedbackRequest(context, 6, '   ').comment).toBeNull();
  });

  it('builds a stable task-and-employee query key', () => {
    expect(smartAssignmentFeedbackQueryKey(42, 8)).toEqual([
      'smartAssignment',
      'assignment-feedback',
      42,
      8,
    ]);
  });

  it('resolves persisted feedback context and rejects incomplete metadata', () => {
    expect(getAssignmentFeedbackContext({
      workItemId: 42,
      assignedEmployeeId: 8,
      assignedEmployeeName: 'Worker',
      isManualAssignment: false,
      assignmentMethod: 'SmartAssignment',
      recommendationRunId: 17,
      policyProfileKey: 'balanced',
      policyVersion: 3,
      feedback: null,
    })).toEqual(context);

    expect(getAssignmentFeedbackContext({
      workItemId: 42,
      assignedEmployeeId: 8,
      isManualAssignment: true,
      assignmentMethod: 'Manual',
      recommendationRunId: null,
      feedback: null,
    })).toBeNull();
  });
});
