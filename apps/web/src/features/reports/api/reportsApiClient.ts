import { apiRequest } from '@api/client';
import type { WorkReportListItem } from '../types';

export function getReportsAsync(): Promise<WorkReportListItem[]> {
  return apiRequest<WorkReportListItem[]>('/Reports');
}

export function getReportByIdAsync(id: number): Promise<WorkReportListItem> {
  return apiRequest<WorkReportListItem>(`/Reports/${id}`);
}
