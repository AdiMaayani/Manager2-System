import { describe, expect, it } from 'vitest';
import { buildProjectTeamAssignments } from './useProjectLifecycle';

describe('buildProjectTeamAssignments', () => {
  it('keeps the optional project manager separate from team members', () => {
    expect(
      buildProjectTeamAssignments({
        projectManagerEmployeeId: 5,
        teamEmployeeIds: [8, 9],
      }),
    ).toEqual({
      employees: [
        { employeeId: 5, assignmentRole: 'Project Manager' },
        { employeeId: 8, assignmentRole: 'מתקין' },
        { employeeId: 9, assignmentRole: 'מתקין' },
      ],
    });
  });

  it('sends selected team members when no project manager is selected', () => {
    expect(
      buildProjectTeamAssignments({
        projectManagerEmployeeId: null,
        teamEmployeeIds: [8],
      }),
    ).toEqual({
      employees: [{ employeeId: 8, assignmentRole: 'מתקין' }],
    });
  });

  it('does not duplicate the project manager as a team member', () => {
    expect(
      buildProjectTeamAssignments({
        projectManagerEmployeeId: 5,
        teamEmployeeIds: [5, 8, 8],
      }),
    ).toEqual({
      employees: [
        { employeeId: 5, assignmentRole: 'Project Manager' },
        { employeeId: 8, assignmentRole: 'מתקין' },
      ],
    });
  });
});
