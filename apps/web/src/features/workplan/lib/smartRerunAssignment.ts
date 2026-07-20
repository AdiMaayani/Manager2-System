import type {
  AssignEmployeeRequest,
  EmployeeAssignmentReplacementRequest,
  ReplaceEmployeeAssignmentRequest,
  SmartAssignmentRequest,
  SmartAssignmentWeights,
  WorkPlanScheduleAssignment,
  WorkPlanTaskSelection,
} from '../types';
import type { PlannedScheduleParts } from './taskScheduleUtils';
import { hydratePlannedScheduleFromUtc } from './taskScheduleUtils';
import { normalizeRequiredProfessions } from './requiredProfessions';
import { normalizeWorkPlanPriorityCode } from '../constants';

/**
 * Builds the authoritative saved-task recommendation request. The recommendation run is persisted
 * (saveRun) so a valid RecommendationRunId is returned before any smart assignment is recorded.
 */
export function buildSavedTaskRecommendationRequest(
  taskId: number,
  weights?: SmartAssignmentWeights | null,
): SmartAssignmentRequest {
  return {
    workItemIds: [taskId],
    includeLockedTasks: false,
    saveRun: true,
    ...(weights ? { weights } : {}),
  };
}

/** Resolves the primary direct task assignment (the one eligible for replacement), if any. */
export function resolvePrimaryDirectAssignment(
  taskId: number,
  assignments: readonly WorkPlanScheduleAssignment[],
): WorkPlanScheduleAssignment | null {
  return (
    assignments.find(
      (assignment) =>
        assignment.workItemId === taskId
        && assignment.assignmentSource === 'Task'
        && (assignment.workEmployeeAssignmentId ?? 0) > 0,
    ) ?? null
  );
}

export function resolveAssignmentRole(task: WorkPlanTaskSelection): string {
  return task.requiredRoles?.[0]?.trim() || task.requiredRole?.trim() || 'Executor';
}

export type SmartAssignmentSelection =
  | {
      kind: 'replace';
      workItemId: number;
      assignmentId: number;
      request: ReplaceEmployeeAssignmentRequest;
    }
  | {
      kind: 'assign-service-call';
      workItemId: number;
      request: AssignEmployeeRequest;
    }
  | {
      kind: 'assign-work-item';
      workItemId: number;
      request: AssignEmployeeRequest;
    };

/**
 * Decides how to record a smart assignment for the selected candidate:
 *  - an existing direct assignment is replaced (carrying the RecommendationRunId), or
 *  - a fresh assignment is created for the task (Service Call vs. work item endpoint).
 * The RecommendationRunId is always propagated so the assignment is stored as Smart, not manual.
 */
export function resolveSmartAssignmentSelection(params: {
  task: WorkPlanTaskSelection;
  primaryAssignment: WorkPlanScheduleAssignment | null;
  employeeId: number;
  recommendationRunId: number;
}): SmartAssignmentSelection {
  const { task, primaryAssignment, employeeId, recommendationRunId } = params;

  if (primaryAssignment && (primaryAssignment.workEmployeeAssignmentId ?? 0) > 0) {
    return {
      kind: 'replace',
      workItemId: task.taskId,
      assignmentId: primaryAssignment.workEmployeeAssignmentId!,
      request: { employeeId, recommendationRunId },
    };
  }

  const request: AssignEmployeeRequest = {
    employeeId,
    assignmentRole: resolveAssignmentRole(task),
    recommendationRunId,
  };

  return task.taskCategory === 'ServiceCall'
    ? { kind: 'assign-service-call', workItemId: task.taskId, request }
    : { kind: 'assign-work-item', workItemId: task.taskId, request };
}

/** Saved-task Smart Assignment rerun is only available while editing an unlocked, authorized task. */
export function canExposeSavedTaskSmartRerun(params: {
  canEdit: boolean;
  isLocked: boolean;
  hasDirectAssignment: boolean;
}): boolean {
  return params.canEdit && !params.isLocked && params.hasDirectAssignment;
}

export interface RecommendationAffectingFormSnapshot {
  plannedStart?: string | null;
  plannedEnd?: string | null;
  priority?: string | null;
  requiredRole?: string | null;
  requiredRoles?: string[] | null;
}

/**
 * True when edit-drawer fields that feed recommendations differ from the persisted task values.
 * Rerun must use saved state, so dirty recommendation inputs block generating a new run.
 */
