import type { TaskCategory } from '@shared/constants/taskCategories';

export type WorkPlanScope = 'company' | 'personal' | 'employee' | 'project';
export type WorkPlanRange = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type WorkPlanProjectFilter = number | 'all';
export type WorkPlanStatusCode = 'Planned' | 'Execution' | 'Done' | 'Closed' | 'Blocked';
export type WorkPlanPriorityCode = 'Low' | 'Medium' | 'High' | 'Urgent';
export type WorkPlanTaskCategoryFilter = TaskCategory | 'all';

export interface WorkPlanScheduleFilters {
  scope: WorkPlanScope;
  projectId?: number | null;
  employeeId?: number | null;
  status?: string | null;
  taskCategory?: string | null;
  fromUtc: string;
  toUtc: string;
  includeUnscheduled?: boolean;
}

export interface WorkPlanScheduledTask {
  workItemId: number;
  title: string;
  description?: string | null;
  taskCategory?: string | null;
  workType?: string | null;
  status: string;
  priority?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  derivedDurationMinutes?: number | null;
  estimatedHours?: number | null;
  isLocked: boolean;
  customerId?: number | null;
  customerName?: string | null;
  siteId?: number | null;
  siteName?: string | null;
  projectId?: number | null;
  projectTitle?: string | null;
  milestoneId?: number | null;
  milestoneTitle?: string | null;
  requiredRole?: string | null;
  requiredRoles?: string[] | null;
  isServiceCall: boolean;
}

export interface WorkPlanScheduleAssignment {
  workEmployeeAssignmentId?: number | null;
  workItemId: number;
  employeeId?: number | null;
  employeeName?: string | null;
  assignmentRole?: string | null;
  assignedHours?: number | null;
  isManualAssignment: boolean;
  assignmentSource: 'Task' | 'Project';
}

export interface WorkPlanSchedule {
  scheduledTasks: WorkPlanScheduledTask[];
  unscheduledTasks: WorkPlanScheduledTask[];
  employees: WorkPlanEmployee[];
  assignments: WorkPlanScheduleAssignment[];
}

export interface WorkPlanEmployee {
  employeeId: number;
  fullName: string;
  primaryRole: string;
  professions?: string[] | null;
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
  isManualAssignment: boolean | null;
}

export interface ScheduledTaskBar {
  taskId: number;
  title: string;
  description?: string | null;
  status: string;
  workType?: string | null;
  taskCategory?: string | null;
  projectId: number | null;
  projectTitle: string;
  customerName?: string | null;
  siteName?: string | null;
  milestoneTitle?: string | null;
  assigneeName: string;
  employeeId: string;
  startHour: number;
  endHour: number;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  derivedDurationMinutes?: number | null;
  estimatedHours?: number | null;
  priority?: string | null;
  requiredRole?: string | null;
  requiredRoles?: string[] | null;
  isLocked: boolean;
  isUrgent: boolean;
  isUnscheduled: boolean;
  assignmentSource: ResolvedAssignment['source'];
  isManualAssignment?: boolean | null;
  violationCount: number;
  warningCount: number;
  suggestionCount: number;
}

export interface WorkPlanTaskSelection {
  taskId: number;
  title: string;
  description?: string | null;
  status: string;
  workType?: string | null;
  taskCategory?: string | null;
  projectId: number | null;
  projectTitle: string;
  customerName?: string | null;
  siteName?: string | null;
  milestoneId?: number | null;
  milestoneTitle?: string | null;
  assigneeName: string;
  assigneeEmployeeId: string | null;
  startHour: number;
  endHour: number;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  derivedDurationMinutes?: number | null;
  isLocked: boolean;
  isUnscheduled: boolean;
  estimatedHours?: number | null;
  priority?: string | null;
  requiredRole?: string | null;
  requiredRoles?: string[] | null;
  isManualAssignment?: boolean | null;
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
  weights?: SmartAssignmentWeights | null;
}

