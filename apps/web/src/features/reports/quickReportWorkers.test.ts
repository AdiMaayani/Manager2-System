import { describe, expect, it } from 'vitest';
import {
  resolveQuickReportWorkers,
  shouldApplyQuickReportAsyncResult,
  type QuickReportAssignmentCandidate,
} from './quickReportWorkers';

const activeAssignment = (
  employeeId: number,
  overrides: Partial<QuickReportAssignmentCandidate> = {},
): QuickReportAssignmentCandidate => ({
  employeeId,
  employeeName: `Worker ${employeeId}`,
  assignmentRole: 'Installer',
  isManualAssignment: true,
  assignmentSource: 'Task',
  isActive: true,
  isAssignable: true,
  ...overrides,
});

describe('resolveQuickReportWorkers', () => {
  it('selects the only assigned worker as primary reporter', () => {
    expect(resolveQuickReportWorkers([activeAssignment(8)])).toEqual({
      reporterId: 8,
      reporterName: 'Worker 8',
      reporterRole: 'Installer',
      relatedWorkerIds: [],
    });
  });

  it('uses the preferred valid worker and prefills every other worker', () => {
    expect(
      resolveQuickReportWorkers(
        [activeAssignment(8), activeAssignment(9), activeAssignment(10)],
        9,
      ),
    ).toEqual({
      reporterId: 9,
      reporterName: 'Worker 9',
      reporterRole: 'Installer',
      relatedWorkerIds: [8, 10],
    });
  });

  it('deduplicates repeated assignment inputs', () => {
    expect(
      resolveQuickReportWorkers([
        activeAssignment(8),
        activeAssignment(8, { isManualAssignment: false }),
        activeAssignment(9),
      ]),
    ).toMatchObject({
      reporterId: 8,
      relatedWorkerIds: [9],
    });
  });

  it('excludes inactive, missing, invalid, and non-assignable workers', () => {
    expect(
      resolveQuickReportWorkers([
        activeAssignment(8),
        activeAssignment(9, { isActive: false }),
        activeAssignment(10, { isAssignable: false }),
        { employeeId: 11, isActive: false, isAssignable: false },
        activeAssignment(0),
      ]),
    ).toMatchObject({
      reporterId: 8,
      relatedWorkerIds: [],
    });
  });

  it('does not apply a delayed async result after the user edits the form', () => {
    expect(shouldApplyQuickReportAsyncResult(true)).toBe(false);
    expect(shouldApplyQuickReportAsyncResult(false)).toBe(true);
  });

  it('resolves route or storage fallback assignments deterministically', () => {
    expect(
      resolveQuickReportWorkers([
        activeAssignment(14, { isManualAssignment: false }),
        activeAssignment(12, { isManualAssignment: true }),
      ]),
    ).toEqual({
      reporterId: 12,
      reporterName: 'Worker 12',
      reporterRole: 'Installer',
      relatedWorkerIds: [14],
    });
  });
});
