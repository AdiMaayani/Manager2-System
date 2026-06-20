import { apiBlobRequest, apiRequest } from '@api/client';
import type { ListSelectOption } from '@shared/components/ListSelect';
import type {
  CreateWorkReportRequest,
  CreateWorkReportResponse,
  InventorySkuLookupResult,
  ReportEmployeeOption,
  ReportProjectOption,
  ReportServiceCallOption,
  WorkItemReportTarget,
  ReverseWorkReportRequest,
  WorkReportAttachment,
  WorkReportDetails,
  WorkReportDetailsResponse,
  WorkReportInventoryLine,
  WorkReportListItem,
  WorkReportListItemResponse,
} from '../types';

function mapInventoryLine(raw: Record<string, unknown>): WorkReportInventoryLine {
  return {
    workReportInventoryItemId: Number(raw.workReportInventoryItemId),
    inventoryItemId: Number(raw.inventoryItemId),
    quantity: Number(raw.quantity),
    usageType: String(raw.usageType) as WorkReportInventoryLine['usageType'],
    skuSnapshot: raw.skuSnapshot as string | null,
    itemNameSnapshot: raw.itemNameSnapshot as string | null,
  };
}

function mapAttachment(raw: Record<string, unknown>): WorkReportAttachment {
  return {
    workReportAttachmentId: Number(raw.workReportAttachmentId),
    mediaType: String(raw.mediaType ?? ''),
    originalFileName: String(raw.originalFileName ?? ''),
    contentType: raw.contentType as string | null,
    fileSizeBytes: raw.fileSizeBytes != null ? Number(raw.fileSizeBytes) : null,
    uploadedAt: raw.uploadedAt as string | null,
  };
}

function mapWorkReportListItem(response: WorkReportListItemResponse): WorkReportListItem {
  return {
    reportId: response.workReportId,
    projectTitle: response.projectName,
    reportDate: response.reportDate,
    status: response.status,
    lifecycleStatus: response.lifecycleStatus,
    reportedByName: response.reporterName,
    customerName: response.customerName,
    followUpRequired: response.followUpRequired,
  };
}

function mapWorkReportDetails(response: WorkReportDetailsResponse): WorkReportDetails {
  return {
    reportId: response.workReportId,
    reportType: response.reportType,
    reportDate: response.reportDate,
    projectId: response.projectId,
    projectTitle: response.projectName,
    customerName: response.customerName,
    serviceCallId: response.serviceCallId,
    serviceCallTitle: response.serviceCallTitle,
    site: response.site,
    start: response.start,
    end: response.end,
    summary: response.summary,
    notes: response.notes,
    reporterId: response.reporterId,
    reportedByName: response.reporterName,
    role: response.role,
    status: response.status,
    lifecycleStatus: response.lifecycleStatus,
    finalizedAt: response.finalizedAt,
    reversedAt: response.reversedAt,
    reversalReason: response.reversalReason,
    amendsWorkReportId: response.amendsWorkReportId,
    followUpRequired: response.followup,
    followUpReason: response.followupReason,
    systems: response.systems ?? [],
    relatedWorkers: response.relatedWorkers ?? [],
    inventoryLines: (response.inventoryLines ?? []).map((line) =>
      mapInventoryLine(line as unknown as Record<string, unknown>),
    ),
    attachments: (response.attachments ?? []).map((a) =>
      mapAttachment(a as unknown as Record<string, unknown>),
    ),
  };
}

export async function getReportsAsync(): Promise<WorkReportListItem[]> {
  const reports = await apiRequest<WorkReportListItemResponse[]>('/Reports');
  return reports.map(mapWorkReportListItem);
}

export async function getReportByIdAsync(id: number): Promise<WorkReportDetails> {
  const report = await apiRequest<WorkReportDetailsResponse>(`/Reports/${id}`);
  return mapWorkReportDetails(report);
}

export const REPORT_TARGETS_QUERY_KEY = ['workItems', 'reportTargets'] as const;

function formatReportTargetDatePart(value?: string | null): string | null {
  if (!value) return null;
  return value.split('T')[0];
}

export function formatReportTargetLabel(target: WorkItemReportTarget): string {
  const parts: string[] = [target.title];

  if (target.taskCategory === 'Regular') {
    const plannedDate = formatReportTargetDatePart(target.plannedStart);
    if (plannedDate) parts.push(plannedDate);
    if (target.assigneeName) parts.push(target.assigneeName);
  } else if (target.taskCategory === 'Project') {
    if (target.projectTitle) {
      parts.push(target.projectTitle);
    } else if (target.projectId != null) {
      parts.push(`פרויקט #${target.projectId}`);
    }
  } else if (target.taskCategory === 'ServiceCall') {
    const location = [target.customerName, target.siteName].filter(Boolean).join(' · ');
    if (location) parts.push(location);
  }

  return parts.join(' · ');
}

