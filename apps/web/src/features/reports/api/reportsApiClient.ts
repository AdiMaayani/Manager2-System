import { apiRequest } from '@api/client';
import type {
  CreateWorkReportRequest,
  CreateWorkReportResponse,
  ReportEmployeeOption,
  ReportProjectOption,
  ReportServiceCallOption,
  WorkReportDetails,
  WorkReportDetailsResponse,
  WorkReportListItem,
  WorkReportListItemResponse,
} from '../types';

function mapWorkReportListItem(response: WorkReportListItemResponse): WorkReportListItem {
  return {
    reportId: response.workReportId,
    projectTitle: response.projectName,
    reportDate: response.reportDate,
    status: response.status,
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
    followUpRequired: response.followup,
    followUpReason: response.followupReason,
    systems: response.systems ?? [],
    relatedWorkers: response.relatedWorkers ?? [],
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

export function getReportProjectsAsync(): Promise<ReportProjectOption[]> {
  return apiRequest<ReportProjectOption[]>('/WorkItems/projects-list');
}

export function getReportServiceCallsAsync(): Promise<ReportServiceCallOption[]> {
  return apiRequest<ReportServiceCallOption[]>('/ServiceCalls');
}

export function getReportEmployeesAsync(): Promise<ReportEmployeeOption[]> {
  return apiRequest<ReportEmployeeOption[]>('/Employees');
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
