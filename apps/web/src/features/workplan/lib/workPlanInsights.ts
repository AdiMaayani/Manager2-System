import type { MappedWorkPlan, TaskInsightCounts, WorkPlanEmployee } from '../types';
import { resolveAssignment } from './workPlanScheduling';

export function buildInsightMap(
  workPlans: MappedWorkPlan[],
  employees: WorkPlanEmployee[],
): Map<number, TaskInsightCounts> {
  const map = new Map<number, TaskInsightCounts>();
  const employeeById = new Map(employees.map((e) => [String(e.employeeId), e]));

  for (const workPlan of workPlans) {
    for (const task of workPlan.tasks) {
      const assignment = resolveAssignment(task, workPlan);
      let violationCount = 0;
      let warningCount = 0;
      let suggestionCount = 0;

      if (!assignment.employeeId && !assignment.contractorId && !task.isLocked) {
        violationCount += 1;
        suggestionCount += 1;
      }

      if (task.isLocked && !assignment.employeeId) {
        warningCount += 1;
      }

      if (task.requiredRole && assignment.employeeId) {
        const employee = employeeById.get(assignment.employeeId);
        if (
          employee &&
          employee.primaryRole &&
          !employee.primaryRole.includes(task.requiredRole) &&
          task.requiredRole !== employee.primaryRole
        ) {
          warningCount += 1;
        }
      }

      if ((task.estimatedHours ?? 0) > (employeeById.get(assignment.employeeId ?? '')?.dailyCapacityHours ?? 8)) {
        warningCount += 1;
      }

      map.set(task.workItemId, { violationCount, warningCount, suggestionCount });
    }
  }

  return map;
}
