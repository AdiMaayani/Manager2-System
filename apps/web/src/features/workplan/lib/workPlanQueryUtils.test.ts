import { describe, expect, it } from 'vitest';
import {
  buildWorkPlanEmployeeFilterOptions,
  buildWorkPlanProjectFilterOptions,
  isWorkPlanScheduleQueryReady,
  parsePositiveInt,
  resolveCurrentUserEmployeeId,
  resolveScheduleEmployeeId,
  resolveScheduleProjectId,
} from './workPlanQueryUtils';

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

  it('resolves the connected employee id from auth payload', () => {
    expect(resolveCurrentUserEmployeeId(12)).toBe(12);
    expect(resolveCurrentUserEmployeeId(0)).toBeNull();
    expect(resolveCurrentUserEmployeeId(null)).toBeNull();
  });

  it('keeps the selected employee visible in filter options', () => {
    const options = buildWorkPlanEmployeeFilterOptions(
      [{ employeeId: 1, fullName: 'Alice' }],
      '9',
    );
    expect(options).toEqual([
      { employeeId: 1, fullName: 'Alice' },
      { employeeId: 9, fullName: 'עובד #9' },
    ]);
  });

  it('keeps the selected project visible in filter options', () => {
    const options = buildWorkPlanProjectFilterOptions(
      [{ id: 2, title: 'Beta' }],
      42,
    );
    expect(options[0]).toEqual({ id: 42, title: 'פרויקט #42' });
  });

  it('builds employee-scope schedule params only with a positive employee id', () => {
    expect(resolveScheduleEmployeeId('employee', '7')).toBe(7);
    expect(resolveScheduleEmployeeId('employee', 'all')).toBeNull();
    expect(resolveScheduleEmployeeId('employee', 'NaN')).toBeNull();
  });
});