export function formatReportTargetDescription(
  target: WorkItemReportTarget,
): string | undefined {
  if (target.taskCategory === 'Regular') {
    const parts = [
      formatReportTargetDatePart(target.plannedStart),
      target.assigneeName,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : undefined;
  }

  if (target.taskCategory === 'Project') {
    if (target.projectTitle) return target.projectTitle;
    if (target.projectId != null) return `פרויקט #${target.projectId}`;
    return undefined;
  }

  if (target.taskCategory === 'ServiceCall') {
    const location = [target.customerName, target.siteName].filter(Boolean).join(' · ');
    return location || undefined;
  }

  return undefined;
}

export function buildReportTargetListOption(
  target: WorkItemReportTarget,
): ListSelectOption {
  return {
    value: String(target.workItemId),
    label: target.title,
    description: formatReportTargetDescription(target),
    searchText: formatReportTargetLabel(target),
  };
}

export function filterReportTargetsByType(
  targets: WorkItemReportTarget[],
  reportTargetType: 'regular' | 'project' | 'service_call',
): WorkItemReportTarget[] {
  const categoryByType = {
    regular: 'Regular',
    project: 'Project',
    service_call: 'ServiceCall',
  } as const;

  return targets.filter((target) => target.taskCategory === categoryByType[reportTargetType]);
}

export function getReportTargetsAsync(): Promise<WorkItemReportTarget[]> {
  return apiRequest<WorkItemReportTarget[]>('/WorkItems/report-targets');
}

export function getReportProjectsAsync(): Promise<ReportProjectOption[]> {
  return apiRequest<ReportProjectOption[]>('/WorkItems/projects-list');
}

export function getReportServiceCallsAsync(): Promise<ReportServiceCallOption[]> {
  return apiRequest<ReportServiceCallOption[]>('/ServiceCalls');
}

export function getReportEmployeesAsync(): Promise<ReportEmployeeOption[]> {
  return apiRequest<ReportEmployeeOption[]>('/Employees/lookup');
}

export function createWorkReportAsync(
  request: CreateWorkReportRequest,
): Promise<CreateWorkReportResponse> {
  return apiRequest<CreateWorkReportResponse>('/Reports', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function updateWorkReportAsync(
  id: number,
  request: CreateWorkReportRequest,
): Promise<WorkReportDetails> {
  return apiRequest<WorkReportDetailsResponse>(`/Reports/${id}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  }).then(mapWorkReportDetails);
}

export function deleteWorkReportAsync(id: number): Promise<void> {
  return apiRequest<void>(`/Reports/${id}`, { method: 'DELETE' });
}

export function finalizeWorkReportAsync(id: number): Promise<WorkReportDetails> {
  return apiRequest<WorkReportDetailsResponse>(`/Reports/${id}/finalize`, {
    method: 'POST',
  }).then(mapWorkReportDetails);
}

export function reverseWorkReportAsync(
  id: number,
  request: ReverseWorkReportRequest,
): Promise<WorkReportDetails> {
  return apiRequest<WorkReportDetailsResponse>(`/Reports/${id}/reverse`, {
    method: 'POST',
    body: JSON.stringify(request),
  }).then(mapWorkReportDetails);
}

export function amendWorkReportAsync(id: number): Promise<WorkReportDetails> {
  return apiRequest<WorkReportDetailsResponse>(`/Reports/${id}/amend`, {
    method: 'POST',
  }).then(mapWorkReportDetails);
}

export function getInventoryBySkuAsync(sku: string): Promise<InventorySkuLookupResult> {
  const normalized = encodeURIComponent(sku.trim());
  return apiRequest<InventorySkuLookupResult>(`/Inventory/by-sku/${normalized}`);
}

export function addReportInventoryLineAsync(
  reportId: number,
  body: { inventoryItemId: number; quantity: number; usageType: string },
): Promise<WorkReportInventoryLine> {
  return apiRequest<WorkReportInventoryLine>(`/Reports/${reportId}/inventory`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function deleteReportInventoryLineAsync(
  reportId: number,
  lineId: number,
): Promise<void> {
  return apiRequest<void>(`/Reports/${reportId}/inventory/${lineId}`, {
    method: 'DELETE',
  });
}

export function uploadReportAttachmentAsync(reportId: number, file: File): Promise<WorkReportAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest<WorkReportAttachment>(`/Reports/${reportId}/attachments`, {
    method: 'POST',
    body: formData,
  });
}

export function deleteReportAttachmentAsync(reportId: number, attachmentId: number): Promise<void> {
  return apiRequest<void>(`/Reports/${reportId}/attachments/${attachmentId}`, {
    method: 'DELETE',
  });
}

export function getReportAttachmentBlobAsync(reportId: number, attachmentId: number): Promise<Blob> {
  return apiBlobRequest(`/Reports/${reportId}/attachments/${attachmentId}/file`);
}

export const REPORTS_INVALIDATION = {
  list: ['reports'] as const,
  detail: (id: number) => ['reports', 'detail', id] as const,
  inventory: ['inventoryItems'] as const,
};
