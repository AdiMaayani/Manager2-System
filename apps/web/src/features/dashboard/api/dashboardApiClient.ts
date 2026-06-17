import { apiRequest } from '@api/client';

// Severity used by recommendations, warnings and activity rows.
export type DashboardSeverity = 'critical' | 'attention' | 'info';

export type DashboardKpiTone = 'primary' | 'warning' | 'danger' | 'success' | 'neutral';

export interface DashboardUser {
  displayName: string;
  roleLabels: string[];
  stateSummary: string;
}

export interface DashboardKpi {
  id: string;
  label: string;
  value: number;
  context?: string | null;
  tone: DashboardKpiTone;
  actionRoute?: string | null;
}

export interface DashboardTask {
  workItemId: number;
  title: string;
  status?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  projectTitle?: string | null;
  customerName?: string | null;
  siteName?: string | null;
  actionRoute?: string | null;
}

export interface DashboardRecommendation {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: DashboardSeverity;
  priorityScore: number;
  entityType?: string | null;
  entityId?: number | null;
  actionLabel: string;
  actionRoute?: string | null;
  relevantDate?: string | null;
  context?: string | null;
}

export interface DashboardWarning {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: DashboardSeverity;
  entityType?: string | null;
  entityId?: number | null;
  actionLabel?: string | null;
  actionRoute?: string | null;
  relevantDate?: string | null;
  context?: string | null;
}

export interface DashboardActivity {
  id: string;
  title: string;
  description?: string | null;
  actorName?: string | null;
  occurredAtUtc: string;
  severity: DashboardSeverity;
  entityType?: string | null;
  entityId?: number | null;
  actionRoute?: string | null;
}

export interface DashboardResponse {
  generatedAtUtc: string;
  user: DashboardUser;
  kpis: DashboardKpi[];
  personalTasksToday: DashboardTask[];
  recommendations: DashboardRecommendation[];
  earlyWarnings: DashboardWarning[];
  recentActivity: DashboardActivity[];
}

// Single dashboard fetch — the server returns the full role-aware payload in one call.
export async function getDashboardAsync(): Promise<DashboardResponse> {
  return apiRequest<DashboardResponse>('/dashboard');
}
