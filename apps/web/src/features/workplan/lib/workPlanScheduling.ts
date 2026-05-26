import type {
  MappedWorkPlan,
  ResolvedAssignment,
  ScheduledTaskBar,
  TaskInsightCounts,
  WorkPlanEmployee,
  WorkPlanTaskSummary,
} from '../types';

export function resolveAssignment(
  task: WorkPlanTaskSummary,
  workPlan: MappedWorkPlan,
): ResolvedAssignment {
  const empty: ResolvedAssignment = {
    displayName: '—',
    source: 'none',
    type: null,
    employeeId: null,
    contractorId: null,
    role: '',
  };

  if (!workPlan.assignments.length) return empty;

  let assignment = workPlan.assignments.find((a) => a.workItemId === task.workItemId);
  let source: ResolvedAssignment['source'] = 'task';

  if (!assignment) {
    assignment = workPlan.assignments.find((a) => a.workItemId === workPlan.project.id);
    source = assignment ? 'project' : 'none';
  }

  if (!assignment) return empty;

  if (assignment.employeeName || assignment.employeeId != null) {
    return {
      displayName: assignment.employeeName ?? String(assignment.employeeId),
      source,
      type: 'employee',
      employeeId: assignment.employeeId != null ? String(assignment.employeeId) : null,
      contractorId: null,
      role: assignment.assignmentRole ?? '',
    };
  }

  if (assignment.contractorName || assignment.contractorId != null) {
    return {
      displayName: assignment.contractorName ?? String(assignment.contractorId),
      source,
      type: 'contractor',
      employeeId: null,
      contractorId:
        assignment.contractorId != null ? String(assignment.contractorId) : null,
      role: assignment.assignmentRole ?? '',
    };
  }

  return empty;
}

export function buildTaskInsightCounts(
  taskId: number,
  insightMap: Map<number, TaskInsightCounts>,
): TaskInsightCounts {
  return (
    insightMap.get(taskId) ?? {
      violationCount: 0,
      warningCount: 0,
      suggestionCount: 0,
    }
  );
}

export function buildEmployeeDailyBars(
  employees: WorkPlanEmployee[],
  workPlans: MappedWorkPlan[],
  insightMap: Map<number, TaskInsightCounts>,
  options: {
    employeeFilterId?: string;
    currentUserEmployeeId?: number | null;
    scope: 'company' | 'personal' | 'employee' | 'project';
    statusFilter: string;
  },
): Array<{ employee: WorkPlanEmployee; tasks: ScheduledTaskBar[] }> {
  const taskContexts = workPlans.flatMap((workPlan) =>
    workPlan.tasks.map((task) => ({ task, workPlan })),
  );

  const filteredEmployees = employees.filter((employee) => {
    if (!employee.fullName || !employee.isActive) return false;
    const employeeId = String(employee.employeeId);

    if (options.scope === 'personal' && options.currentUserEmployeeId != null) {
      return employee.employeeId === options.currentUserEmployeeId;
    }

    if (options.scope === 'employee' && options.employeeFilterId) {
      return employeeId === options.employeeFilterId;
    }

    return true;
  });

  return filteredEmployees.map((employee) => {
    const employeeId = String(employee.employeeId);
    const employeeTasks = taskContexts.filter(({ task, workPlan }) => {
      const assignment = resolveAssignment(task, workPlan);
      if (String(assignment.employeeId ?? '').trim() !== employeeId) return false;
      return matchesStatusFilter(task.status, options.statusFilter);
    });

    const tasks: ScheduledTaskBar[] = employeeTasks.map(({ task, workPlan }, index) => {
      const assignment = resolveAssignment(task, workPlan);
      const insights = buildTaskInsightCounts(task.workItemId, insightMap);
      const startHour = Math.min(8 + index * 2, 22);
      const duration = Math.max(2, Math.ceil((task.estimatedHours ?? 2) / 1));
      const endHour = Math.min(startHour + duration, 24);

      return {
        taskId: task.workItemId,
        title: task.title,
        status: task.status,
        projectId: task.parentWorkItemId ?? workPlan.project.id,
        projectTitle: workPlan.project.title,
        assigneeName: employee.fullName,
        employeeId,
        startHour,
        endHour,
        isLocked: task.isLocked,
        isPersonal: false,
        assignmentSource: assignment.source,
        violationCount: insights.violationCount,
        warningCount: insights.warningCount,
        suggestionCount: insights.suggestionCount,
      };
    });

    return { employee, tasks };
  });
}

export function buildProjectDailyBars(
  workPlans: MappedWorkPlan[],
  insightMap: Map<number, TaskInsightCounts>,
  statusFilter: string,
): Array<{ projectId: number; projectTitle: string; tasks: ScheduledTaskBar[] }> {
  return workPlans
    .filter((workPlan) => workPlan.project.id > 0 && workPlan.tasks.length > 0)
    .map((workPlan) => {
      const tasks: ScheduledTaskBar[] = workPlan.tasks
        .filter((task) => matchesStatusFilter(task.status, statusFilter))
        .map((task, index) => {
          const assignment = resolveAssignment(task, workPlan);
          const insights = buildTaskInsightCounts(task.workItemId, insightMap);
          const startHour = Math.min(8 + index * 2, 22);
          const endHour = Math.min(startHour + 2, 24);

          return {
            taskId: task.workItemId,
            title: task.title,
            status: task.status,
            projectId: workPlan.project.id,
            projectTitle: workPlan.project.title,
            assigneeName: assignment.displayName,
            employeeId: assignment.employeeId ?? '',
            startHour,
            endHour,
            isLocked: task.isLocked,
            isPersonal: false,
            assignmentSource: assignment.source,
            violationCount: insights.violationCount,
            warningCount: insights.warningCount,
            suggestionCount: insights.suggestionCount,
          };
        });

      return {
        projectId: workPlan.project.id,
        projectTitle: workPlan.project.title,
        tasks,
      };
    });
}

export function hourToPercent(hour: number): number {
  return (hour / 24) * 100;
}

export function hourSpanToWidth(startHour: number, endHour: number): number {
  return ((endHour - startHour) / 24) * 100;
}

function matchesStatusFilter(status: string, filter: string): boolean {
  if (filter === 'all') return true;
  const normalized = status.toLowerCase();
  if (filter === 'planned') {
    return normalized.includes('תכנון') || normalized.includes('מתוכנן');
  }
  if (filter === 'in-progress') {
    return normalized.includes('ביצוע');
  }
  if (filter === 'done') {
    return normalized.includes('הושלם') || normalized.includes('סיום');
  }
  return true;
}

export function buildGanttTasksFromWorkPlan(workPlan: MappedWorkPlan) {
  return workPlan.tasks.map((task) => {
    const start = task.plannedStart?.slice(0, 10) ?? '2025-01-20';
    const end = task.plannedEnd?.slice(0, 10) ?? '2025-01-28';
    const progress =
      task.status.toLowerCase().includes('הושלם') || task.status.toLowerCase().includes('סיום')
        ? 100
        : task.status.toLowerCase().includes('ביצוע')
          ? 50
          : 20;

    return {
      id: String(task.workItemId),
      name: task.title,
      start,
      end,
      progress,
    };
  });
}
