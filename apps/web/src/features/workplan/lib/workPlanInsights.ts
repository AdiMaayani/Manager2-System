import type { TaskInsightCounts, WorkPlanEmployee, WorkPlanSchedule } from '../types';
import { resolveFlatAssignment } from './workPlanScheduling';

export function buildInsightMap(
  schedule: WorkPlanSchedule,
  employees: WorkPlanEmployee[],
): Map<number, TaskInsightCounts> {
  const map = new Map<number, TaskInsightCounts>();
  const employeeById = new Map(employees.map((e) => [String(e.employeeId), e]));
  const allTasks = [...schedule.scheduledTasks, ...schedule.unscheduledTasks];

  for (const task of allTasks) {
    const assignment = resolveFlatAssignment(task, schedule.assignments);
    let violationCount = 0;
    let warningCount = 0;
    let suggestionCount = 0;

    if (!assignment.employeeId && !task.isLocked) {
      violationCount += 1;
      suggestionCount += 1;
    }

    if (task.isLocked && !assignment.employeeId) {
      warningCount += 1;
    }

    const requiredRoles = task.requiredRoles?.length
      ? task.requiredRoles
      : task.requiredRole
        ? [task.requiredRole]
        : [];
    if (requiredRoles.length > 0 && assignment.employeeId) {
      const employee = employeeById.get(assignment.employeeId);
      const employeeRoles = employee?.professions?.length
        ? employee.professions
        : employee?.primaryRole
          ? [employee.primaryRole]
          : [];
      const employeeRoleKeys = new Set(
        employeeRoles.map((role) => role.trim().normalize('NFKC').toLocaleLowerCase('he-IL')),
      );
      if (requiredRoles.some((role) =>
        !employeeRoleKeys.has(role.trim().normalize('NFKC').toLocaleLowerCase('he-IL')))) {
        warningCount += 1;
      }
    }

    const capacity = employeeById.get(assignment.employeeId ?? '')?.dailyCapacityHours ?? 8;
    if ((task.estimatedHours ?? 0) > capacity) {
      warningCount += 1;
    }

    map.set(task.workItemId, { violationCount, warningCount, suggestionCount });
  }

  return map;
}
