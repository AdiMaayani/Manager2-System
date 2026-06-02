export interface ProjectListItem {
  workItemId: number;
  projectNumber: string;
  title: string;
  customerName: string;
  projectManagerName: string;
  status: string;
  createdAt: string;
  siteName: string;
  billingType: string;
  dealCloseDate?: string;
  financeProjectNumber?: string;
  invoiceNumber?: string;
}

export interface ProjectLifecycleProject {
  workItemId: number;
  title: string;
  description?: string;
  status: string;
  billingType?: string;
  customerId: number;
  customerName?: string;
  siteId?: number;
  siteName?: string;
  createdAt: string;
  closedAt?: string;
  dealCloseDate?: string;
  financeProjectNumber?: string;
  invoiceNumber?: string;
}

export interface ProjectLifecycleMilestone {
  workItemId: number;
  title: string;
  description?: string;
  status: string;
  billingType?: string;
  createdAt: string;
  plannedStart?: string;
  plannedEnd?: string;
  closedAt?: string;
  estimatedHours?: number;
  priority?: string;
  requiredRole?: string;
  isLocked: boolean;
}

export interface ProjectLifecycleAssignment {
  workItemId: number;
  employeeId?: number;
  contractorId?: number;
  assignmentType: string;
  assignmentRole?: string;
  assignedHours?: number;
  isManualAssignment: boolean;
  employeeName?: string;
  contractorName?: string;
}

export interface ProjectLifecycleReport {
  workReportId: number;
  workItemId?: number;
  reportType?: string;
  reportDate?: string;
  summary?: string;
  notes?: string;
  reporterName?: string;
  status?: string;
  followUpRequired: boolean;
}

export interface ProjectLifecycleSummary {
  totalMilestones: number;
  openMilestones: number;
  closedMilestones: number;
  lockedMilestones: number;
  cancelledMilestones: number;
  delayedMilestones: number;
  invalidScheduleMilestones: number;
  upcomingMilestones: number;
  riskLevel: string;
  healthStatus: string;
  riskReason: string;
  progressPercent: number;
  totalReports: number;
  hasFollowUps: boolean;
}

export interface ProjectLifecycle {
  project: ProjectLifecycleProject;
  milestones: ProjectLifecycleMilestone[];
  assignments: ProjectLifecycleAssignment[];
  reports: ProjectLifecycleReport[];
  summary: ProjectLifecycleSummary;
}

export interface ProjectMilestoneEmployee {
  employeeId: number;
  employeeName: string;
  assignmentRole?: string;
}

export interface ProjectMilestoneContractor {
  contractorId: number;
  contractorName: string;
  assignmentRole?: string;
}

export interface ProjectMilestone {
  workItemId: number;
  title: string;
  description?: string;
  workType: string;
  status: string;
  billingType?: string;
  customerId: number;
  siteId?: number;
  createdAt: string;
  plannedStart?: string;
  plannedEnd?: string;
  closedAt?: string;
  priority?: string;
  requiredRole?: string;
  estimatedHours?: number;
  actualStart?: string;
  actualEnd?: string;
  actualHours?: number;
  isLocked: boolean;
  employees: ProjectMilestoneEmployee[];
  contractors: ProjectMilestoneContractor[];
}

export interface CreateProjectRequest {
  title: string;
  description?: string;
  status: string;
  billingType: string;
  customerId: number;
  siteId: number;
  dealCloseDate?: string;
  financeProjectNumber?: string;
  invoiceNumber?: string;
}

export interface UpdateProjectRequest {
  workItemId: number;
  title: string;
  description?: string;
  workType: string;
  billingType: string;
  status: string;
  customerId: number;
  siteId: number;
  createdAt: string;
  closedAt?: string | null;
  parentWorkItemId?: number | null;
  dealCloseDate?: string | null;
  financeProjectNumber?: string;
  invoiceNumber?: string;
}

export interface CreateMilestoneEmployeeAssignment {
  employeeId: number;
  assignmentRole: string;
}

export interface CreateMilestoneContractorAssignment {
  contractorId: number;
  assignmentRole: string;
}

export interface CreateMilestoneRequest {
  title: string;
  description?: string;
  status: string;
  billingType: string;
  customerId: number;
  siteId: number;
  plannedStart?: string;
  plannedEnd?: string;
  estimatedHours?: number;
  actualStart?: string;
  actualEnd?: string;
  actualHours?: number;
  priority?: string;
  requiredRole?: string;
  isLocked: boolean;
  employees: CreateMilestoneEmployeeAssignment[];
  contractors: CreateMilestoneContractorAssignment[];
}

export type UpdateMilestoneRequest = CreateMilestoneRequest;

export interface Site {
  siteId: number;
  customerId: number;
  siteName: string;
  addressLine?: string;
  city?: string;
  isPrimary: boolean;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateSiteRequest {
  customerId: number;
  siteName: string;
  addressLine?: string;
  city?: string;
  isPrimary?: boolean;
  notes?: string;
}

export interface ProjectBoqRow {
  id: string;
  system?: string;
  item: string;
  quantity: string;
  unit: string;
}

export interface ProjectDrawing {
  id: string;
  name: string;
  type: 'PDF' | 'DWG';
  date: string;
  note?: string;
}

export interface ProjectEquipmentItem {
  projectEquipmentItemId: number;
  projectId: number;
  name: string;
  status: string;
  location: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateProjectEquipmentItemRequest {
  equipmentName: string;
  status: string;
  location?: string;
  sortOrder?: number;
}

export interface UpdateProjectEquipmentItemRequest {
  equipmentName: string;
  status: string;
  location?: string;
  sortOrder: number;
}

export interface ReorderProjectEquipmentItemRequest {
  projectEquipmentItemId: number;
  sortOrder: number;
}

export interface ReorderProjectEquipmentRequest {
  items: ReorderProjectEquipmentItemRequest[];
}

export interface ProjectOverviewForm {
  title: string;
  description: string;
  status: string;
  billingType: string;
  customerId: number;
  siteId: number;
  dealCloseDate: string;
  financeProjectNumber: string;
  invoiceNumber: string;
}

export interface ProjectMilestoneForm {
  title: string;
  description: string;
  status: string;
  billingType: string;
  plannedStart: string;
  plannedEnd: string;
  estimatedHours: string;
  actualStart: string;
  actualEnd: string;
  actualHours: string;
  priority: string;
  requiredRole: string;
  isLocked: boolean;
  employees: CreateMilestoneEmployeeAssignment[];
  contractors: CreateMilestoneContractorAssignment[];
}

export interface ProjectTeamForm {
  projectManagerEmployeeId: number | null;
  teamEmployeeIds: number[];
}

export interface SyncProjectEmployeeAssignmentsRequest {
  employees: CreateMilestoneEmployeeAssignment[];
}

export interface ProjectEmployeeOption {
  employeeId: number;
  fullName: string;
  primaryRole?: string;
  isActive?: boolean;
}

export type ProjectDrawerMode = 'view' | 'create';

export type ProjectDrawerTabId =
  | 'overview'
  | 'milestones'
  | 'quote'
  | 'boq'
  | 'drawings'
  | 'equipment';

export interface ProjectDrawerState {
  projectId: number | null;
  mode: ProjectDrawerMode;
  initialTab?: ProjectDrawerTabId;
}
