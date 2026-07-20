import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildPendingAssignmentReplacements,
  canExposeSavedTaskSmartRerun,
  getSmartPendingReplacements,
  hasUnsavedRecommendationAffectingChanges,
  toManualEmployeeReplacementRequests,
} from './smartRerunAssignment';
import { hydratePlannedScheduleFromUtc } from './taskScheduleUtils';
import type { WorkPlanScheduleAssignment } from '../types';

function readFeatureSource(relativePath: string): string {
  return readFileSync(
    resolve(process.cwd(), 'src/features/workplan', relativePath),
    'utf8',
  );
}

function makeDirectAssignment(
  overrides: Partial<WorkPlanScheduleAssignment> = {},
): WorkPlanScheduleAssignment {
  return {
    workEmployeeAssignmentId: 900,
    workItemId: 501,
    employeeId: 11,
    employeeName: 'עובד קיים',
    assignmentRole: 'חשמלאי',
    assignedHours: null,
    isManualAssignment: true,
    assignmentSource: 'Task',
    ...overrides,
  };
}

describe('saved-task smart rerun edit/save contract', () => {
  it('does not expose SmartRerunPanel from the read-only WorkPlanTaskPanel', () => {
    const source = readFeatureSource('components/WorkPlanTaskPanel/WorkPlanTaskPanel.tsx');
    expect(source).not.toContain('SmartRerunPanel');
    expect(source).not.toContain('הרץ שיבוץ חכם מחדש');
  });

  it('exposes SmartRerunPanel only inside EditTaskDrawer behind canExposeSavedTaskSmartRerun', () => {
    const source = readFeatureSource('components/EditTaskDrawer/EditTaskDrawer.tsx');
    expect(source).toContain('SmartRerunPanel');
    expect(source).toContain('canExposeSavedTaskSmartRerun');
    expect(source).toContain('showSmartRerun');
  });

  it('stages smart candidates in SmartRerunPanel without calling the replacement API', () => {
    const source = readFeatureSource('components/SmartRerunPanel/SmartRerunPanel.tsx');
    expect(source).not.toContain('replaceEmployeeAssignmentAsync');
    expect(source).not.toContain('assignEmployeeToWorkItemAsync');
    expect(source).toContain('onStageSelection');
    expect(source).toContain('הרץ שיבוץ חכם מחדש');
  });

  it('applies smart replacement with RecommendationRunId only on EditTaskDrawer Save', () => {
    const source = readFeatureSource('components/EditTaskDrawer/EditTaskDrawer.tsx');
    expect(source).toContain('replaceEmployeeAssignmentAsync');
    expect(source).toContain('buildPendingAssignmentReplacements');
    expect(source).toContain('getSmartPendingReplacements');
    expect(source).toContain('toManualEmployeeReplacementRequests');
  });

  it('keeps NewTaskModal Smart Assignment create behavior intact', () => {
    const source = readFeatureSource('components/NewTaskModal/NewTaskModal.tsx');
    expect(source).toContain('getSmartAssignmentRecommendationsAsync');
    expect(source).toContain('handleAcceptRecommendation');
    expect(source).toContain('persistDraftRecommendationContext');
    expect(source).not.toContain('SmartRerunPanel');
  });
});

describe('canExposeSavedTaskSmartRerun', () => {
  it('allows rerun only when authorized, unlocked, and a direct assignment exists', () => {
    expect(canExposeSavedTaskSmartRerun({
      canEdit: true,
      isLocked: false,
      hasDirectAssignment: true,
    })).toBe(true);
  });

  it('blocks locked or unauthorized tasks from staging smart replacement', () => {
    expect(canExposeSavedTaskSmartRerun({
      canEdit: false,
      isLocked: false,
      hasDirectAssignment: true,
    })).toBe(false);
    expect(canExposeSavedTaskSmartRerun({
      canEdit: true,
      isLocked: true,
      hasDirectAssignment: true,
    })).toBe(false);
    expect(canExposeSavedTaskSmartRerun({
      canEdit: true,
      isLocked: false,
      hasDirectAssignment: false,
    })).toBe(false);
  });
});

