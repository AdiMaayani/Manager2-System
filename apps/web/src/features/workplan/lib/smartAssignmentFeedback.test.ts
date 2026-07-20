import { describe, expect, it, vi } from 'vitest';
import {
  buildSmartAssignmentFeedbackRequest,
  canQueryAssignmentFeedback,
  cancelStaleAssignmentFeedbackQueries,
  getAssignmentFeedbackContext,
  isValidRecommendationRating,
  purgeStaleAssignmentFeedbackQueries,
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

  it('enables feedback queries only for a confirmed current smart assignment employee', () => {
    expect(canQueryAssignmentFeedback({
      taskId: 42,
      assignmentWorkItemId: 42,
      assignmentSource: 'Task',
      isManualAssignment: false,
      assignedEmployeeId: 15,
    })).toBe(true);

    expect(canQueryAssignmentFeedback({
      taskId: 42,
      assignmentWorkItemId: 42,
      assignmentSource: 'Task',
      isManualAssignment: true,
      assignedEmployeeId: 11,
    })).toBe(false);

    expect(canQueryAssignmentFeedback({
      taskId: 42,
      assignmentWorkItemId: 99,
      assignmentSource: 'Project',
      isManualAssignment: false,
      assignedEmployeeId: 11,
    })).toBe(false);
  });

  it('cancels previous-employee feedback before purge and does not touch the next employee early', async () => {
    const cancelQueries = vi.fn(async () => undefined);
    const removeQueries = vi.fn();
    const queryClient = { cancelQueries, removeQueries };

    await cancelStaleAssignmentFeedbackQueries(queryClient, {
      workItemId: 42,
      previousEmployeeIds: [11, null, 11],
    });

    expect(cancelQueries).toHaveBeenCalledTimes(1);
    expect(cancelQueries).toHaveBeenCalledWith({
      queryKey: smartAssignmentFeedbackQueryKey(42, 11),
    });
    expect(removeQueries).not.toHaveBeenCalled();

    purgeStaleAssignmentFeedbackQueries(queryClient, {
      workItemId: 42,
      previousEmployeeIds: [11],
      nextEmployeeIds: [15],
    });

    expect(removeQueries).toHaveBeenCalledTimes(1);
    expect(removeQueries).toHaveBeenCalledWith({
      queryKey: smartAssignmentFeedbackQueryKey(42, 11),
    });
  });

  it('does not remove a previous employee who remains the next assignee', () => {
    const removeQueries = vi.fn();
    purgeStaleAssignmentFeedbackQueries(
      { cancelQueries: vi.fn(async () => undefined), removeQueries },
      {
        workItemId: 42,
        previousEmployeeIds: [11],
        nextEmployeeIds: [11],
      },
    );
    expect(removeQueries).not.toHaveBeenCalled();
  });
});
