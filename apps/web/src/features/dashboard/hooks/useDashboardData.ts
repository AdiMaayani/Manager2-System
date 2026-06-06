import { useMemo } from 'react';
import { useEmployees } from '@features/employees/hooks/useEmployees';
import { useProjects } from '@features/projects/hooks/useProjects';
import { useReports } from '@features/reports/hooks/useReports';
import { useServiceCalls } from '@features/serviceCalls/hooks/useServiceCalls';
import { useQuotes } from '@features/quotes';
import { useInventory } from '@features/inventory/hooks/useInventory';
import { useAllWorkPlans } from '@features/workplan/hooks/useWorkPlanData';
import type { ProjectListItem } from '@features/projects/types';
import type { WorkReportListItem } from '@features/reports/types';
import type { ServiceCallListItem } from '@features/serviceCalls/types';
import type { QuoteListItem } from '@features/quotes';
import type { InventoryItem } from '@features/inventory/types';

const ACTIVE_PROJECT_STATUSES = new Set([
  'open',
  'planned',
  'design',
  'wiring',
  'execution',
  'פתוח',
  'בתכנון',
  'מתוכנן',
  'תוכניות',
  'השחלה',
  'ביצוע',
  'בביצוע',
]);

const OPEN_TASK_STATUSES = new Set([
  'open',
  'planned',
  'execution',
  'blocked',
  'פתוח',
  'בתכנון',
  'מתוכנן',
  'ביצוע',
  'בביצוע',
  'תקוע',
]);

const OPEN_SERVICE_CALL_STATUSES = new Set(['open', 'inprogress']);

// Stable references so react-query keys do not change on every render.
const ALL_QUOTES_FILTER = {} as const;
const LOW_STOCK_FILTER = { status: 'active', lowStockOnly: true } as const;

const MAX_LIST_ITEMS = 6;
const MAX_TASK_ITEMS = 8;

export interface DashboardAttentionTask {
  taskId: number;
  title: string;
  status: string;
  projectId: number;
  projectTitle: string;
  priority?: string | null;
}

export interface DashboardKpis {
  activeProjects: number;
  openTasks: number;
  reportsThisWeek: number;
  activeEmployees: number;
}

function normalizeStatus(status?: string | null): string {
  return String(status ?? '').trim().toLowerCase();
}

function getTime(dateValue?: string | null): number {
  if (!dateValue) return 0;
  const time = new Date(dateValue).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function isReportFromCurrentWeek(reportDate?: string | null): boolean {
  if (!reportDate) return false;

  const date = new Date(reportDate);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  return date >= weekStart && date < weekEnd;
}

export function useDashboardData() {
  const projectsQuery = useProjects();
  const reportsQuery = useReports();
  const employeesQuery = useEmployees();
  const workPlansQuery = useAllWorkPlans();
  const serviceCallsQuery = useServiceCalls();
  const quotesQuery = useQuotes(ALL_QUOTES_FILTER);
  const inventoryQuery = useInventory(LOW_STOCK_FILTER);

  const projects = projectsQuery.data;
  const reports = reportsQuery.data;
  const employees = employeesQuery.data;
  const workPlans = workPlansQuery.data;

  // Core data backs the KPIs and primary sections; the page gates on these.
  const isLoading =
    projectsQuery.isLoading ||
    reportsQuery.isLoading ||
    employeesQuery.isLoading ||
    workPlansQuery.isLoading;

  const error =
    projectsQuery.error ||
    reportsQuery.error ||
    employeesQuery.error ||
    workPlansQuery.error;

  const refetchCore = () => {
    void projectsQuery.refetch();
    void reportsQuery.refetch();
    void employeesQuery.refetch();
    void workPlansQuery.refetch();
  };

  const kpis = useMemo<DashboardKpis>(
    () => ({
      activeProjects: (projects ?? []).filter((project) =>
        ACTIVE_PROJECT_STATUSES.has(normalizeStatus(project.status)),
      ).length,
      openTasks: (workPlans ?? []).reduce(
        (count, workPlan) =>
          count +
          workPlan.tasks.filter((task) =>
            OPEN_TASK_STATUSES.has(normalizeStatus(task.status)),
          ).length,
        0,
      ),
      reportsThisWeek: (reports ?? []).filter((report) =>
        isReportFromCurrentWeek(report.reportDate),
      ).length,
      activeEmployees: (employees ?? []).filter((employee) => employee.isActive).length,
    }),
    [projects, workPlans, reports, employees],
  );

  const activeProjects = useMemo<ProjectListItem[]>(
    () =>
      (projects ?? [])
        .filter((project) => ACTIVE_PROJECT_STATUSES.has(normalizeStatus(project.status)))
        .slice(0, MAX_LIST_ITEMS),
    [projects],
  );

  const attentionTasks = useMemo<DashboardAttentionTask[]>(() => {
    const tasks: DashboardAttentionTask[] = [];

    (workPlans ?? []).forEach((workPlan) => {
      workPlan.tasks.forEach((task) => {
        if (!OPEN_TASK_STATUSES.has(normalizeStatus(task.status))) return;
        tasks.push({
          taskId: task.workItemId,
          title: task.title,
          status: task.status,
          projectId: workPlan.project.id,
          projectTitle: workPlan.project.title,
          priority: task.priority,
        });
      });
    });

    return tasks.slice(0, MAX_TASK_ITEMS);
  }, [workPlans]);

  const recentReports = useMemo<WorkReportListItem[]>(
    () =>
      [...(reports ?? [])]
        .sort((a, b) => getTime(b.reportDate) - getTime(a.reportDate))
        .slice(0, MAX_LIST_ITEMS),
    [reports],
  );

  const openServiceCalls = useMemo<ServiceCallListItem[]>(
    () =>
      (serviceCallsQuery.data ?? [])
        .filter((call) => OPEN_SERVICE_CALL_STATUSES.has(normalizeStatus(call.status)))
        .slice(0, MAX_LIST_ITEMS),
    [serviceCallsQuery.data],
  );

  const recentQuotes = useMemo<QuoteListItem[]>(
    () =>
      [...(quotesQuery.data ?? [])]
        .sort((a, b) => getTime(b.quoteDate) - getTime(a.quoteDate))
        .slice(0, MAX_LIST_ITEMS),
    [quotesQuery.data],
  );

  const lowStockItems = useMemo<InventoryItem[]>(
    () => (inventoryQuery.data ?? []).slice(0, MAX_TASK_ITEMS),
    [inventoryQuery.data],
  );

  return {
    isLoading,
    error,
    refetchCore,
    kpis,
    activeProjects,
    attentionTasks,
    recentReports,
    serviceCalls: {
      items: openServiceCalls,
      isLoading: serviceCallsQuery.isLoading,
      error: serviceCallsQuery.error,
      refetch: () => void serviceCallsQuery.refetch(),
    },
    quotes: {
      items: recentQuotes,
      isLoading: quotesQuery.isLoading,
      error: quotesQuery.error,
      refetch: () => void quotesQuery.refetch(),
    },
    lowStock: {
      items: lowStockItems,
      isLoading: inventoryQuery.isLoading,
      error: inventoryQuery.error,
      refetch: () => void inventoryQuery.refetch(),
    },
  };
}
