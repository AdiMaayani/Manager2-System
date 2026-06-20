import type { InventoryUsageType } from '@shared/constants/inventoryUsageTypes';
import type { ReportLifecycleStatus } from '@shared/constants/reportLifecycle';

export interface WorkReportListItemResponse {
  workReportId: number;
  reportDate?: string;
  projectName?: string;
  customerName?: string;
  reporterName?: string;
  status?: string;
  lifecycleStatus?: string;
  followUpRequired?: boolean;
}

export interface WorkReportListItem {
  reportId: number;
  workItemId?: number;
  projectTitle?: string;
  reportDate?: string;
  status?: string;
  lifecycleStatus?: ReportLifecycleStatus | string;
  reportedByName?: string;
  customerName?: string;
  followUpRequired?: boolean;
  [key: string]: unknown;
}

export interface WorkItemReportTarget {
  workItemId: number;
  title: string;
  taskCategory: string;
  customerId?: number | null;
  siteId?: number | null;
  projectId?: number | null;
  plannedStart?: string | null;
  assigneeName?: string | null;
  customerName?: string | null;
  siteName?: string | null;
  projectTitle?: string | null;
}

export interface ReportProjectOption {
  workItemId: number;
  title: string;
  customerName?: string;
  siteName?: string;
}

export interface ReportServiceCallOption {
  workItemId: number;
  title: string;
  customerName?: string | null;
  siteName?: string | null;
  status?: string | null;
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

export interface WorkReportInventoryLine {
  workReportInventoryItemId: number;
  inventoryItemId: number;
  quantity: number;
  usageType: InventoryUsageType;
  skuSnapshot?: string | null;
  itemNameSnapshot?: string | null;
}

export interface WorkReportAttachment {
  workReportAttachmentId: number;
  mediaType: string;
  originalFileName: string;
  contentType?: string | null;
  fileSizeBytes?: number | null;
  uploadedAt?: string | null;
}

export interface CreateWorkReportRequest {
  reportType?: string | null;
  date?: string | null;
  workItemId?: number | null;
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
  inventoryLines?: Array<{
    inventoryItemId: number;
    quantity: number;
    usageType: InventoryUsageType;
  }>;
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
  lifecycleStatus?: string | null;
  finalizedAt?: string | null;
  reversedAt?: string | null;
  reversalReason?: string | null;
  amendsWorkReportId?: number | null;
  followup?: boolean;
  followupReason?: string | null;
  systems?: string[];
  relatedWorkers?: WorkReportRelatedWorker[];
  inventoryLines?: WorkReportInventoryLine[];
  attachments?: WorkReportAttachment[];
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
  lifecycleStatus?: ReportLifecycleStatus | string | null;
  finalizedAt?: string | null;
  reversedAt?: string | null;
  reversalReason?: string | null;
  amendsWorkReportId?: number | null;
  followUpRequired?: boolean;
  followUpReason?: string | null;
  systems: string[];
  relatedWorkers: WorkReportRelatedWorker[];
  inventoryLines: WorkReportInventoryLine[];
  attachments: WorkReportAttachment[];
}

export interface InventorySkuLookupResult {
  inventoryItemId: number;
  skuCode: string;
  itemName: string;
  quantityOnHand: number;
  unit: string;
  category?: string | null;
}

export interface ReverseWorkReportRequest {
  reason: string;
}
