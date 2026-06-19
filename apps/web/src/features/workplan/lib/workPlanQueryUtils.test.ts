import { describe, expect, it } from 'vitest';
import {
  isWorkPlanScheduleQueryReady,
  parsePositiveInt,
  resolveScheduleEmployeeId,
  resolveScheduleProjectId,
} from '../../../features/workplan/lib/workPlanQueryUtils';

describe('workPlanQueryUtils', () => {
  it('parses positive integers only', () => {
    expect(parsePositiveInt('12')).toBe(12);
    expect(parsePositiveInt('0')).toBeNull();
    expect(parsePositiveInt('abc')).toBeNull();
    expect(parsePositiveInt('')).toBeNull();
  });

  it('resolves project scope ids only when scope is project', () => {
    expect(resolveScheduleProjectId('project', 42)).toBe(42);
    expect(resolveScheduleProjectId('project', 'all')).toBeNull();
    expect(resolveScheduleProjectId('company', 42)).toBeNull();
  });

  it('resolves employee scope ids from toolbar selection', () => {
    expect(resolveScheduleEmployeeId('employee', '7')).toBe(7);
    expect(resolveScheduleEmployeeId('employee', '')).toBeNull();
    expect(resolveScheduleEmployeeId('company', '7')).toBeNull();
  });

  it('gates schedule queries until scope prerequisites exist', () => {
    expect(
      isWorkPlanScheduleQueryReady({
        scope: 'employee',
        projectId: null,
        employeeId: null,
        currentUserEmployeeId: 1,
      }),
    ).toBe(false);

    expect(
      isWorkPlanScheduleQueryReady({
        scope: 'employee',
        projectId: null,
        employeeId: 5,
        currentUserEmployeeId: 1,
      }),
    ).toBe(true);

    expect(
      isWorkPlanScheduleQueryReady({
        scope: 'project',
        projectId: null,
        employeeId: null,
        currentUserEmployeeId: 1,
      }),
    ).toBe(false);
  });
});