export interface SmartAssignmentWeights {
  professionalFit: number;
  availability: number;
  workload: number;
  geography: number;
  experience: number;
}

export interface RecommendationFactor {
  key: string;
  label: string;
  score?: number | null;
  weightPercent: number;
  weightedContribution?: number | null;
  explanation: string;
  dataSource: string;
  hasData: boolean;
  isDefaulted?: boolean;
  missingInputCodes?: string[];
  sourceValues?: Record<string, unknown>;
}

export interface SmartAssignmentRejectionReason {
  code: string;
  explanation: string;
}

export interface SmartAssignmentCandidate {
  rankOrder?: number | null;
  employeeId: number;
  fullName?: string | null;
  primaryRole?: string | null;
  professions?: string[] | null;
  requiredRoles?: string[] | null;
  matchedRoles?: string[] | null;
  missingRoles?: string[] | null;
  totalScore?: number | null;
  isEligible: boolean;
  exclusionReason?: string | null;
  status: string;
  recommendationSummary?: string | null;
  warnings: string[];
  factors: RecommendationFactor[];
  rejectionReasons: SmartAssignmentRejectionReason[];
  missingInputCodes: string[];
  policyProfileKey?: string | null;
  policyVersion?: number | null;
  policyDisplayName?: string | null;
  originTypeUsed?: string | null;
  travelMinutes?: number | null;
  distanceKm?: number | null;
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
  bestIneligibleAlternative?: SmartAssignmentCandidate | null;
  candidates?: SmartAssignmentCandidate[];
  policyProfileKey?: string | null;
  policyVersion?: number | null;
  policyDisplayName?: string | null;
  requiredRoles?: string[] | null;
}

export interface DraftRecommendationRequest {
  taskCategory: TaskCategory;
  projectId?: number | null;
  customerId?: number | null;
  siteId?: number | null;
  plannedStart: string;
  plannedEnd: string;
  priority?: string | null;
  requiredRole?: string | null;
  requiredRoles?: string[] | null;
  weights?: SmartAssignmentWeights | null;
}

export interface DraftRecommendationCandidate {
  rankOrder?: number | null;
  employeeId: number;
  fullName?: string | null;
  primaryRole?: string | null;
  professions?: string[] | null;
  requiredRoles?: string[] | null;
  matchedRoles?: string[] | null;
  missingRoles?: string[] | null;
  totalScore?: number | null;
  isEligible: boolean;
  exclusionReason?: string | null;
  status: string;
  recommendationSummary?: string | null;
  warnings: string[];
  rejectionReasonCodes: string[];
  missingInputCodes: string[];
  policyProfileKey?: string | null;
  policyVersion?: number | null;
  policyDisplayName?: string | null;
  originTypeUsed?: string | null;
  travelMinutes?: number | null;
  distanceKm?: number | null;
  factors: RecommendationFactor[];
}

export interface DraftRecommendationResponse {
  generatedAt: string;
  message: string;
  candidates: DraftRecommendationCandidate[];
}

export interface SmartAssignmentResponse {
  recommendationRunId?: number | null;
  generatedAt: string;
  summary: {
    totalTasks: number;
    tasksWithRecommendations: number;
    violationsCount: number;
    warningsCount: number;
    message: string;
  };
  taskResults: SmartAssignmentTaskResult[];
  compatibilityWarnings: string[];
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
  status?: string;
  billingType: string;
  taskCategory: TaskCategory;
  customerId?: number | null;
  siteId?: number | null;
  parentWorkItemId?: number | null;
  milestoneId?: number | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  priority?: string | null;
  requiredRole?: string | null;
  requiredRoles?: string[] | null;
}

export interface AssignEmployeeRequest {
  employeeId: number;
  assignmentRole: string;
  recommendationRunId?: number | null;
}

export interface ReplaceEmployeeAssignmentRequest {
  employeeId: number;
  recommendationRunId?: number | null;
}

export interface EmployeeAssignmentReplacementRequest {
  workEmployeeAssignmentId: number;
  employeeId: number;
}

