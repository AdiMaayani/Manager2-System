import type {
  WorkPlanEmployee,
  WorkPlanSchedule,
  WorkPlanScheduleAssignment,
  WorkPlanScheduledTask,
} from '../types';

interface RawScheduledTask {
  workItemId?: number;
  title?: string;
  description?: string | null;
  taskCategory?: string | null;
  workType?: string | null;
  status?: string;
  priority?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  derivedDurationMinutes?: number | null;
  estimatedHours?: number | null;
  isLocked?: boolean;
  customerId?: number | null;
  customerName?: string | null;
  siteId?: number | null;
  siteName?: string | null;
  projectId?: number | null;
  projectTitle?: string | null;
  milestoneId?: number | null;
  milestoneTitle?: string | null;
  requiredRole?: string | null;
  isServiceCall?: boolean;
  assignments?: RawAssignment[];
}

interface RawAssignment {
  workItemId?: number;
  employeeId?: number | null;
  employeeName?: string | null;
  assignmentRole?: string | null;
  assignedHours?: number | null;
  isManualAssignment?: boolean;
  assignmentSource?: string | null;
}

interface RawEmployee {
  employeeId?: number;
  fullName?: string;
  primaryRole?: string;
  dailyCapacityHours?: number | null;
  isAssignable?: boolean;
  isActive?: boolean;
}

interface RawWorkPlanScheduleResponse {
  scheduledTasks?: RawScheduledTask[];
  unscheduledTasks?: RawScheduledTask[];
  employees?: RawEmployee[];
  assignments?: RawAssignment[];
}

function mapScheduledTask(raw: RawScheduledTask): WorkPlanScheduledTask {
  return {
    workItemId: raw.workItemId ?? 0,
    title: raw.title ?? '',
    description: raw.description ?? null,
    taskCategory: raw.taskCategory ?? null,
    workType: raw.workType ?? null,
    status: raw.status ?? '',
    priority: raw.priority ?? null,
    plannedStart: raw.plannedStart ?? null,
    plannedEnd: raw.plannedEnd ?? null,
    derivedDurationMinutes: raw.derivedDurationMinutes ?? null,
    estimatedHours: raw.estimatedHours ?? null,
    isLocked: raw.isLocked === true,
    customerId: raw.customerId ?? null,
    customerName: raw.customerName ?? null,
    siteId: raw.siteId ?? null,
    siteName: raw.siteName ?? null,
    projectId: raw.projectId ?? null,
    projectTitle: raw.projectTitle ?? null,
    milestoneId: raw.milestoneId ?? null,
    milestoneTitle: raw.milestoneTitle ?? null,
    requiredRole: raw.requiredRole ?? null,
    isServiceCall: raw.isServiceCall === true,
  };
}

function mapAssignment(raw: RawAssignment): WorkPlanScheduleAssignment {
  const source = String(raw.assignmentSource ?? 'Task');
  return {
    workItemId: raw.workItemId ?? 0,
    employeeId: raw.employeeId ?? null,
    employeeName: raw.employeeName ?? null,
    assignmentRole: raw.assignmentRole ?? null,
    assignedHours: raw.assignedHours ?? null,
    isManualAssignment: raw.isManualAssignment === true,
    assignmentSource: source === 'Project' ? 'Project' : 'Task',
  };
}

function mapEmployee(raw: RawEmployee): WorkPlanEmployee {
  return {
    employeeId: raw.employeeId ?? 0,
    fullName: raw.fullName ?? '',
    primaryRole: raw.primaryRole ?? '',
    dailyCapacityHours: raw.dailyCapacityHours ?? null,
    isAssignable: raw.isAssignable !== false,
    isActive: raw.isActive !== false,
  };
}

function flattenScheduleAssignments(
  scheduledTasks: RawScheduledTask[],
  unscheduledTasks: RawScheduledTask[],
  topLevelAssignments: RawAssignment[] = [],
): WorkPlanScheduleAssignment[] {
  const byKey = new Map<string, WorkPlanScheduleAssignment>();

  const addAssignment = (raw: RawAssignment, fallbackWorkItemId?: number) => {
    const workItemId = raw.workItemId ?? fallbackWorkItemId ?? 0;
    if (workItemId <= 0) return;
    const source = String(raw.assignmentSource ?? 'Task');
    const employeeId = raw.employeeId ?? null;
    const key = `${workItemId}:${employeeId ?? 'none'}:${source}`;
    byKey.set(
      key,
      mapAssignment({
        ...raw,
        workItemId,
        assignmentSource: source,
      }),
    );
  };

  for (const task of [...scheduledTasks, ...unscheduledTasks]) {
    for (const assignment of task.assignments ?? []) {
      addAssignment(assignment, task.workItemId);
    }
  }

  for (const assignment of topLevelAssignments) {
    addAssignment(assignment);
  }

  return Array.from(byKey.values());
}

export function mapWorkPlanSchedule(response: unknown): WorkPlanSchedule {
  if (!response || typeof response !== 'object') {
    throw new Error('מבנה נתוני תוכנית העבודה מהשרת אינו תקין');
  }

  const raw = response as RawWorkPlanScheduleResponse;
  const scheduledTasks = Array.isArray(raw.scheduledTasks)
    ? raw.scheduledTasks.map(mapScheduledTask)
    : [];
  const unscheduledTasks = Array.isArray(raw.unscheduledTasks)
    ? raw.unscheduledTasks.map(mapScheduledTask)
    : [];
  const employees = Array.isArray(raw.employees) ? raw.employees.map(mapEmployee) : [];
  const assignments = flattenScheduleAssignments(
    Array.isArray(raw.scheduledTasks) ? raw.scheduledTasks : [],
    Array.isArray(raw.unscheduledTasks) ? raw.unscheduledTasks : [],
    Array.isArray(raw.assignments) ? raw.assignments : [],
  );

  return { scheduledTasks, unscheduledTasks, employees, assignments };
}
