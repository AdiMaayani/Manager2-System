import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { Trash2 } from 'lucide-react';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { InlineAlert } from '@shared/components/InlineAlert';
import { Modal } from '@shared/components/Modal';
import { deleteWorkPlanTaskAsync } from '../../api/workplanApiClient';
import { invalidateWorkPlanQueries } from '../../hooks/useWorkPlanData';
import { EditTaskDrawer } from '../EditTaskDrawer';
import { RecommendationFeedbackPanel } from '../RecommendationFeedbackPanel';
import {
  getWorkPlanPriorityDisplay,
  getWorkPlanStatusDisplay,
  isWorkPlanStatusDone,
  isWorkPlanStatusInProgress,
} from '../../constants';
import { formatHourAsTime } from '../../lib/workPlanScheduling';
import type {
  WorkPlanEmployee,
  WorkPlanScheduleAssignment,
  WorkPlanTaskSelection,
} from '../../types';
import { getTaskCategoryLabel } from '@shared/constants/taskCategories';
import {
  taskCategoryModifierClass,
} from '@shared/constants/taskCategoryStyles';
import './WorkPlanTaskPanel.css';

import { localDateKeyFromUtc, localTimeFromUtc } from '@shared/utils/utcDateTime';
import {
  taskCategoryToReportTargetType,
  writeQuickReportPrefill,
  type QuickReportPrefill,
} from '@features/reports/quickReportPrefill';
import { resolveQuickReportWorkers } from '@features/reports/quickReportWorkers';

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

function resolveStatusVariant(status?: string | null): BadgeVariant {
  if (isWorkPlanStatusDone(status)) return 'success';
  if (isWorkPlanStatusInProgress(status)) return 'primary';
  return 'neutral';
}

function formatPlannedDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('he-IL');
}

interface WorkPlanTaskPanelProps {
  task: WorkPlanTaskSelection | null;
  onClose: () => void;
  canEdit: boolean;
  canDeleteTask: boolean;
  assignments: WorkPlanScheduleAssignment[];
  employees: WorkPlanEmployee[];
  onTaskUpdated: () => void;
}

