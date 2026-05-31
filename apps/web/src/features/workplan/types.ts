export type WorkPlanScope = 'company' | 'personal' | 'employee' | 'project';
export type WorkPlanRange = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type WorkPlanProjectFilter = number | 'all';

export interface WorkPlanProjectSummary {
  workItemId: number;
  title: string;
  description?: string | null;
  status: string;
  workType?: string;
}

export interface WorkPlanTaskSummary {
  workItemId: number;
  title: string;
  description?: string | null;
  status: string;
  estimatedHours?: number | null;
  priority?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  requiredRole?: string | null;
  isLocked: boolean;
  parentWorkItemId?: number | null;
}

export interface WorkPlanAssignment {
  workItemId: number;
  employeeId?: number | null;
  contractorId?: number | null;
  assignmentType: string;
  assignmentRole?: string | null;
  assignedHours?: number | null;
  isManualAssignment: boolean;
  employeeName?: string | null;
  contractorName?: string | null;
}

export interface MappedWorkPlan {
  project: {
    id: number;
    title: string;
    status: string;
  };
  tasks: Array<{
    id: number;
    workItemId: number;
    title: string;
    status: string;
    estimatedHours?: number | null;
    priority?: string | null;
    plannedStart?: string | null;
    plannedEnd?: string | null;
    requiredRole?: string | null;
    isLocked: boolean;
    parentWorkItemId?: number | null;
  }>;
  assignments: WorkPlanAssignment[];
}

export interface WorkPlanEmployee {
  employeeId: number;
  fullName: string;
  primaryRole: string;
  dailyCapacityHours?: number | null;
  isAssignable: boolean;
  isActive: boolean;
}

export interface ResolvedAssignment {
  displayName: string;
  source: 'task' | 'project' | 'none';
  type: 'employee' | 'contractor' | null;
  employeeId: string | null;
  contractorId: string | null;
  role: string;
}

export interface ScheduledTaskBar {
  taskId: number;
  title: string;
  status: string;
  projectId: number;
  projectTitle: string;
  assigneeName: string;
  employeeId: string;
  startHour: number;
  endHour: number;
  isLocked: boolean;
  isPersonal: boolean;
  assignmentSource: ResolvedAssignment['source'];
  violationCount: number;
  warningCount: number;
  suggestionCount: number;
}

export interface WorkPlanTaskSelection {
  taskId: number;
  title: string;
  status: string;
  projectId: number;
  projectTitle: string;
  assigneeName: string;
  startHour: number;
  endHour: number;
  isLocked: boolean;
  isPersonal: boolean;
  estimatedHours?: number | null;
  priority?: string | null;
  requiredRole?: string | null;
}

export interface GanttTask {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
}

export interface SmartAssignmentRequest {
  projectId?: number | null;
  workItemIds?: number[] | null;
  planningDate?: string | null;
  includeLockedTasks?: boolean;
  saveRun?: boolean;
}

export interface SmartAssignmentTaskResult {
  workItemId: number;
  taskTitle: string;
  currentEmployeeId?: number | null;
  currentEmployeeName?: string | null;
  recommendedEmployeeId?: number | null;
  recommendedEmployeeName?: string | null;
  score: number;
  violations: string[];
  warnings: string[];
  reasons: string[];
}

export interface SmartAssignmentResponse {
  summary: {
    totalTasks: number;
    tasksWithRecommendations: number;
    violationsCount: number;
    warningsCount: number;
    message: string;
  };
  taskResults: SmartAssignmentTaskResult[];
  employeeLoad: Array<{
    employeeId: number;
    employeeName: string;
    assignedHours: number;
    capacityHours?: number | null;
    loadPercentage: number;
  }>;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  status: string;
  billingType: string;
  customerId?: number;
  siteId?: number;
  parentWorkItemId?: number | null;
}

export interface AssignEmployeeRequest {
  employeeId: number;
  assignmentRole: string;
}

export interface TaskInsightCounts {
  violationCount: number;
  warningCount: number;
  suggestionCount: number;
}
