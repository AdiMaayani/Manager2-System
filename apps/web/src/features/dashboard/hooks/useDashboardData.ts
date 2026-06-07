import { useMemo } from 'react';
import { getCurrentUser } from '@api/auth';
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

type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

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

const BLOCKED_TASK_STATUSES = new Set(['blocked', 'תקוע']);

const OPEN_SERVICE_CALL_STATUSES = new Set(['open', 'inprogress']);

// Stable references so react-query keys do not change on every render.
const ALL_QUOTES_FILTER = {} as const;
const LOW_STOCK_FILTER = { status: 'active', lowStockOnly: true } as const;

const MAX_LIST_ITEMS = 6;
const MAX_TASK_ITEMS = 8;
const MAX_ACTIVITY_ITEMS = 8;

export interface DashboardTask {
  taskId: number;
  title: string;
  status: string;
  projectId: number;
  projectTitle: string;
  priority?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  assigneeNames: string[];
  isMine: boolean;
}

export interface DashboardKpis {
  activeProjects: number;
  openTasks: number;
  myOpenTasks: number;
  overdueTasks: number;
  reportsThisWeek: number;
  activeEmployees: number;
}

export interface DashboardAlert {
  id: string;
  label: string;
  text: string;
  count: number;
  tone: BadgeTone;
  to: string;
}

export interface DashboardActivityItem {
  id: string;
  type: 'report' | 'quote' | 'service' | 'project';
  typeLabel: string;
  title: string;
  sub: string;
  date?: string | null;
  to: string;
}

function normalizeStatus(status?: string | null): string {
  return String(status ?? '').trim().toLowerCase();
}