describe('hasUnsavedRecommendationAffectingChanges', () => {
  const persisted = {
    plannedStart: '2026-07-20T06:00:00.000Z',
    plannedEnd: '2026-07-20T08:00:00.000Z',
    priority: 'Normal',
    requiredRoles: ['חשמלאי'],
  };

  it('is false when the form still mirrors persisted recommendation inputs', () => {
    const scheduleParts = hydratePlannedScheduleFromUtc(
      persisted.plannedStart,
      persisted.plannedEnd,
    );

    expect(hasUnsavedRecommendationAffectingChanges({
      persisted,
      scheduleParts,
      priority: 'Normal',
      requiredRoles: ['חשמלאי'],
    })).toBe(false);
  });

  it('is true when schedule or required professions differ from persisted values', () => {
    const scheduleParts = hydratePlannedScheduleFromUtc(
      persisted.plannedStart,
      persisted.plannedEnd,
    );

    expect(hasUnsavedRecommendationAffectingChanges({
      persisted,
      scheduleParts: {
        ...scheduleParts,
        startTime: scheduleParts.startTime === '10:00' ? '11:00' : '10:00',
      },
      priority: 'Normal',
      requiredRoles: ['חשמלאי'],
    })).toBe(true);

    expect(hasUnsavedRecommendationAffectingChanges({
      persisted,
      scheduleParts,
      priority: 'Normal',
      requiredRoles: ['טכנאי'],
    })).toBe(true);
  });
});

describe('buildPendingAssignmentReplacements', () => {
  const assignment = makeDirectAssignment();

  it('omits a replacement when no staged employee differs from the current assignee', () => {
    expect(buildPendingAssignmentReplacements({
      directAssignments: [assignment],
      replacementEmployeeIds: { 900: null },
      stagedSmartReplacement: null,
    })).toEqual([]);

    expect(buildPendingAssignmentReplacements({
      directAssignments: [assignment],
      replacementEmployeeIds: { 900: 11 },
      stagedSmartReplacement: {
        assignmentId: 900,
        employeeId: 11,
        recommendationRunId: 77,
      },
    })).toEqual([]);
  });

  it('stages a smart replacement with RecommendationRunId for Save', () => {
    const pending = buildPendingAssignmentReplacements({
      directAssignments: [assignment],
      replacementEmployeeIds: { 900: 15 },
      stagedSmartReplacement: {
        assignmentId: 900,
        employeeId: 15,
        recommendationRunId: 9001,
      },
    });

    expect(pending).toEqual([{
      kind: 'smart',
      assignmentId: 900,
      previousEmployeeId: 11,
      request: { employeeId: 15, recommendationRunId: 9001 },
    }]);
    expect(getSmartPendingReplacements(pending)).toHaveLength(1);
    expect(toManualEmployeeReplacementRequests(pending)).toEqual([]);
  });

  it('keeps manual replacement RecommendationRunId-null/absent', () => {
    const pending = buildPendingAssignmentReplacements({
      directAssignments: [assignment],
      replacementEmployeeIds: { 900: 8 },
      stagedSmartReplacement: null,
    });

    expect(pending).toEqual([{
      kind: 'manual',
      assignmentId: 900,
      previousEmployeeId: 11,
      employeeId: 8,
    }]);
    expect(toManualEmployeeReplacementRequests(pending)).toEqual([{
      workEmployeeAssignmentId: 900,
      employeeId: 8,
    }]);
    expect(getSmartPendingReplacements(pending)).toEqual([]);
  });

  it('does not treat a mismatched smart stage as smart when the manual employee differs', () => {
    const pending = buildPendingAssignmentReplacements({
      directAssignments: [assignment],
      replacementEmployeeIds: { 900: 8 },
      stagedSmartReplacement: {
        assignmentId: 900,
        employeeId: 15,
        recommendationRunId: 9001,
      },
    });

    expect(pending[0]?.kind).toBe('manual');
    expect(toManualEmployeeReplacementRequests(pending)[0]?.employeeId).toBe(8);
  });
});
