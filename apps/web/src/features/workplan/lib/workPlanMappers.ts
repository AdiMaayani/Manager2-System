import type { MappedWorkPlan, WorkPlanAssignment, WorkPlanEmployee } from '../types';

interface RawWorkPlanResponse {
  project?: {
    workItemId?: number;
    title?: string;
    status?: string;
    description?: string;
  };
  tasks?: Array<{
    workItemId?: number;
    title?: string;
    status?: string;
    workType?: string | null;
    estimatedHours?: number | null;
    priority?: string | null;
    plannedStart?: string | null;
    plannedEnd?: string | null;
    requiredRole?: string | null;
    isLocked?: boolean;
    parentWorkItemId?: number | null;
    description?: string | null;
  }>;
  assignments?: Array<{
    workItemId?: number;
    employeeId?: number | null;
    contractorId?: number | null;
    assignmentType?: string;
    assignmentRole?: string | null;
    assignedHours?: number | null;
    isManualAssignment?: boolean;
    employeeName?: string | null;
    contractorName?: string | null;
  }>;
}

interface RawEmployeeResponse {
  employeeId?: number;
  fullName?: string;
  primaryRole?: string;
  dailyCapacityHours?: number | null;
  isAssignable?: boolean;
  isActive?: boolean;
}

export function mapWorkPlanResponse(response: RawWorkPlanResponse | null): MappedWorkPlan {
  const rawProject = response?.project ?? {};
  const rawTasks = Array.isArray(response?.tasks) ? response.tasks : [];
  const rawAssignments = Array.isArray(response?.assignments) ? response.assignments : [];

  return {
    project: {
      id: rawProject.workItemId ?? 0,
      title: rawProject.title ?? '',
      status: rawProject.status ?? '',
    },
    tasks: rawTasks.map((task) => ({
      id: task.workItemId ?? 0,
      workItemId: task.workItemId ?? 0,
      title: task.title ?? '',
      description: task.description ?? null,
      status: task.status ?? '',
      workType: task.workType ?? null,
      estimatedHours: task.estimatedHours ?? null,
      priority: task.priority ?? null,
      plannedStart: task.plannedStart ?? null,
      plannedEnd: task.plannedEnd ?? null,
      requiredRole: task.requiredRole ?? null,
      isLocked: task.isLocked === true,
      parentWorkItemId: task.parentWorkItemId ?? null,
    })),
    assignments: rawAssignments.map((assignment) => ({
      workItemId: assignment.workItemId ?? 0,
      employeeId: assignment.employeeId ?? null,
      contractorId: assignment.contractorId ?? null,
      assignmentType: assignment.assignmentType ?? '',
      assignmentRole: assignment.assignmentRole ?? null,
      assignedHours: assignment.assignedHours ?? null,
      isManualAssignment: assignment.isManualAssignment === true,
      employeeName: assignment.employeeName ?? null,
      contractorName: assignment.contractorName ?? null,
    })),
  };
}

export function mapAllWorkPlansResponse(response: unknown): MappedWorkPlan[] {
  if (!Array.isArray(response)) {
    throw new Error('מבנה נתוני תוכנית העבודה מהשרת אינו תקין');
  }

  return response.map((item) => mapWorkPlanResponse(item as RawWorkPlanResponse));
}

export function mapEmployeeResponse(response: unknown): WorkPlanEmployee[] {
  if (!Array.isArray(response)) return [];
  return (response as RawEmployeeResponse[])
    .filter((employee) => employee.employeeId != null)
    .map((employee) => ({
      employeeId: employee.employeeId ?? 0,
      fullName: employee.fullName ?? '',
      primaryRole: employee.primaryRole ?? '',
      dailyCapacityHours: employee.dailyCapacityHours ?? null,
      isAssignable: employee.isAssignable !== false,
      isActive: employee.isActive !== false,
    }));
}

export function mapAssignments(workPlan: MappedWorkPlan): WorkPlanAssignment[] {
  return workPlan.assignments;
}
