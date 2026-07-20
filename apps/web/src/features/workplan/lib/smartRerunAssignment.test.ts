import { describe, expect, it } from 'vitest';
import {
  buildSavedTaskRecommendationRequest,
  resolvePrimaryDirectAssignment,
  resolveSmartAssignmentSelection,
  canExposeSavedTaskSmartRerun,
} from './smartRerunAssignment';
import type {
  SmartAssignmentWeights,
  WorkPlanScheduleAssignment,
  WorkPlanTaskSelection,
} from '../types';

const weights: SmartAssignmentWeights = {
  professionalFit: 35,
  availability: 25,
  workload: 15,
  geography: 15,
  experience: 10,
};

function makeTask(overrides: Partial<WorkPlanTaskSelection> = {}): WorkPlanTaskSelection {
  return {
    taskId: 501,
    title: 'משימה',
    status: 'Planned',
    projectId: 12,
    projectTitle: 'פרויקט',
    assigneeName: '—',
    assigneeEmployeeId: null,
    startHour: 9,
    endHour: 11,
    isLocked: false,
    isUnscheduled: false,
    requiredRoles: ['חשמלאי'],
    taskCategory: 'Regular',
    ...overrides,
  };
}

function makeDirectAssignment(
  overrides: Partial<WorkPlanScheduleAssignment> = {},
): WorkPlanScheduleAssignment {
  return {
    workEmployeeAssignmentId: 900,
    workItemId: 501,
    employeeId: 77,
    employeeName: 'עובד קיים',
    assignmentRole: 'חשמלאי',
    assignedHours: null,
    isManualAssignment: true,
    assignmentSource: 'Task',
    ...overrides,
  };
}

describe('buildSavedTaskRecommendationRequest', () => {
  it('targets the single task, excludes locked tasks and persists the run', () => {
    expect(buildSavedTaskRecommendationRequest(501, weights)).toEqual({
      workItemIds: [501],
      includeLockedTasks: false,
      saveRun: true,
      weights,
    });
  });

  it('omits weights when not supplied', () => {
    expect(buildSavedTaskRecommendationRequest(501)).toEqual({
      workItemIds: [501],
      includeLockedTasks: false,
      saveRun: true,
    });
  });
});

describe('resolvePrimaryDirectAssignment', () => {
  it('returns the direct task assignment with a persisted id', () => {
    const assignment = makeDirectAssignment();
    expect(resolvePrimaryDirectAssignment(501, [assignment])).toBe(assignment);
  });

  it('ignores project-inherited or synthetic assignments without a persisted id', () => {
    const inherited = makeDirectAssignment({ assignmentSource: 'Project', workItemId: 12 });
    const synthetic = makeDirectAssignment({ workEmployeeAssignmentId: null });
    expect(resolvePrimaryDirectAssignment(501, [inherited, synthetic])).toBeNull();
  });
});

describe('resolveSmartAssignmentSelection', () => {
  it('assigns a work item when the task has no direct assignment', () => {
    const selection = resolveSmartAssignmentSelection({
      task: makeTask(),
      primaryAssignment: null,
      employeeId: 42,
      recommendationRunId: 9001,
    });

    expect(selection).toEqual({
      kind: 'assign-work-item',
      workItemId: 501,
      request: { employeeId: 42, assignmentRole: 'חשמלאי', recommendationRunId: 9001 },
    });
  });

  it('uses the service-call endpoint for a service call with no assignment', () => {
    const selection = resolveSmartAssignmentSelection({
      task: makeTask({ taskCategory: 'ServiceCall', requiredRoles: [] }),
      primaryAssignment: null,
      employeeId: 42,
      recommendationRunId: 9001,
    });

    expect(selection.kind).toBe('assign-service-call');
    expect(selection.request).toMatchObject({
      employeeId: 42,
      assignmentRole: 'Executor',
      recommendationRunId: 9001,
    });
  });

  it('replaces the existing direct assignment and carries the recommendation run id', () => {
    const selection = resolveSmartAssignmentSelection({
      task: makeTask(),
      primaryAssignment: makeDirectAssignment(),
      employeeId: 42,
      recommendationRunId: 9001,
    });

    expect(selection).toEqual({
      kind: 'replace',
      workItemId: 501,
      assignmentId: 900,
      request: { employeeId: 42, recommendationRunId: 9001 },
    });
  });
});

describe('canExposeSavedTaskSmartRerun', () => {
  it('is false for locked or unauthorized saved tasks', () => {
    expect(canExposeSavedTaskSmartRerun({
      canEdit: true,
      isLocked: true,
      hasDirectAssignment: true,
    })).toBe(false);
    expect(canExposeSavedTaskSmartRerun({
      canEdit: false,
      isLocked: false,
      hasDirectAssignment: true,
    })).toBe(false);
  });
});
