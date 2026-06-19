import {
  clampUtcIntervalToLocalDay,
  localDateKeyFromUtc,
  toLocalDateKey,
} from '@shared/utils/utcDateTime';
import { getTaskCategoryLabel } from '@shared/constants/taskCategories';
import type {
  ResolvedAssignment,
  ScheduledTaskBar,
  TaskInsightCounts,
  WorkPlanEmployee,
  WorkPlanSchedule,
  WorkPlanScheduleAssignment,
  WorkPlanScheduledTask,
  WorkPlanTaskSelection,
} from '../types';
import {
  getWorkPlanPriorityDisplay,
  getWorkPlanStatusDisplay,
  isWorkPlanPriorityUrgent,
  isWorkPlanStatusDone,
  isWorkPlanStatusInProgress,
  matchesWorkPlanStatusFilter,
} from '../constants';

export function matchesWorkPlanSearch(
  fields: Array<string | null | undefined>,
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return fields.some((field) =>
    String(field ?? '').toLowerCase().includes(normalizedQuery),
  );
}

export function buildTaskSearchFields(
  task: WorkPlanScheduledTask,
  assignment: ResolvedAssignment,
): Array<string | null | undefined> {
  return [
    task.title,
    task.description,
    task.projectTitle,
    task.customerName,
    task.siteName,
    task.milestoneTitle,
    getTaskCategoryLabel(task.taskCategory),
    assignment.displayName,
    assignment.role,
    task.requiredRole,
    task.status,
    getWorkPlanStatusDisplay(task.status),
    task.priority,
    getWorkPlanPriorityDisplay(task.priority),
  ];
}

export function taskMatchesSelectedLocalDate(
  plannedStartUtc: string | null | undefined,
  plannedEndUtc: string | null | undefined,
  selectedDate?: Date | null,
): boolean {
  if (!selectedDate) return true;
  if (!plannedStartUtc || !plannedEndUtc) return false;

  const dayKey = toLocalDateKey(selectedDate);
  return clampUtcIntervalToLocalDay(plannedStartUtc, plannedEndUtc, dayKey) != null;
}