export interface WorkItemResponse {
  workItemId: number;
  title: string;
  description?: string | null;
  workType?: string | null;
  taskCategory?: string | null;
  billingType?: string | null;
  status?: string | null;
  estimatedHours?: number | null;
  priority?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  requiredRole?: string | null;
  requiredRoles?: string[] | null;
  isLocked: boolean;
  customerId?: number | null;
  siteId?: number | null;
  parentWorkItemId?: number | null;
  milestoneId?: number | null;
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
  status?: string;
  billingType: string;
  workType?: string | null;
  taskCategory?: string | null;
  customerId?: number | null;
  siteId?: number | null;
  parentWorkItemId?: number | null;
  milestoneId?: number | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  priority?: string | null;
  requiredRole?: string | null;
  requiredRoles?: string[] | null;
  isLocked: boolean;
  dealCloseDate?: string | null;
  financeProjectNumber?: string | null;
  invoiceNumber?: string | null;
  actualStart?: string | null;
  actualEnd?: string | null;
  actualHours?: number | null;
  employeeReplacements?: EmployeeAssignmentReplacementRequest[];
}

export interface TaskInsightCounts {
  violationCount: number;
  warningCount: number;
  suggestionCount: number;
}

/** @deprecated Legacy project-centric shape — mock adapter only. */
export interface MappedWorkPlan {
  project: { id: number; title: string; status: string };
  tasks: Array<{
    id: number;
    workItemId: number;
    title: string;
    description?: string | null;
    status: string;
    workType?: string | null;
    taskCategory?: string | null;
    estimatedHours?: number | null;
    priority?: string | null;
    plannedStart?: string | null;
    plannedEnd?: string | null;
    requiredRole?: string | null;
    requiredRoles?: string[] | null;
    isLocked: boolean;
    parentWorkItemId?: number | null;
  }>;
  assignments: Array<{
    workItemId: number;
    employeeId?: number | null;
    contractorId?: number | null;
    assignmentType: string;
    assignmentRole?: string | null;
    assignedHours?: number | null;
    isManualAssignment: boolean;
    employeeName?: string | null;
    contractorName?: string | null;
  }>;
}

export interface SmartAssignmentFeedbackRequest {
  recommendationRunId: number;
  workItemId: number;
  recommendedEmployeeId: number;
  policyProfileKey: string;
  policyVersion: number;
  rating: number;
  comment?: string | null;
}

export interface SmartAssignmentFeedbackRecord extends SmartAssignmentFeedbackRequest {
  feedbackId?: number | null;
  actingUserId?: number | null;
  createdAtUtc?: string | null;
  updatedAtUtc?: string | null;
  wasCreated?: boolean;
  wasChanged?: boolean;
}

export type SmartAssignmentAssignmentMethod = 'SmartAssignment' | 'Manual';

export interface SmartAssignmentAssignmentRecommendationFactor {
  key: string;
  label: string;
  score: number | null;
  weightPercent: number | null;
  weightedContribution: number | null;
  isTieBreaker: boolean;
}

export interface SmartAssignmentAssignmentRecommendation {
  recommendationId: number;
  recommendationRunId: number;
  rankOrder: number;
  totalScore: number;
  policyProfileKey?: string | null;
  policyDisplayName?: string | null;
  policyVersion?: number | null;
  travelMinutes?: number | null;
  distanceKm?: number | null;
  factors: SmartAssignmentAssignmentRecommendationFactor[];
}

export interface SmartAssignmentAssignmentFeedback {
  workItemId: number;
  assignedEmployeeId: number;
  assignedEmployeeName?: string | null;
  isManualAssignment: boolean;
  assignmentMethod: SmartAssignmentAssignmentMethod;
  recommendationRunId?: number | null;
  policyProfileKey?: string | null;
  policyVersion?: number | null;
  rankOrder?: number | null;
  score?: number | null;
  recommendation?: SmartAssignmentAssignmentRecommendation | null;
  feedback?: SmartAssignmentFeedbackRecord | null;
}
