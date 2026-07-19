import { describe, expect, it } from 'vitest';
import { mapWorkPlanSchedule } from './workPlanMappers';

describe('mapWorkPlanSchedule assignments', () => {
  it('preserves assignment row ids and does not collapse separate direct rows', () => {
    const schedule = mapWorkPlanSchedule({
      scheduledTasks: [
        {
          workItemId: 42,
          assignments: [
            {
              workEmployeeAssignmentId: 101,
              workItemId: 42,
              employeeId: 7,
              employeeName: 'עובד א',
              assignmentRole: 'מתקין',
              isManualAssignment: false,
              assignmentSource: 'Task',
            },
            {
              workEmployeeAssignmentId: 102,
              workItemId: 42,
              employeeId: 7,
              employeeName: 'עובד א',
              assignmentRole: 'בודק',
              isManualAssignment: true,
              assignmentSource: 'Task',
            },
          ],
        },
      ],
    });

    expect(schedule.assignments).toHaveLength(2);
    expect(schedule.assignments.map((assignment) => assignment.workEmployeeAssignmentId))
      .toEqual([101, 102]);
  });
});