function getTime(dateValue?: string | null): number {
  if (!dateValue) return 0;
  const time = new Date(dateValue).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function startOfTodayTime(): number {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function endOfTodayTime(): number {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date.getTime();
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

function isOpenTask(status?: string | null): boolean {
  return OPEN_TASK_STATUSES.has(normalizeStatus(status));
}

function isOverdueTask(task: Pick<DashboardTask, 'status' | 'plannedEnd'>): boolean {
  if (!isOpenTask(task.status)) return false;
  const end = getTime(task.plannedEnd);
  return end > 0 && end < startOfTodayTime();
}

function isTodayTask(task: Pick<DashboardTask, 'plannedStart' | 'plannedEnd'>): boolean {
  const dayStart = startOfTodayTime();
  const dayEnd = endOfTodayTime();
  const start = getTime(task.plannedStart);
  const end = getTime(task.plannedEnd) || start;

  if (start === 0 && end === 0) return false;

  const rangeStart = start || end;
  const rangeEnd = end || start;
  return rangeStart <= dayEnd && rangeEnd >= dayStart;
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

  const currentUser = getCurrentUser();
  const rawEmployeeId = currentUser?.employeeId ?? null;
  const currentEmployeeId =
    rawEmployeeId != null && rawEmployeeId > 0 ? rawEmployeeId : null;
  const isAdmin = currentUser?.roles?.includes('Admin') ?? false;
  // Admins (or accounts not linked to an employee row) get the company-wide
  // "management" view; everyone else sees their own assigned work.
  const isManagementView = isAdmin || currentEmployeeId == null;

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

  // Flatten every work-plan task into a single enriched list, resolving the
  // employees assigned to each task so we can split "my work" from everyone's.
  const tasks = useMemo<DashboardTask[]>(() => {
    const flattened: DashboardTask[] = [];

    (workPlans ?? []).forEach((workPlan) => {
      const employeeIdsByWorkItem = new Map<number, Set<number>>();
      const namesByWorkItem = new Map<number, Set<string>>();

      workPlan.assignments.forEach((assignment) => {
        if (assignment.assignmentType !== 'Employee' || assignment.employeeId == null) {
          return;
        }
        const ids = employeeIdsByWorkItem.get(assignment.workItemId) ?? new Set<number>();
        ids.add(assignment.employeeId);
        employeeIdsByWorkItem.set(assignment.workItemId, ids);

        if (assignment.employeeName) {
          const names = namesByWorkItem.get(assignment.workItemId) ?? new Set<string>();
          names.add(assignment.employeeName);
          namesByWorkItem.set(assignment.workItemId, names);
        }
      });

      workPlan.tasks.forEach((task) => {
        const assignedIds = employeeIdsByWorkItem.get(task.workItemId);
        const assigneeNames = Array.from(namesByWorkItem.get(task.workItemId) ?? []);
        flattened.push({
          taskId: task.workItemId,
          title: task.title,
          status: task.status,
          projectId: workPlan.project.id,
          projectTitle: workPlan.project.title,
          priority: task.priority,
          plannedStart: task.plannedStart,
          plannedEnd: task.plannedEnd,
          assigneeNames,
          isMine:
            currentEmployeeId != null && (assignedIds?.has(currentEmployeeId) ?? false),
        });
      });
    });

    return flattened;
  }, [workPlans, currentEmployeeId]);

  const openTasks = useMemo(() => tasks.filter((task) => isOpenTask(task.status)), [tasks]);
  const myOpenTasks = useMemo(() => openTasks.filter((task) => task.isMine), [openTasks]);
  const overdueTasks = useMemo(() => tasks.filter(isOverdueTask), [tasks]);

  // The "needs attention" list shows the current employee's own open work; for
  // managers (or unlinked admin accounts) it falls back to the whole company.
  const attentionTasks = useMemo<DashboardTask[]>(() => {
    const source = isManagementView ? openTasks : myOpenTasks;
    return [...source]
      .sort((a, b) => {
        const overdueDelta = Number(isOverdueTask(b)) - Number(isOverdueTask(a));
        if (overdueDelta !== 0) return overdueDelta;
        return getTime(a.plannedEnd) - getTime(b.plannedEnd);
      })
      .slice(0, MAX_TASK_ITEMS);
  }, [isManagementView, myOpenTasks, openTasks]);

  const dailyTasks = useMemo<DashboardTask[]>(() => {
    const source = isManagementView ? tasks : tasks.filter((task) => task.isMine);
    return source
      .filter((task) => isTodayTask(task) && normalizeStatus(task.status) !== 'cancelled')
      .sort((a, b) => getTime(a.plannedStart) - getTime(b.plannedStart))
      .slice(0, MAX_TASK_ITEMS);
  }, [isManagementView, tasks]);

  const kpis = useMemo<DashboardKpis>(
    () => ({
      activeProjects: (projects ?? []).filter((project) =>
        ACTIVE_PROJECT_STATUSES.has(normalizeStatus(project.status)),
      ).length,
      openTasks: openTasks.length,
      myOpenTasks: myOpenTasks.length,
      overdueTasks: overdueTasks.length,
      reportsThisWeek: (reports ?? []).filter((report) =>
        isReportFromCurrentWeek(report.reportDate),
      ).length,
      activeEmployees: (employees ?? []).filter((employee) => employee.isActive).length,
    }),
    [projects, openTasks, myOpenTasks, overdueTasks, reports, employees],
  );

  const activeProjects = useMemo<ProjectListItem[]>(
    () =>
      (projects ?? [])
        .filter((project) => ACTIVE_PROJECT_STATUSES.has(normalizeStatus(project.status)))
        .slice(0, MAX_LIST_ITEMS),
    [projects],
  );

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

  // Management alerts are all derived from real counts already loaded above.
  const alerts = useMemo<DashboardAlert[]>(() => {
    const openServiceCallCount = (serviceCallsQuery.data ?? []).filter((call) =>
      OPEN_SERVICE_CALL_STATUSES.has(normalizeStatus(call.status)),
    ).length;
    const lowStockCount = (inventoryQuery.data ?? []).length;
    const trackingQuotesCount = (quotesQuery.data ?? []).filter(
      (quote) => normalizeStatus(quote.status) === 'tracking',
    ).length;

    const attentionProjectIds = new Set<number>();
    tasks.forEach((task) => {
      if (isOverdueTask(task) || BLOCKED_TASK_STATUSES.has(normalizeStatus(task.status))) {
        attentionProjectIds.add(task.projectId);
      }
    });

    const candidates: DashboardAlert[] = [
      {
        id: 'overdue-tasks',
        label: 'משימות באיחור',
        text: 'משימות פתוחות שחרגו מתאריך היעד',
        count: overdueTasks.length,
        tone: 'danger',
        to: '/workplan',
      },
      {
        id: 'open-service-calls',
        label: 'קריאות שירות פתוחות',
        text: 'קריאות שירות הממתינות לטיפול',
        count: openServiceCallCount,
        tone: 'warning',
        to: '/service-calls',
      },
      {
        id: 'low-stock',
        label: 'מלאי במחסור',
        text: 'פריטי מלאי מתחת לרף המינימום',
        count: lowStockCount,
        tone: 'warning',
        to: '/inventory',
      },
      {
        id: 'quotes-tracking',
        label: 'הצעות במעקב',
        text: 'הצעות מחיר הממתינות למענה לקוח',
        count: trackingQuotesCount,
        tone: 'primary',
        to: '/quotes',
      },
      {
        id: 'projects-attention',
        label: 'פרויקטים הדורשים תשומת לב',
        text: 'פרויקטים עם משימות באיחור או תקועות',
        count: attentionProjectIds.size,
        tone: 'warning',
        to: '/projects',
      },
    ];

    return candidates.filter((alert) => alert.count > 0);
  }, [
    inventoryQuery.data,
    overdueTasks.length,
    quotesQuery.data,
    serviceCallsQuery.data,
    tasks,
  ]);

  // Recent activity blends the freshest items from every available real source.
  const recentActivity = useMemo<DashboardActivityItem[]>(() => {
    const items: DashboardActivityItem[] = [];

    (reports ?? []).forEach((report) => {
      items.push({
        id: `report-${report.reportId}`,
        type: 'report',
        typeLabel: 'דיווח ביצוע',
        title: report.projectTitle || report.customerName || 'דיווח ביצוע',
        sub: [report.reportedByName, report.status].filter(Boolean).join(' · '),
        date: report.reportDate,
        to: '/reports',
      });
    });

    (quotesQuery.data ?? []).forEach((quote) => {
      items.push({
        id: `quote-${quote.quoteId}`,
        type: 'quote',
        typeLabel: 'הצעת מחיר',
        title: [quote.quoteNumber, quote.customerName].filter(Boolean).join(' · '),
        sub: quote.projectTitle || '',
        date: quote.quoteDate,
        to: '/quotes',
      });
    });

    (serviceCallsQuery.data ?? []).forEach((call) => {
      items.push({
        id: `service-${call.workItemId}`,
        type: 'service',
        typeLabel: 'קריאת שירות',
        title: call.title,
        sub: call.customerName || '',
        date: call.createdAt,
        to: '/service-calls',
      });
    });

    (projects ?? []).forEach((project) => {
      items.push({
        id: `project-${project.workItemId}`,
        type: 'project',
        typeLabel: 'פרויקט',
        title: project.title,
        sub: project.customerName || '',
        date: project.createdAt,
        to: `/projects?projectId=${project.workItemId}`,
      });
    });

    return items
      .filter((item) => getTime(item.date) > 0)
      .sort((a, b) => getTime(b.date) - getTime(a.date))
      .slice(0, MAX_ACTIVITY_ITEMS);
  }, [projects, quotesQuery.data, reports, serviceCallsQuery.data]);

  return {
    isLoading,
    error,
    refetchCore,
    isManagementView,
    kpis,
    activeProjects,
    attentionTasks,
    dailyTasks,
    alerts,
    recentActivity,
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
