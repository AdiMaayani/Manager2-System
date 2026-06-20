import { useMemo, useState, useEffect } from 'react';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { InlineAlert } from '@shared/components/InlineAlert';
import { WorkPlanToolbar } from '../../components/WorkPlanToolbar';
import { WorkPlanDailyGrid } from '../../components/WorkPlanDailyGrid';
import { WorkPlanWeeklyView } from '../../components/WorkPlanWeeklyView';
import { WorkPlanMonthlyView } from '../../components/WorkPlanMonthlyView';
import { WorkPlanYearlyView } from '../../components/WorkPlanYearlyView';
import { WorkPlanTaskPanel } from '../../components/WorkPlanTaskPanel';
import { NewTaskModal } from '../../components/NewTaskModal';
import { usePermissions } from '@shared/auth/usePermissions';
import { useProjects } from '@features/projects/hooks/useProjects';
import { useEmployeeLookup } from '@features/employees/hooks/useEmployees';
import { useWorkPlanPageState } from '../../hooks/useWorkPlanPageState';
import { useWorkPlanScheduling } from '../../hooks/useWorkPlanData';
import {
  buildWorkPlanEmployeeFilterOptions,
  buildWorkPlanProjectFilterOptions,
} from '../../lib/workPlanQueryUtils';
import {
  buildWorkPlanTaskSelection,
  findTaskInSchedule,
  resolveFlatAssignment,
} from '../../lib/workPlanScheduling';
import { toLocalDateKey } from '@shared/utils/utcDateTime';
import type { ScheduledTaskBar, WorkPlanTaskSelection } from '../../types';
import './WorkPlanPage.css';

function scheduledToSelection(task: ScheduledTaskBar): WorkPlanTaskSelection {
  return {
    taskId: task.taskId,
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    workType: task.workType ?? null,
    taskCategory: task.taskCategory ?? null,
    projectId: task.projectId,
    projectTitle: task.projectTitle,
    customerName: task.customerName ?? null,
    siteName: task.siteName ?? null,
    milestoneTitle: task.milestoneTitle ?? null,
    assigneeName: task.assigneeName,
    assigneeEmployeeId: task.employeeId || null,
    startHour: task.startHour,
    endHour: task.endHour,
    plannedStart: task.plannedStart,
    plannedEnd: task.plannedEnd,
    derivedDurationMinutes: task.derivedDurationMinutes,
    isLocked: task.isLocked,
    isUnscheduled: task.isUnscheduled,
    estimatedHours: task.estimatedHours,
    priority: task.priority,
    requiredRole: task.requiredRole,
  };
}