export function hasUnsavedRecommendationAffectingChanges(params: {
  persisted: RecommendationAffectingFormSnapshot;
  scheduleParts: PlannedScheduleParts;
  priority: string;
  requiredRoles: readonly string[];
}): boolean {
  const persistedSchedule = hydratePlannedScheduleFromUtc(
    params.persisted.plannedStart,
    params.persisted.plannedEnd,
  );
  const persistedPriority =
    normalizeWorkPlanPriorityCode(params.persisted.priority) ?? params.persisted.priority ?? '';
  const currentPriority = normalizeWorkPlanPriorityCode(params.priority) ?? params.priority;
  const persistedRoles = normalizeRequiredProfessions(
    params.persisted.requiredRoles?.length
      ? params.persisted.requiredRoles
      : params.persisted.requiredRole
        ? [params.persisted.requiredRole]
        : [],
  );
  const currentRoles = normalizeRequiredProfessions([...params.requiredRoles]);

  return (
    persistedSchedule.startDate !== params.scheduleParts.startDate
    || persistedSchedule.startTime !== params.scheduleParts.startTime
    || persistedSchedule.endDate !== params.scheduleParts.endDate
    || persistedSchedule.endTime !== params.scheduleParts.endTime
    || persistedPriority !== currentPriority
    || persistedRoles.join('\0') !== currentRoles.join('\0')
  );
}

/** Staged smart candidate chosen in the edit drawer; applied only on Save. */
export interface StagedSmartReplacement {
  assignmentId: number;
  employeeId: number;
  recommendationRunId: number;
}

export type PendingAssignmentReplacement =
  | {
      kind: 'smart';
      assignmentId: number;
      previousEmployeeId: number | null;
      request: ReplaceEmployeeAssignmentRequest;
    }
  | {
      kind: 'manual';
      assignmentId: number;
      previousEmployeeId: number | null;
      employeeId: number;
    };

/**
 * Builds the save-time replacement plan from staged manual and smart selections.
 * Same-employee selections are omitted. Smart selections carry RecommendationRunId; manual do not.
 */
export function buildPendingAssignmentReplacements(params: {
  directAssignments: readonly WorkPlanScheduleAssignment[];
  replacementEmployeeIds: Readonly<Record<number, number | null | undefined>>;
  stagedSmartReplacement: StagedSmartReplacement | null;
}): PendingAssignmentReplacement[] {
  const { directAssignments, replacementEmployeeIds, stagedSmartReplacement } = params;
  const pending: PendingAssignmentReplacement[] = [];

  for (const assignment of directAssignments) {
    const assignmentId = assignment.workEmployeeAssignmentId ?? 0;
    if (assignmentId <= 0) continue;

    const replacementEmployeeId = replacementEmployeeIds[assignmentId] ?? null;
    if (replacementEmployeeId == null || replacementEmployeeId === assignment.employeeId) {
      continue;
    }

    const isSmart =
      stagedSmartReplacement != null
      && stagedSmartReplacement.assignmentId === assignmentId
      && stagedSmartReplacement.employeeId === replacementEmployeeId
      && stagedSmartReplacement.recommendationRunId > 0;

    if (isSmart && stagedSmartReplacement) {
      pending.push({
        kind: 'smart',
        assignmentId,
        previousEmployeeId: assignment.employeeId ?? null,
        request: {
          employeeId: replacementEmployeeId,
          recommendationRunId: stagedSmartReplacement.recommendationRunId,
        },
      });
      continue;
    }

    pending.push({
      kind: 'manual',
      assignmentId,
      previousEmployeeId: assignment.employeeId ?? null,
      employeeId: replacementEmployeeId,
    });
  }

  return pending;
}

export function toManualEmployeeReplacementRequests(
  pending: readonly PendingAssignmentReplacement[],
): EmployeeAssignmentReplacementRequest[] {
  return pending
    .filter((replacement): replacement is Extract<PendingAssignmentReplacement, { kind: 'manual' }> =>
      replacement.kind === 'manual')
    .map((replacement) => ({
      workEmployeeAssignmentId: replacement.assignmentId,
      employeeId: replacement.employeeId,
    }));
}

export function getSmartPendingReplacements(
  pending: readonly PendingAssignmentReplacement[],
): Array<Extract<PendingAssignmentReplacement, { kind: 'smart' }>> {
  return pending.filter(
    (replacement): replacement is Extract<PendingAssignmentReplacement, { kind: 'smart' }> =>
      replacement.kind === 'smart',
  );
}
