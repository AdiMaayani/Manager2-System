import { useMemo, useState } from 'react';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { WorkPlanToolbar } from '../../components/WorkPlanToolbar';
import { WorkPlanDailyGrid } from '../../components/WorkPlanDailyGrid';
import { WorkPlanWeeklyView } from '../../components/WorkPlanWeeklyView';
import { WorkPlanMonthlyView } from '../../components/WorkPlanMonthlyView';
import { WorkPlanYearlyView } from '../../components/WorkPlanYearlyView';
import { WorkPlanTaskPanel } from '../../components/WorkPlanTaskPanel';
import { NewTaskModal } from '../../components/NewTaskModal';
import { usePermissions } from '@shared/auth/usePermissions';
import { useWorkPlanPageState } from '../../hooks/useWorkPlanPageState';
import { useWorkPlanScheduling } from '../../hooks/useWorkPlanData';
import type { ScheduledTaskBar, WorkPlanTaskSelection } from '../../types';
import './WorkPlanPage.css';

function scheduledToSelection(task: ScheduledTaskBar): WorkPlanTaskSelection {
  return {
    taskId: task.taskId,
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    projectId: task.projectId,
    projectTitle: task.projectTitle,
    assigneeName: task.assigneeName,
    assigneeEmployeeId: task.employeeId || null,
    startHour: task.startHour,
    endHour: task.endHour,
    plannedStart: task.plannedStart,
    plannedEnd: task.plannedEnd,
    isLocked: task.isLocked,
    estimatedHours: task.estimatedHours,
    priority: task.priority,
    requiredRole: task.requiredRole,
  };
}

export function WorkPlanPage() {
  const { can } = usePermissions();
  const pageState = useWorkPlanPageState();
  const scheduling = useWorkPlanScheduling({
    scope: pageState.scope,
    projectFilter: pageState.projectFilter,
    isAllProjectsMode: pageState.isAllProjectsMode,
    statusFilter: pageState.statusFilter,
    employeeFilterId: pageState.employeeFilterId,
    searchQuery: pageState.searchQuery,
    selectedDate: pageState.periodAnchor,
  });

  const [selectedTask, setSelectedTask] = useState<WorkPlanTaskSelection | null>(null);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);

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
    if (!pageState.isAllProjectsMode) return null;
    return scheduling.singleWorkPlan?.project.id ?? null;
  }, [pageState.projectFilter, pageState.isAllProjectsMode, scheduling.singleWorkPlan]);

  const pageTitle = useMemo(() => {
    if (pageState.scope === 'project' && typeof pageState.projectFilter === 'number') {
      const project = scheduling.projectOptions.find((p) => p.id === pageState.projectFilter);
      return project ? `תוכנית עבודה · ${project.title}` : 'תוכנית עבודה';
    }
    return 'תוכנית עבודה';
  }, [pageState.scope, pageState.projectFilter, scheduling.projectOptions]);

  // In personal scope, users may edit only their own tasks; locked tasks are
  // blocked separately inside the task panel.
  const isSelectedTaskOwnedByCurrentUser =
    selectedTask != null &&
    scheduling.currentUserEmployeeId != null &&
    selectedTask.assigneeEmployeeId === String(scheduling.currentUserEmployeeId);

  const canEditTask = pageState.scope !== 'personal' || isSelectedTaskOwnedByCurrentUser;

  if (scheduling.isLoading) {
    return (
      <PageShell title={pageTitle} wide>
        <PageSpinner />
      </PageShell>
    );
  }

  if (scheduling.error) {
    const errorMessage =
      scheduling.error instanceof Error ? scheduling.error.message : 'טעינת תוכנית העבודה נכשלה';

    return (
      <PageShell title={pageTitle} wide>
        <ErrorState message={errorMessage} />
      </PageShell>
    );
  }

  if (!scheduling.employees.length && !scheduling.allWorkPlans.length) {
    return (
      <PageShell title={pageTitle} wide>
        <ErrorState message="לא נטענו נתוני תוכנית עבודה" />
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
          projectFilter={pageState.projectFilter}
          employeeFilterId={pageState.employeeFilterId}
          searchQuery={pageState.searchQuery}
          periodLabel={pageState.periodLabel}
          projectOptions={scheduling.projectOptions}
          employees={scheduling.employees}
          onScopeChange={pageState.setScope}
          onRangeChange={pageState.setRange}
          onStatusFilterChange={pageState.setStatusFilter}
          onProjectFilterChange={pageState.setProjectFilter}
          onEmployeeFilterChange={pageState.setEmployeeFilterId}
          onSearchChange={pageState.setSearchQuery}
          onPreviousPeriod={pageState.goToPreviousPeriod}
          onNextPeriod={pageState.goToNextPeriod}
          onToday={pageState.goToToday}
          onPrint={handlePrint}
          onNewTask={() => setIsNewTaskModalOpen(true)}
          canCreateTask={can('manageWorkPlan')}
        />

        {personalScopeInfo && (
          <div
            className={`workPlanPage__scopeBanner workPlanPage__scopeBanner--${personalScopeInfo.tone}`}
            role="status"
          >
            {personalScopeInfo.message}
          </div>
        )}

        {pageState.range === 'daily' && pageState.scope === 'project' && (
          <WorkPlanDailyGrid
            mode="projects"
            projectRows={scheduling.projectRows}
            onTaskSelect={(task) => setSelectedTask(scheduledToSelection(task))}
            selectedTaskId={selectedTask?.taskId ?? null}
          />
        )}

        {pageState.range === 'daily' && pageState.scope !== 'project' && (
          <WorkPlanDailyGrid
            mode="employees"
            employeeRows={scheduling.employeeRows}
            onTaskSelect={(task) => setSelectedTask(scheduledToSelection(task))}
            selectedTaskId={selectedTask?.taskId ?? null}
          />
        )}

        {pageState.range === 'weekly' && (
          <WorkPlanWeeklyView
            workPlans={scheduling.activeWorkPlans}
            statusFilter={pageState.statusFilter}
            searchQuery={pageState.searchQuery}
            periodAnchor={pageState.periodAnchor}
            onTaskClick={setSelectedTask}
          />
        )}

        {pageState.range === 'monthly' && (
          <WorkPlanMonthlyView
            workPlans={scheduling.activeWorkPlans}
            searchQuery={pageState.searchQuery}
            periodAnchor={pageState.periodAnchor}
            onTaskClick={setSelectedTask}
          />
        )}

        {pageState.range === 'yearly' && (
          <WorkPlanYearlyView
            workPlans={scheduling.activeWorkPlans}
            searchQuery={pageState.searchQuery}
            periodAnchor={pageState.periodAnchor}
          />
        )}

        <WorkPlanTaskPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          canEdit={canEditTask}
          onTaskUpdated={() => setSelectedTask(null)}
        />

        <NewTaskModal
          isOpen={isNewTaskModalOpen}
          onClose={() => setIsNewTaskModalOpen(false)}
          projectFilter={pageState.projectFilter}
          defaultProjectId={effectiveProjectId}
          projectOptions={scheduling.projectOptions}
          employees={scheduling.employees}
        />
      </div>
    </PageShell>
  );
}
