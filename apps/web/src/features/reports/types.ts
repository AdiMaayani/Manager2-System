export interface WorkReportListItem {
  reportId: number;
  workItemId: number;
  projectTitle?: string;
  reportDate?: string;
  status?: string;
  reportedByName?: string;
  [key: string]: unknown;
}