export function WorkPlanPage() {
  const { can } = usePermissions();
  const { data: activeProjects = [] } = useProjects();
  const employeeLookupQuery = useEmployeeLookup();
  const pageState = useWorkPlanPageState();
  const scheduling = useWorkPlanScheduling({
    scope: pageState.scope,
    projectFilter: pageState.projectFilter,
    statusFilter: pageState.statusFilter,
    taskCategoryFilter: pageState.taskCategoryFilter,
    employeeFilterId: pageState.employeeFilterId,
    searchQuery: pageState.searchQuery,
    periodAnchor: pageState.periodAnchor,
    range: pageState.range,
  });

  const [selectedTask, setSelectedTask] = useState<WorkPlanTaskSelection | null>(null);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [newTaskModalKey, setNewTaskModalKey] = useState(0);
  const [dismissedWorkItemId, setDismissedWorkItemId] = useState<number | null>(null);

  const requestedWorkItemId = pageState.requestedWorkItemId;
  const localDayKey = toLocalDateKey(pageState.periodAnchor);

  const requestedTaskSelection = useMemo<WorkPlanTaskSelection | null>(() => {
    if (requestedWorkItemId == null) return null;
    const match = findTaskInSchedule(scheduling.schedule, requestedWorkItemId);
    if (!match) return null;
    const assignment = resolveFlatAssignment(match.task, scheduling.schedule.assignments);
    return buildWorkPlanTaskSelection(
      match.task,
      assignment,
      localDayKey,
      match.isUnscheduled,
    );
  }, [requestedWorkItemId, scheduling.schedule, localDayKey]);

  const autoOpenTask =
    requestedWorkItemId != null && dismissedWorkItemId !== requestedWorkItemId
      ? requestedTaskSelection
      : null;
  const effectiveSelectedTask = selectedTask ?? autoOpenTask;

  const requestedTaskMissing =
    requestedWorkItemId != null &&
    dismissedWorkItemId !== requestedWorkItemId &&
    requestedTaskSelection == null;

  const closeTaskPanel = () => {
    setSelectedTask(null);
    if (requestedWorkItemId != null) {
      setDismissedWorkItemId(requestedWorkItemId);
    }
  };

  const personalScopeInfo = useMemo(() => {
    if (pageState.scope !== 'personal') return null;
    if (scheduling.currentUserEmployeeId == null) {
      return {
        tone: 'warning' as const,
        message: scheduling.currentUserIsAdmin
          ? 'אתה מחובר כמנהל מערכת ללא עובד משויך, ולכן אין תצוגה אישית. השתמש בחתך "כללי" או "לפי עובד" כדי לראות משימות.'
          : 'לא ניתן להציג תצוגה אישית: למשתמש המחובר אין עובד משויך. יש לוודא שחשבון המשתמש מקושר לעובד במערכת.',
      };
    }
    if (!scheduling.currentUserEmployee) {
      return {
        tone: 'warning' as const,
        message: `העובד המשויך למשתמש (מזהה #${scheduling.currentUserEmployeeId}) אינו נמצא ברשימת העובדים הפעילים.`,
      };
    }
    const role = scheduling.currentUserEmployee.primaryRole;
    return {
      tone: 'info' as const,
      message: `תצוגה אישית · ${scheduling.currentUserEmployee.fullName}${role ? ` · ${role}` : ''}`,
    };
  }, [
    pageState.scope,
    scheduling.currentUserEmployee,
    scheduling.currentUserEmployeeId,
    scheduling.currentUserIsAdmin,
  ]);

  function handlePrint() {
    const printClass = 'workPlanPrint';
    document.body.classList.add(printClass);
    const cleanup = () => {
      document.body.classList.remove(printClass);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    window.setTimeout(cleanup, 1000);
  }

  const effectiveProjectId = useMemo(() => {
    if (typeof pageState.projectFilter === 'number') return pageState.projectFilter;
    return null;
  }, [pageState.projectFilter]);

  const { projectFilter, scope, setScope } = pageState;

  useEffect(() => {
    if (typeof projectFilter !== 'number') return;
    if (scope === 'project') return;
    setScope('project');
  }, [projectFilter, scope, setScope]);

  const baseProjectOptions = useMemo(
    () =>
      activeProjects.map((project) => ({
        id: project.workItemId,
        title: project.title,
        projectNumber: project.projectNumber,
        customerName: project.customerName,
      })),
    [activeProjects],
  );

  const projectOptions = useMemo(
    () => buildWorkPlanProjectFilterOptions(baseProjectOptions, effectiveProjectId),
    [baseProjectOptions, effectiveProjectId],
  );

  const employeeOptions = useMemo(() => {
    const activeEmployees = (employeeLookupQuery.data ?? [])
      .filter((employee) => employee.isActive)
      .map((employee) => ({
        employeeId: employee.employeeId,
        fullName: employee.fullName,
        primaryRole: employee.primaryRole,
      }));
    return buildWorkPlanEmployeeFilterOptions(activeEmployees, pageState.employeeFilterId);
  }, [employeeLookupQuery.data, pageState.employeeFilterId]);

  const newTaskEmployees = useMemo(
    () =>
      (employeeLookupQuery.data ?? [])
        .filter((employee) => employee.isActive && employee.isAssignable)
        .map((employee) => ({
          employeeId: employee.employeeId,
          fullName: employee.fullName,
          primaryRole: employee.primaryRole,
          isActive: employee.isActive,
          isAssignable: employee.isAssignable,
        })),
    [employeeLookupQuery.data],
  );

  const pageTitle = useMemo(() => {
    if (pageState.scope === 'project' && typeof pageState.projectFilter === 'number') {
      const project = projectOptions.find((p) => p.id === pageState.projectFilter);
      return project ? `תוכנית עבודה · ${project.title}` : 'תוכנית עבודה';
    }
    return 'תוכנית עבודה';
  }, [pageState.scope, pageState.projectFilter, projectOptions]);

  const isSelectedTaskOwnedByCurrentUser =
    effectiveSelectedTask != null &&
    scheduling.currentUserEmployeeId != null &&
    effectiveSelectedTask.assigneeEmployeeId === String(scheduling.currentUserEmployeeId);

  const canManageWorkPlan = can('manageWorkPlan');
  const canEditTask =
    canManageWorkPlan && (pageState.scope !== 'personal' || isSelectedTaskOwnedByCurrentUser);
  const canDeleteTask =
    canManageWorkPlan &&
    effectiveSelectedTask?.taskCategory !== 'ServiceCall' &&
    effectiveSelectedTask?.workType !== 'Project';

  if (scheduling.isLoading && !scheduling.isScopeSelectionPending) {
    return (
      <PageShell title={pageTitle} wide>
        <PageSpinner />
      </PageShell>
    );
  }

  if (scheduling.scheduleError && !scheduling.isScopeSelectionPending) {
    const errorMessage =
      scheduling.scheduleError instanceof Error
        ? scheduling.scheduleError.message
        : 'טעינת תוכנית העבודה נכשלה';

    return (
      <PageShell title={pageTitle} wide>
        <ErrorState message={errorMessage} />
      </PageShell>
    );
  }

  return (
    <PageShell title={pageTitle} wide>
      <div className="workPlanPage">
        <WorkPlanToolbar
          scope={pageState.scope}
          range={pageState.range}
          statusFilter={pageState.statusFilter}
          taskCategoryFilter={pageState.taskCategoryFilter}
          projectFilter={pageState.projectFilter}
          employeeFilterId={pageState.employeeFilterId}
          searchQuery={pageState.searchQuery}
          periodLabel={pageState.periodLabel}
          projectOptions={projectOptions}
          employees={employeeOptions}
          employeeLoadError={
            employeeLookupQuery.error instanceof Error ? employeeLookupQuery.error.message : null
          }
          isEmployeeListLoading={employeeLookupQuery.isLoading}
          onScopeChange={pageState.setScope}
          onRangeChange={pageState.setRange}
          onStatusFilterChange={pageState.setStatusFilter}
          onTaskCategoryFilterChange={pageState.setTaskCategoryFilter}
          onProjectFilterChange={pageState.setProjectFilter}
          onEmployeeFilterChange={pageState.setEmployeeFilterId}
          onSearchChange={pageState.setSearchQuery}
          onPreviousPeriod={pageState.goToPreviousPeriod}
          onNextPeriod={pageState.goToNextPeriod}
          onToday={pageState.goToToday}
          onPrint={handlePrint}
          onNewTask={() => {
            setNewTaskModalKey((current) => current + 1);
            setIsNewTaskModalOpen(true);
          }}
          canCreateTask={can('manageWorkPlan')}
        />

        {employeeLookupQuery.error && pageState.scope === 'employee' && (
          <InlineAlert variant="danger">
            {employeeLookupQuery.error instanceof Error
              ? employeeLookupQuery.error.message
              : 'טעינת רשימת העובדים נכשלה.'}
          </InlineAlert>
        )}

        {scheduling.scopeMessage && (
          <div className="workPlanPage__scopeBanner workPlanPage__scopeBanner--info" role="status">
            {scheduling.scopeMessage}
          </div>
        )}

        {personalScopeInfo && (
          <div
            className={`workPlanPage__scopeBanner workPlanPage__scopeBanner--${personalScopeInfo.tone}`}
            role="status"
          >
            {personalScopeInfo.message}
          </div>
        )}

        {requestedTaskMissing && (
          <div className="workPlanPage__scopeBanner workPlanPage__scopeBanner--warning" role="status">
            המשימה המבוקשת אינה זמינה בתצוגה זו.
          </div>
        )}

        {pageState.range === 'daily' && pageState.scope === 'project' && (
          <WorkPlanDailyGrid
            mode="projects"
            projectRows={scheduling.projectRows}
            unscheduledTasks={scheduling.unscheduledBars}
            onTaskSelect={(task) => setSelectedTask(scheduledToSelection(task))}
            selectedTaskId={effectiveSelectedTask?.taskId ?? null}
          />
        )}

        {pageState.range === 'daily' && pageState.scope !== 'project' && (
          <WorkPlanDailyGrid
            mode="employees"
            employeeRows={scheduling.employeeRows}
            unscheduledTasks={scheduling.unscheduledBars}
            onTaskSelect={(task) => setSelectedTask(scheduledToSelection(task))}
            selectedTaskId={effectiveSelectedTask?.taskId ?? null}
          />
        )}

        {pageState.range === 'weekly' && (
          <WorkPlanWeeklyView
            schedule={scheduling.schedule}
            statusFilter={pageState.statusFilter}
            taskCategoryFilter={pageState.taskCategoryFilter}
            searchQuery={pageState.searchQuery}
            periodAnchor={pageState.periodAnchor}
            onTaskClick={setSelectedTask}
          />
        )}

        {pageState.range === 'monthly' && (
          <WorkPlanMonthlyView
            schedule={scheduling.schedule}
            statusFilter={pageState.statusFilter}
            taskCategoryFilter={pageState.taskCategoryFilter}
            searchQuery={pageState.searchQuery}
            periodAnchor={pageState.periodAnchor}
            onTaskClick={setSelectedTask}
          />
        )}

        {pageState.range === 'yearly' && (
          <WorkPlanYearlyView
            schedule={scheduling.schedule}
            taskCategoryFilter={pageState.taskCategoryFilter}
            searchQuery={pageState.searchQuery}
            periodAnchor={pageState.periodAnchor}
          />
        )}

        <WorkPlanTaskPanel
          task={effectiveSelectedTask}
          onClose={closeTaskPanel}
          canEdit={canEditTask}
          canDeleteTask={canDeleteTask}
          onTaskUpdated={closeTaskPanel}
        />

        <NewTaskModal
          key={newTaskModalKey}
          isOpen={isNewTaskModalOpen}
          onClose={() => setIsNewTaskModalOpen(false)}
          projectFilter={pageState.projectFilter}
          defaultProjectId={effectiveProjectId}
          projectOptions={projectOptions}
          employees={newTaskEmployees}
        />
      </div>
    </PageShell>
  );
}
