export type WorkPlanScope = 'company' | 'personal' | 'employee' | 'project';
export type WorkPlanRange = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type WorkPlanProjectFilter = number | 'all';
export type WorkPlanStatusCode = 'Planned' | 'Execution' | 'Done' | 'Closed' | 'Blocked';
export type WorkPlanPriorityCode = 'Low' | 'Medium' | 'High' | 'Urgent';

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
    description?: string | null;
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
  description?: string | null;
  status: string;
  projectId: number;
  projectTitle: string;
  assigneeName: string;
  employeeId: string;
  startHour: number;
  endHour: number;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  estimatedHours?: number | null;
  priority?: string | null;
  requiredRole?: string | null;
  isLocked: boolean;
  isUrgent: boolean;
  assignmentSource: ResolvedAssignment['source'];
  violationCount: number;
  warningCount: number;
  suggestionCount: number;
}

export interface WorkPlanTaskSelection {
  taskId: number;
  title: string;
  description?: string | null;
  status: string;
  projectId: number;
  projectTitle: string;
  assigneeName: string;
  // Employee id of the resolved assignee, used for ownership checks
  // (e.g. allowing personal-scope users to edit only their own tasks).
  assigneeEmployeeId: string | null;
  startHour: number;
  endHour: number;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  isLocked: boolean;
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

// One explainability factor behind a candidate's score.
export interface RecommendationFactor {
  key: string;
  label: string;
  score?: number | null;
  weightPercent: number;
  explanation: string;
  dataSource: string;
  hasData: boolean;
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
  factors?: RecommendationFactor[];
}

// New Task draft recommendation (scored for the not-yet-saved task context).
export interface DraftRecommendationRequest {
  projectId: number;
  plannedStart: string;
  plannedEnd: string;
  estimatedHours?: number | null;
  priority?: string | null;
  requiredRole?: string | null;
  siteId?: number | null;
}

export interface DraftRecommendationCandidate {
  rankOrder?: number | null;
  employeeId: number;
  fullName?: string | null;
  primaryRole?: string | null;
  totalScore?: number | null;
  isEligible: boolean;
  exclusionReason?: string | null;
  status: string;
  recommendationSummary?: string | null;
  warnings: string[];
  factors: RecommendationFactor[];
}

export interface DraftRecommendationResponse {
  generatedAt: string;
  message: string;
  candidates: DraftRecommendationCandidate[];
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

export type NewTaskKind = 'project' | 'internal';

export interface InternalWorkContext {
  customerId: number;
  siteId: number;
  containerProjectId: number;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  status: string;
  billingType: string;
  customerId?: number;
  siteId?: number;
  parentWorkItemId?: number | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  estimatedHours?: number | null;
  priority?: string | null;
  requiredRole?: string | null;
}

export interface AssignEmployeeRequest {
  employeeId: number;
  assignmentRole: string;
}

export interface WorkItemResponse {
  workItemId: number;
  title: string;
  description?: string | null;
  workType?: string | null;
  billingType?: string | null;
  status?: string | null;
  estimatedHours?: number | null;
  priority?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  requiredRole?: string | null;
  isLocked: boolean;
  customerId: number;
  siteId: number;
  parentWorkItemId?: number | null;
  dealCloseDate?: string | null;
  financeProjectNumber?: string | null;
  invoiceNumber?: string | null;
  actualStart?: string | null;
  actualEnd?: string | null;
  actualHours?: number | null;
}

export interface UpdateTaskRequest {
  title: string;
  description?: string | null;
  status: string;
  billingType: string;
  workType?: string | null;
  customerId: number;
  siteId: number;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  estimatedHours?: number | null;
  priority?: string | null;
  requiredRole?: string | null;
  isLocked: boolean;
  // The backend PUT replaces every column via sp_UpdateWorkItem, so these
  // fields must be echoed from the loaded work item or they get wiped to NULL.
  dealCloseDate?: string | null;
  financeProjectNumber?: string | null;
  invoiceNumber?: string | null;
  actualStart?: string | null;
  actualEnd?: string | null;
  actualHours?: number | null;
}

export interface TaskInsightCounts {
  violationCount: number;
  warningCount: number;
  suggestionCount: number;
}
