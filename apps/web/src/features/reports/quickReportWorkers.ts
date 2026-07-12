export interface QuickReportAssignmentCandidate {
  employeeId?: number | null;
  employeeName?: string | null;
  assignmentRole?: string | null;
  isManualAssignment?: boolean;
  assignmentSource?: string | null;
  isActive?: boolean;
  isAssignable?: boolean;
}

export interface QuickReportWorkerSelection {
  reporterId: number | null;
  reporterName?: string;
  reporterRole?: string;
  relatedWorkerIds: number[];
}

function assignmentPriority(
  assignment: QuickReportAssignmentCandidate,
  preferredReporterId?: number | null,
): [number, number, number, number] {
  const employeeId = assignment.employeeId ?? Number.MAX_SAFE_INTEGER;
  return [
    employeeId === preferredReporterId ? 0 : 1,
    assignment.assignmentSource?.toLowerCase() === 'task' ? 0 : 1,
    assignment.isManualAssignment ? 0 : 1,
    employeeId,
  ];
}

function comparePriority(
  left: QuickReportAssignmentCandidate,
  right: QuickReportAssignmentCandidate,
  preferredReporterId?: number | null,
): number {
  const leftPriority = assignmentPriority(left, preferredReporterId);
  const rightPriority = assignmentPriority(right, preferredReporterId);

  for (let index = 0; index < leftPriority.length; index += 1) {
    const difference = leftPriority[index] - rightPriority[index];
    if (difference !== 0) return difference;
  }
  return 0;
}

export function resolveQuickReportWorkers(
  assignments: QuickReportAssignmentCandidate[],
  preferredReporterId?: number | null,
): QuickReportWorkerSelection {
  const eligibleAssignments = assignments
    .filter(
      (assignment) =>
        Number.isInteger(assignment.employeeId) &&
        Number(assignment.employeeId) > 0 &&
        assignment.isActive === true &&
        assignment.isAssignable === true,
    )
    .sort((left, right) => comparePriority(left, right, preferredReporterId));

  const uniqueAssignments: QuickReportAssignmentCandidate[] = [];
  const assignedEmployeeIds = new Set<number>();
  for (const assignment of eligibleAssignments) {
    const employeeId = Number(assignment.employeeId);
    if (assignedEmployeeIds.has(employeeId)) continue;
    assignedEmployeeIds.add(employeeId);
    uniqueAssignments.push(assignment);
  }

  const primaryAssignment = uniqueAssignments[0];
  const reporterId = primaryAssignment?.employeeId ?? null;

  return {
    reporterId,
    reporterName: primaryAssignment?.employeeName?.trim() || undefined,
    reporterRole: primaryAssignment?.assignmentRole?.trim() || undefined,
    relatedWorkerIds: uniqueAssignments
      .slice(1)
      .map((assignment) => Number(assignment.employeeId)),
  };
}

export function shouldApplyQuickReportAsyncResult(hasUserEditedForm: boolean): boolean {
  return !hasUserEditedForm;
}