export function resolveFlatAssignment(
  task: WorkPlanScheduledTask,
  assignments: WorkPlanScheduleAssignment[],
): ResolvedAssignment {
  const empty: ResolvedAssignment = {
    displayName: '—',
    source: 'none',
    type: null,
    employeeId: null,
    contractorId: null,
    role: '',
  };

  const taskAssignment = assignments.find((a) => a.workItemId === task.workItemId);
  if (taskAssignment?.employeeId != null || taskAssignment?.employeeName) {
    return {
      displayName: taskAssignment.employeeName ?? String(taskAssignment.employeeId),
      source: taskAssignment.assignmentSource === 'Project' ? 'project' : 'task',
      type: 'employee',
      employeeId:
        taskAssignment.employeeId != null ? String(taskAssignment.employeeId) : null,
      contractorId: null,
      role: taskAssignment.assignmentRole ?? '',
    };
  }

  if (task.projectId != null) {
    const projectAssignment = assignments.find(
      (a) => a.workItemId === task.projectId && a.assignmentSource === 'Project',
    );
    if (projectAssignment?.employeeId != null || projectAssignment?.employeeName) {
      return {
        displayName: projectAssignment.employeeName ?? String(projectAssignment.employeeId),
        source: 'project',
        type: 'employee',
        employeeId:
          projectAssignment.employeeId != null
            ? String(projectAssignment.employeeId)
            : null,
        contractorId: null,
        role: projectAssignment.assignmentRole ?? '',
      };
    }
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

export function buildWorkPlanTaskSelection(
  task: WorkPlanScheduledTask,
  assignment: ResolvedAssignment,
  localDayKey: string,
  isUnscheduled: boolean,
): WorkPlanTaskSelection {
  let startHour = 0;
  let endHour = 0;

  if (!isUnscheduled && task.plannedStart && task.plannedEnd) {
    const clamped = clampUtcIntervalToLocalDay(task.plannedStart, task.plannedEnd, localDayKey);
    if (clamped) {
      startHour = clamped.startHour;
      endHour = clamped.endHour;
    }
  }

  return {
    taskId: task.workItemId,
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    workType: task.workType ?? null,
    taskCategory: task.taskCategory ?? null,
    projectId: task.projectId ?? null,
    projectTitle: task.projectTitle ?? task.customerName ?? '—',
    customerName: task.customerName ?? null,
    siteName: task.siteName ?? null,
    milestoneId: task.milestoneId ?? null,
    milestoneTitle: task.milestoneTitle ?? null,
    assigneeName: assignment.displayName,
    assigneeEmployeeId: assignment.employeeId,
    startHour,
    endHour,
    plannedStart: task.plannedStart,
    plannedEnd: task.plannedEnd,
    derivedDurationMinutes: task.derivedDurationMinutes,
    isLocked: task.isLocked,
    isUnscheduled,
    estimatedHours: task.estimatedHours,
    priority: task.priority,
    requiredRole: task.requiredRole ?? null,
  };
}

function scheduledTaskToBar(
  task: WorkPlanScheduledTask,
  assignment: ResolvedAssignment,
  employeeId: string,
  assigneeName: string,
  localDayKey: string,
  insightMap: Map<number, TaskInsightCounts>,
  isUnscheduled: boolean,
): ScheduledTaskBar | null {
  let startHour = 0;
  let endHour = 0;

  if (!isUnscheduled) {
    if (!task.plannedStart || !task.plannedEnd) return null;
    const clamped = clampUtcIntervalToLocalDay(task.plannedStart, task.plannedEnd, localDayKey);
    if (!clamped || clamped.endHour <= clamped.startHour) return null;
    startHour = clamped.startHour;
    endHour = clamped.endHour;
  }

  const insights = buildTaskInsightCounts(task.workItemId, insightMap);

  return {
    taskId: task.workItemId,
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    workType: task.workType ?? null,
    taskCategory: task.taskCategory ?? null,
    projectId: task.projectId ?? null,
    projectTitle: task.projectTitle ?? task.customerName ?? '—',
    customerName: task.customerName ?? null,
    siteName: task.siteName ?? null,
    milestoneTitle: task.milestoneTitle ?? null,
    assigneeName,
    employeeId,
    startHour,
    endHour,
    plannedStart: task.plannedStart,
    plannedEnd: task.plannedEnd,
    derivedDurationMinutes: task.derivedDurationMinutes,
    estimatedHours: task.estimatedHours,
    priority: task.priority,
    requiredRole: task.requiredRole ?? null,
    isLocked: task.isLocked,
    isUrgent: isWorkPlanPriorityUrgent(task.priority),
    isUnscheduled,
    assignmentSource: assignment.source,
    violationCount: insights.violationCount,
    warningCount: insights.warningCount,
    suggestionCount: insights.suggestionCount,
  };
}

export function buildEmployeeDailyBars(
  schedule: WorkPlanSchedule,
  insightMap: Map<number, TaskInsightCounts>,
  options: {
    employeeFilterId?: string;
    currentUserEmployeeId?: number | null;
    scope: 'company' | 'personal' | 'employee' | 'project';
    statusFilter: string;
    taskCategoryFilter?: string;
    searchQuery?: string;
    selectedDate?: Date | null;
  },
): Array<{ employee: WorkPlanEmployee; tasks: ScheduledTaskBar[] }> {
  const searchQuery = options.searchQuery ?? '';
  const localDayKey = options.selectedDate
    ? toLocalDateKey(options.selectedDate)
    : toLocalDateKey(new Date());

  const allTasks = [
    ...schedule.scheduledTasks.map((task) => ({ task, isUnscheduled: false })),
    ...schedule.unscheduledTasks.map((task) => ({ task, isUnscheduled: true })),
  ];

  const filteredEmployees = schedule.employees.filter((employee) => {
    if (!employee.fullName || !employee.isActive) return false;

    if (options.scope === 'personal') {
      if (options.currentUserEmployeeId == null) return false;
      return employee.employeeId === options.currentUserEmployeeId;
    }

    if (options.scope === 'employee' && options.employeeFilterId) {
      return String(employee.employeeId) === options.employeeFilterId;
    }

    return true;
  });

  return filteredEmployees.map((employee) => {
    const employeeId = String(employee.employeeId);
    const tasks: ScheduledTaskBar[] = [];

    for (const { task, isUnscheduled } of allTasks) {
      if (!matchesWorkPlanStatusFilter(task.status, options.statusFilter)) continue;
      if (
        options.taskCategoryFilter &&
        options.taskCategoryFilter !== 'all' &&
        task.taskCategory !== options.taskCategoryFilter
      ) {
        continue;
      }

      const assignment = resolveFlatAssignment(task, schedule.assignments);
      if (String(assignment.employeeId ?? '').trim() !== employeeId) continue;

      if (!isUnscheduled && !taskMatchesSelectedLocalDate(task.plannedStart, task.plannedEnd, options.selectedDate)) {
        continue;
      }

      if (!matchesWorkPlanSearch(buildTaskSearchFields(task, assignment), searchQuery)) {
        continue;
      }

      const bar = scheduledTaskToBar(
        task,
        assignment,
        employeeId,
        employee.fullName,
        localDayKey,
        insightMap,
        isUnscheduled,
      );
      if (bar) tasks.push(bar);
    }

    return { employee, tasks };
  }).concat(buildUnassignedEmployeeDailyRow(
    schedule,
    allTasks,
    insightMap,
    options,
    searchQuery,
    localDayKey,
  ));
}

function buildUnassignedEmployeeDailyRow(
  schedule: WorkPlanSchedule,
  allTasks: Array<{ task: WorkPlanScheduledTask; isUnscheduled: boolean }>,
  insightMap: Map<number, TaskInsightCounts>,
  options: {
    employeeFilterId?: string;
    currentUserEmployeeId?: number | null;
    scope: 'company' | 'personal' | 'employee' | 'project';
    statusFilter: string;
    taskCategoryFilter?: string;
    searchQuery?: string;
    selectedDate?: Date | null;
  },
  searchQuery: string,
  localDayKey: string,
): Array<{ employee: WorkPlanEmployee; tasks: ScheduledTaskBar[] }> {
  if (options.scope === 'employee' && options.employeeFilterId) {
    return [];
  }

  const tasks: ScheduledTaskBar[] = [];

  for (const { task, isUnscheduled } of allTasks) {
    if (!matchesWorkPlanStatusFilter(task.status, options.statusFilter)) continue;
    if (
      options.taskCategoryFilter &&
      options.taskCategoryFilter !== 'all' &&
      task.taskCategory !== options.taskCategoryFilter
    ) {
      continue;
    }

    const assignment = resolveFlatAssignment(task, schedule.assignments);
    if (assignment.employeeId) continue;

    if (!isUnscheduled && !taskMatchesSelectedLocalDate(task.plannedStart, task.plannedEnd, options.selectedDate)) {
      continue;
    }

    if (!matchesWorkPlanSearch(buildTaskSearchFields(task, assignment), searchQuery)) {
      continue;
    }

    const bar = scheduledTaskToBar(
      task,
      assignment,
      '',
      'לא משויך',
      localDayKey,
      insightMap,
      isUnscheduled,
    );
    if (bar) tasks.push(bar);
  }

  if (tasks.length === 0) return [];

  return [{
    employee: {
      employeeId: 0,
      fullName: 'לא משויך',
      primaryRole: '',
      isAssignable: false,
      isActive: true,
    },
    tasks,
  }];
}

export function buildProjectDailyBars(
  schedule: WorkPlanSchedule,
  insightMap: Map<number, TaskInsightCounts>,
  statusFilter: string,
  taskCategoryFilter: string,
  searchQuery = '',
  selectedDate?: Date | null,
): Array<{ projectId: number | null; projectTitle: string; tasks: ScheduledTaskBar[] }> {
  const localDayKey = selectedDate ? toLocalDateKey(selectedDate) : toLocalDateKey(new Date());
  const projectMap = new Map<number | null, { projectTitle: string; tasks: ScheduledTaskBar[] }>();

  const allTasks = [
    ...schedule.scheduledTasks.map((task) => ({ task, isUnscheduled: false })),
    ...schedule.unscheduledTasks.map((task) => ({ task, isUnscheduled: true })),
  ];

  for (const { task, isUnscheduled } of allTasks) {
    if (!matchesWorkPlanStatusFilter(task.status, statusFilter)) continue;
    if (taskCategoryFilter !== 'all' && task.taskCategory !== taskCategoryFilter) continue;

    const assignment = resolveFlatAssignment(task, schedule.assignments);
    if (!matchesWorkPlanSearch(buildTaskSearchFields(task, assignment), searchQuery)) continue;

    if (!isUnscheduled && !taskMatchesSelectedLocalDate(task.plannedStart, task.plannedEnd, selectedDate)) {
      continue;
    }

    const projectId = task.projectId ?? null;
    const projectTitle = task.projectTitle ?? task.customerName ?? 'משימות ללא פרויקט';
    const bar = scheduledTaskToBar(
      task,
      assignment,
      assignment.employeeId ?? '',
      assignment.displayName,
      localDayKey,
      insightMap,
      isUnscheduled,
    );
    if (!bar) continue;

    if (!projectMap.has(projectId)) {
      projectMap.set(projectId, { projectTitle, tasks: [] });
    }
    projectMap.get(projectId)!.tasks.push(bar);
  }

  return Array.from(projectMap.entries()).map(([projectId, entry]) => ({
    projectId,
    projectTitle: entry.projectTitle,
    tasks: entry.tasks,
  }));
}

export function buildUnscheduledTaskBars(
  schedule: WorkPlanSchedule,
  insightMap: Map<number, TaskInsightCounts>,
  statusFilter: string,
  taskCategoryFilter: string,
  searchQuery = '',
): ScheduledTaskBar[] {
  const bars: ScheduledTaskBar[] = [];
  const localDayKey = toLocalDateKey(new Date());

  for (const task of schedule.unscheduledTasks) {
    if (!matchesWorkPlanStatusFilter(task.status, statusFilter)) continue;
    if (taskCategoryFilter !== 'all' && task.taskCategory !== taskCategoryFilter) continue;

    const assignment = resolveFlatAssignment(task, schedule.assignments);
    if (!matchesWorkPlanSearch(buildTaskSearchFields(task, assignment), searchQuery)) continue;

    const bar = scheduledTaskToBar(
      task,
      assignment,
      assignment.employeeId ?? '',
      assignment.displayName,
      localDayKey,
      insightMap,
      true,
    );
    if (bar) bars.push(bar);
  }

  return bars;
}

export function hourToPercent(hour: number): number {
  return (hour / 24) * 100;
}

export function hourSpanToWidth(startHour: number, endHour: number): number {
  return ((endHour - startHour) / 24) * 100;
}

export function formatHourAsTime(hour: number): string {
  const safeHour = Number.isFinite(hour) ? Math.max(0, Math.min(hour, 24)) : 0;
  const totalMinutes = Math.round(safeHour * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function buildGanttTasksFromSchedule(schedule: WorkPlanSchedule) {
  return schedule.scheduledTasks.map((task) => {
    const start = task.plannedStart ? localDateKeyFromUtc(task.plannedStart) : '';
    const end = task.plannedEnd ? localDateKeyFromUtc(task.plannedEnd) : start;
    const progress = isWorkPlanStatusDone(task.status)
      ? 100
      : isWorkPlanStatusInProgress(task.status)
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

export function findTaskInSchedule(
  schedule: WorkPlanSchedule,
  workItemId: number,
): { task: WorkPlanScheduledTask; isUnscheduled: boolean } | null {
  const scheduled = schedule.scheduledTasks.find((t) => t.workItemId === workItemId);
  if (scheduled) return { task: scheduled, isUnscheduled: false };
  const unscheduled = schedule.unscheduledTasks.find((t) => t.workItemId === workItemId);
  if (unscheduled) return { task: unscheduled, isUnscheduled: true };
  return null;
}

export function collectProjectOptions(schedule: WorkPlanSchedule): Array<{ id: number; title: string }> {
  const map = new Map<number, string>();
  for (const task of [...schedule.scheduledTasks, ...schedule.unscheduledTasks]) {
    if (task.projectId != null && task.projectId > 0 && task.projectTitle) {
      map.set(task.projectId, task.projectTitle);
    }
  }
  return Array.from(map.entries())
    .map(([id, title]) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title, 'he'));
}