export function WorkPlanTaskPanel({
  task,
  onClose,
  canEdit,
  canDeleteTask,
  assignments,
  employees,
  onTaskUpdated,
}: WorkPlanTaskPanelProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteTaskMutation = useMutation({
    mutationFn: ({ taskId }: { taskId: number; projectId: number }) =>
      deleteWorkPlanTaskAsync(taskId),
    onSuccess: async (_data, deletedTask) => {
      await invalidateWorkPlanQueries(queryClient, deletedTask.projectId);
      setIsDeleteConfirmOpen(false);
      onTaskUpdated();
      onClose();
    },
    onError: (err) => {
      setDeleteError(err instanceof Error ? err.message : 'מחיקת המשימה נכשלה. נסה שוב.');
    },
  });

  if (!task) return null;

  function handleQuickReport() {
    if (!task) return;

    const reportDate = task.plannedStart
      ? localDateKeyFromUtc(task.plannedStart)
      : new Date().toISOString().slice(0, 10);
    const employeesById = new Map(employees.map((employee) => [employee.employeeId, employee]));
    const workerSelection = resolveQuickReportWorkers(
      assignments
        .filter((assignment) => assignment.workItemId === task.taskId)
        .map((assignment) => {
          const employee =
            assignment.employeeId != null
              ? employeesById.get(assignment.employeeId)
              : undefined;
          return {
            employeeId: assignment.employeeId,
            employeeName: assignment.employeeName,
            assignmentRole: assignment.assignmentRole,
            isManualAssignment: assignment.isManualAssignment,
            assignmentSource: assignment.assignmentSource,
            isActive: employee?.isActive === true,
            isAssignable: employee?.isAssignable === true,
          };
        }),
      task.assigneeEmployeeId ? Number(task.assigneeEmployeeId) : null,
    );
    const prefill: QuickReportPrefill = {
      workItemId: task.taskId,
      taskCategory: task.taskCategory ?? 'Regular',
      title: task.title,
      date: reportDate,
      start: task.plannedStart ? localTimeFromUtc(task.plannedStart) : formatHourAsTime(task.startHour),
      end: task.plannedEnd ? localTimeFromUtc(task.plannedEnd) : formatHourAsTime(task.endHour),
      reporterId: workerSelection.reporterId,
      reporterName:
        workerSelection.reporterName || (task.assigneeName !== '—' ? task.assigneeName : ''),
      reporterRole:
        workerSelection.reporterRole
        || task.requiredRoles?.[0]
        || task.requiredRole
        || '',
      relatedWorkerIds: workerSelection.relatedWorkerIds,
      customerName: task.customerName ?? undefined,
      site: task.siteName ?? undefined,
      projectId: task.projectId,
      projectTitle: task.projectTitle ?? undefined,
    };

    writeQuickReportPrefill(prefill);
    const reportType = taskCategoryToReportTargetType(prefill.taskCategory);
    navigate(`/reports?quick=1&workItemId=${task.taskId}&reportType=${reportType}`);
  }

  const permissionTone = task.isLocked ? 'locked' : canEdit ? 'allowed' : 'blocked';
  const permissionMessage = task.isLocked
    ? 'משימה נעולה — לא ניתן לערוך.'
    : canEdit
      ? 'יש הרשאה לעריכה.'
      : 'אין הרשאה לעריכה בחתך הנוכחי.';

  const plannedDate = formatPlannedDate(task.plannedStart);
  const description = task.description?.trim();
  const assignedEmployeeId = task.assigneeEmployeeId
    ? Number(task.assigneeEmployeeId)
    : null;
  const directAssignments = assignments.filter((assignment) =>
    assignment.workItemId === task.taskId
    && assignment.assignmentSource === 'Task'
    && (assignment.employeeId != null || Boolean(assignment.employeeName)));
  const inheritedAssignment = directAssignments.length === 0
    && assignedEmployeeId != null
    && Number.isInteger(assignedEmployeeId)
    && task.projectId != null
    ? assignments.find((assignment) =>
        assignment.workItemId === task.projectId
        && assignment.employeeId === assignedEmployeeId
        && assignment.assignmentSource === 'Project')
    : null;
  const syntheticAssignment: WorkPlanScheduleAssignment | null = directAssignments.length === 0
    && !inheritedAssignment
    && assignedEmployeeId != null
    && Number.isInteger(assignedEmployeeId)
    && assignedEmployeeId > 0
    ? {
        workEmployeeAssignmentId: null,
        workItemId: task.projectId ?? 0,
        employeeId: assignedEmployeeId,
        employeeName: task.assigneeName,
        assignmentRole: task.requiredRoles?.[0] ?? task.requiredRole ?? null,
        assignedHours: null,
        isManualAssignment: task.isManualAssignment ?? true,
        assignmentSource: 'Project',
      }
    : null;
  const displayedAssignments = directAssignments.length > 0
    ? directAssignments
    : inheritedAssignment
      ? [inheritedAssignment]
      : syntheticAssignment
        ? [syntheticAssignment]
        : [];

  return (
    <>
      <Modal
        isOpen
        onClose={() => {
          if (!deleteTaskMutation.isPending) onClose();
        }}
        title="פרטי משימה"
        isMaximized={isMaximized}
        onToggleMaximize={() => setIsMaximized((value) => !value)}
      >
        <div className="workPlanTaskPanel">
          <div
            className={taskCategoryModifierClass(
              'workPlanTaskPanel__intro',
              task.taskCategory,
            )}
          >
            <span className="workPlanTaskPanel__category">
              {getTaskCategoryLabel(task.taskCategory)}
            </span>
            <p className="workPlanTaskPanel__project">{task.projectTitle}</p>
            <h3 className="workPlanTaskPanel__title">{task.title}</h3>
            <Badge variant={resolveStatusVariant(task.status)}>
              {getWorkPlanStatusDisplay(task.status)}
            </Badge>
          </div>

          <dl className="workPlanTaskPanel__meta">
            <div className="workPlanTaskPanel__metaRow">
              <dt>שעות</dt>
              <dd>
                {formatHourAsTime(task.startHour)} – {formatHourAsTime(task.endHour)}
              </dd>
            </div>
            {plannedDate && (
              <div className="workPlanTaskPanel__metaRow">
                <dt>תאריך מתוכנן</dt>
                <dd>{plannedDate}</dd>
              </div>
            )}
            {task.priority && (
              <div className="workPlanTaskPanel__metaRow">
                <dt>עדיפות</dt>
                <dd>{getWorkPlanPriorityDisplay(task.priority)}</dd>
              </div>
            )}
            {((task.requiredRoles?.length ?? 0) > 0 || task.requiredRole) && (
              <div className="workPlanTaskPanel__metaRow">
                <dt>מקצועות נדרשים</dt>
                <dd>{task.requiredRoles?.length ? task.requiredRoles.join(' · ') : task.requiredRole}</dd>
              </div>
            )}
            {task.estimatedHours != null && (
              <div className="workPlanTaskPanel__metaRow">
                <dt>שעות משוערות</dt>
                <dd>{task.estimatedHours}</dd>
              </div>
            )}
          </dl>

          {description && (
            <section className="workPlanTaskPanel__description">
              <h4 className="workPlanTaskPanel__descriptionTitle">תיאור</h4>
              <p className="workPlanTaskPanel__descriptionText">{description}</p>
            </section>
          )}

          <section
            className="workPlanTaskPanel__assignments"
            aria-labelledby={`task-${task.taskId}-assignments-title`}
          >
            <h4
              id={`task-${task.taskId}-assignments-title`}
              className="workPlanTaskPanel__assignmentsTitle"
            >
              שיבוץ עובדים
            </h4>
            {displayedAssignments.length > 0 ? (
              <div className="workPlanTaskPanel__assignmentList">
                {displayedAssignments.map((assignment, index) => {
                  const assignmentId = assignment.workEmployeeAssignmentId ?? null;
                  const isDirect = assignment.workItemId === task.taskId
                    && assignment.assignmentSource === 'Task';
                  const isReadOnly = !isDirect || assignmentId == null || assignmentId <= 0;
                  return (
                    <RecommendationFeedbackPanel
                      key={assignmentId != null && assignmentId > 0
                        ? `assignment-${assignmentId}`
                        : `${assignment.workItemId}:${assignment.employeeId ?? 'none'}:${index}`}
                      taskId={task.taskId}
                      assignment={assignment}
                      canEdit={canEdit}
                      isReadOnly={isReadOnly || task.isLocked}
                    />
                  );
                })}
              </div>
            ) : (
              <InlineAlert variant="info">לא שובץ עובד למשימה.</InlineAlert>
            )}
          </section>

          <div className="workPlanTaskPanel__footer">
            <p className={`workPlanTaskPanel__perms workPlanTaskPanel__perms--${permissionTone}`}>
              {permissionMessage}
            </p>
            {deleteError && <InlineAlert variant="danger">{deleteError}</InlineAlert>}
            <div className="workPlanTaskPanel__actions">
              <Button
                type="button"
                disabled={!canEdit || task.isLocked}
                onClick={() => setIsEditOpen(true)}
              >
                עריכה
              </Button>
              <Button type="button" variant="secondary" onClick={handleQuickReport}>
                דיווח מהיר
              </Button>

              {canDeleteTask && !task.isLocked && (
                <div className="workPlanTaskPanel__dangerActions">
                  <Button
                    type="button"
                    variant="danger"
                    iconStart={<Trash2 size={16} />}
                    onClick={() => {
                      setDeleteError(null);
                      setIsDeleteConfirmOpen(true);
                    }}
                  >
                    מחק משימה
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          if (!deleteTaskMutation.isPending) setIsDeleteConfirmOpen(false);
        }}
        title="מחיקת משימה"
      >
        <div className="workPlanTaskPanel__confirm">
          <p className="workPlanTaskPanel__confirmMessage">
            האם למחוק את המשימה „{task.title}“? לא ניתן לבטל פעולה זו.
          </p>
          {deleteError && <InlineAlert variant="danger">{deleteError}</InlineAlert>}
          <div className="workPlanTaskPanel__confirmActions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsDeleteConfirmOpen(false)}
              disabled={deleteTaskMutation.isPending}
            >
              ביטול
            </Button>
            <Button
              type="button"
              variant="danger"
              iconStart={<Trash2 size={16} />}
              onClick={() =>
                deleteTaskMutation.mutate({
                  taskId: task.taskId,
                  projectId: task.projectId ?? 0,
                })
              }
              isLoading={deleteTaskMutation.isPending}
            >
              {deleteTaskMutation.isPending ? 'מוחק...' : 'מחק משימה'}
            </Button>
          </div>
        </div>
      </Modal>

      <EditTaskDrawer
        isOpen={isEditOpen}
        task={task}
        assignments={directAssignments}
        employees={employees}
        canEdit={canEdit && !task.isLocked}
        onClose={() => setIsEditOpen(false)}
        onSaved={() => {
          setIsEditOpen(false);
          onTaskUpdated();
        }}
      />

    </>
  );
}
