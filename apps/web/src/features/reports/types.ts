export interface WorkReportListItemResponse {
  workReportId: number;
  reportDate?: string;
  projectName?: string;
  customerName?: string;
  reporterName?: string;
  status?: string;
  followUpRequired?: boolean;
}

export interface WorkReportListItem {
  reportId: number;
  workItemId?: number;
  projectTitle?: string;
  reportDate?: string;
  status?: string;
  reportedByName?: string;
  customerName?: string;
  followUpRequired?: boolean;
  [key: string]: unknown;
}

export interface ReportProjectOption {
  workItemId: number;
  title: string;
  customerName?: string;
  siteName?: string;
}

export interface ReportEmployeeOption {
  employeeId: number;
  fullName: string;
  primaryRole?: string;
  isActive?: boolean;
}

export interface WorkReportRelatedWorker {
  id?: number | null;
  name?: string | null;
}

export interface CreateWorkReportRequest {
  reportType?: string | null;
  date?: string | null;
  projectId?: number | null;
  projectName?: string | null;
  customerName?: string | null;
  serviceCallId?: number | null;
  serviceCallTitle?: string | null;
  site?: string | null;
  start?: string | null;
  end?: string | null;
  summary?: string | null;
  notes?: string | null;
  reporterId?: number | null;
  reporterName?: string | null;
  role?: string | null;
  status?: string | null;
  systems: string[];
  relatedWorkers: WorkReportRelatedWorker[];
  followup: boolean;
  followupReason?: string | null;
}

export interface CreateWorkReportResponse {
  message: string;
  workReportId: number;
}

export interface WorkReportDetailsResponse {
  workReportId: number;
  reportType?: string | null;
  reportDate?: string | null;
  projectId?: number | null;
  projectName?: string | null;
  customerName?: string | null;
  serviceCallId?: number | null;
  serviceCallTitle?: string | null;
  site?: string | null;
  start?: string | null;
  end?: string | null;
  summary?: string | null;
  notes?: string | null;
  reporterId?: number | null;
  reporterName?: string | null;
  role?: string | null;
  status?: string | null;
  followup?: boolean;
  followupReason?: string | null;
  systems?: string[];
  relatedWorkers?: WorkReportRelatedWorker[];
}

export interface WorkReportDetails {
  reportId: number;
  reportType?: string | null;
  reportDate?: string | null;
  projectId?: number | null;
  projectTitle?: string | null;
  customerName?: string | null;
  serviceCallId?: number | null;
  serviceCallTitle?: string | null;
  site?: string | null;
  start?: string | null;
  end?: string | null;
  summary?: string | null;
  notes?: string | null;
  reporterId?: number | null;
  reportedByName?: string | null;
  role?: string | null;
  status?: string | null;
  followUpRequired?: boolean;
  followUpReason?: string | null;
  systems: string[];
  relatedWorkers: WorkReportRelatedWorker[];
}
