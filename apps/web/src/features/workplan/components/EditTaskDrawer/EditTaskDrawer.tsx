import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Drawer, useDrawerMaximize } from '@shared/components/Drawer';
import { Button } from '@shared/components/Button';
import { ErrorState } from '@shared/components/ErrorState';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { ListSelect } from '@shared/components/ListSelect';
import { Textarea } from '@shared/components/Textarea';
import { InlineAlert } from '@shared/components/InlineAlert';
import { getTaskCategoryLabel } from '@shared/constants/taskCategories';
import { formatDurationMinutes } from '@shared/utils/utcDateTime';
import {
  buildPlannedUtcRangeFromParts,
  deriveDurationFromParts,
  hydratePlannedScheduleFromUtc,
  type PlannedScheduleParts,
} from '../../lib/taskScheduleUtils';
import { updateServiceCallAsync } from '@features/serviceCalls/api/serviceCallsApiClient';
import {
  getWorkItemByIdAsync,
  replaceEmployeeAssignmentAsync,
  updateWorkItemAsync,
} from '../../api/workplanApiClient';
import { useEmployeePrimaryRoles } from '@features/employees/hooks/useEmployeePrimaryRoles';
import { invalidateWorkPlanQueries } from '../../hooks/useWorkPlanData';
import {
  addRequiredProfession,
  isRequiredProfessionSelected,
  legacyRequiredRole,
  normalizeRequiredProfessions,
  removeRequiredProfession,
} from '../../lib/requiredProfessions';
import {
  normalizeWorkPlanPriorityCode,
  WORKPLAN_PRIORITY_OPTIONS,
} from '../../constants';
import {
  cancelStaleAssignmentFeedbackQueries,
  purgeStaleAssignmentFeedbackQueries,
} from '../../lib/smartAssignmentFeedback';
import {
  buildPendingAssignmentReplacements,
  canExposeSavedTaskSmartRerun,
  getSmartPendingReplacements,
  hasUnsavedRecommendationAffectingChanges,
  toManualEmployeeReplacementRequests,
  type StagedSmartReplacement,
} from '../../lib/smartRerunAssignment';
import {
  SmartRerunPanel,
  type StagedSmartRerunSelection,
} from '../SmartRerunPanel';
import type {
  WorkItemResponse,
  WorkPlanEmployee,
  WorkPlanScheduleAssignment,
  WorkPlanTaskSelection,
} from '../../types';
import './EditTaskDrawer.css';

interface EditTaskDrawerProps {
  isOpen: boolean;
  task: WorkPlanTaskSelection | null;
  assignments: WorkPlanScheduleAssignment[];
  employees: WorkPlanEmployee[];
  canEdit?: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

/** Subset of editable task fields shared by the selection and the full work item. */
interface EditableTaskFieldsSource {
  title?: string | null;
  description?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  estimatedHours?: number | null;
  status?: string | null;
  priority?: string | null;
  requiredRole?: string | null;
  requiredRoles?: string[] | null;
  taskCategory?: string | null;
}

function validatePlannedUtcRange(parts: PlannedScheduleParts): {
  plannedStart: string;
  plannedEnd: string;
} {
  return buildPlannedUtcRangeFromParts(parts);
}

export function EditTaskDrawer({
  isOpen,
  task,
  assignments,
  employees,
  canEdit = true,
  onClose,
  onSaved,
}: EditTaskDrawerProps) {
  // Mount the drawer content only while open, and key it by the task id (with a safe fallback when
  // no task is selected), so maximize state resets on reopen and when switching tasks while open —
  // no effect copies isOpen into state. The hook lives above EditTaskForm, so it still survives the
  // form's seed→hydrated remount within the same task.
  if (!isOpen) return null;

  return (
    <EditTaskDrawerContent
      key={task?.taskId ?? 'new'}
      task={task}
      assignments={assignments}
      employees={employees}
      canEdit={canEdit}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

interface EditTaskDrawerContentProps {
  task: WorkPlanTaskSelection | null;
  assignments: WorkPlanScheduleAssignment[];
  employees: WorkPlanEmployee[];
  canEdit: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

function EditTaskDrawerContent({
  task,
  assignments,
  employees,
  canEdit,
  onClose,
  onSaved,
}: EditTaskDrawerContentProps) {
  const { isMaximized, toggleMaximize } = useDrawerMaximize();

  const workItemQuery = useQuery({
    queryKey: ['workplan', 'workItem', task?.taskId],
    queryFn: () => getWorkItemByIdAsync(task!.taskId),
    enabled: !!task?.taskId,
  });

  const closeFooter = (
    <div className="editTaskDrawer__actions">
      <Button type="button" variant="secondary" onClick={onClose}>
        סגור
      </Button>
    </div>
  );

  if (workItemQuery.isError) {
    return (
      <Drawer
        isOpen
        onClose={onClose}
        title="עריכת משימה"
        isMaximized={isMaximized}
        onToggleMaximize={toggleMaximize}
        footer={closeFooter}
      >
        <div className="editTaskDrawer__body">
          <ErrorState
            message="טעינת פרטי המשימה נכשלה — לא ניתן לערוך ללא הנתונים המלאים."
            onRetry={() => workItemQuery.refetch()}
          />
        </div>
      </Drawer>
    );
  }

  if (!task) {
    return (
      <Drawer
        isOpen
        onClose={onClose}
        title="עריכת משימה"
        isMaximized={isMaximized}
        onToggleMaximize={toggleMaximize}
        footer={closeFooter}
      >
        <div className="editTaskDrawer__body" />
      </Drawer>
    );
  }

  return (
    <EditTaskForm
      // Seed from the selection right away, then remount with the
      // authoritative work item once it loads so fields are never empty.
      key={`${task.taskId}-${workItemQuery.data ? 'hydrated' : 'seed'}`}
      isOpen
      isMaximized={isMaximized}
      onToggleMaximize={toggleMaximize}
      task={task}
      taskId={task.taskId}
      initialValues={workItemQuery.data ?? task}
      workItem={workItemQuery.data ?? null}
      assignments={assignments}
      employees={employees}
      canEdit={canEdit}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

interface EditTaskFormProps {
  isOpen: boolean;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  task: WorkPlanTaskSelection;
  taskId: number;
  initialValues: EditableTaskFieldsSource;
  // Full work item is required for saving: the backend PUT replaces every
  // column, so untouched fields must be echoed back from this record.
  workItem: WorkItemResponse | null;
  assignments: WorkPlanScheduleAssignment[];
  employees: WorkPlanEmployee[];
  canEdit: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

function getEmployeeProfessions(
  employee?: WorkPlanEmployee | null,
  fallbackRole?: string | null,
): string[] {
  const professions = (employee?.professions ?? [])
    .map((profession) => profession.trim())
    .filter(Boolean);
  if (professions.length > 0) return Array.from(new Set(professions));
  const primaryRole = employee?.primaryRole?.trim();
  if (primaryRole) return [primaryRole];
  const normalizedFallbackRole = fallbackRole?.trim();
  return normalizedFallbackRole ? [normalizedFallbackRole] : [];
}

function formatEmployeeProfessions(
  employee?: WorkPlanEmployee | null,
  fallbackRole?: string | null,
): string {
  const professions = getEmployeeProfessions(employee, fallbackRole);
  return professions.length > 0 ? professions.join(' · ') : 'לא הוגדרו מקצועות';
}

interface AssignmentReplacementEditorProps {
  assignment: WorkPlanScheduleAssignment;
  employees: WorkPlanEmployee[];
  unavailableEmployeeIds: ReadonlySet<number>;
  selectedEmployeeId: number | null;
  onSelectedEmployeeChange: (employeeId: number | null) => void;
}

function AssignmentReplacementEditor({
  assignment,
  employees,
  unavailableEmployeeIds,
  selectedEmployeeId,
  onSelectedEmployeeChange,
}: AssignmentReplacementEditorProps) {
  const [isReplacementOpen, setIsReplacementOpen] = useState(false);
  const currentEmployee = employees.find(
    (employee) => employee.employeeId === assignment.employeeId,
  );
  const activeEmployees = useMemo(
    () => employees
      .filter((employee) =>
        employee.isActive
        && employee.employeeId > 0
        && employee.employeeId !== assignment.employeeId
        && !unavailableEmployeeIds.has(employee.employeeId))
      .sort((left, right) => left.fullName.localeCompare(right.fullName, 'he')),
    [assignment.employeeId, employees, unavailableEmployeeIds],
  );
  const selectedEmployee = activeEmployees.find(
    (employee) => employee.employeeId === selectedEmployeeId,
  );
  const hasAlternative = activeEmployees.length > 0;

  return (
    <div className="editTaskDrawer__assignmentEditor">
      <div className="editTaskDrawer__currentEmployee">
        <div className="editTaskDrawer__employeeCard">
          <span>עובד משובץ כעת</span>
          <strong>{assignment.employeeName || `עובד #${assignment.employeeId ?? ''}`}</strong>
          <p>מקצועות: {formatEmployeeProfessions(currentEmployee, assignment.assignmentRole)}</p>
        </div>
        {!isReplacementOpen && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsReplacementOpen(true)}
          >
            החלף עובד
          </Button>
        )}
      </div>

      {isReplacementOpen && (
        <div className="editTaskDrawer__replacementControls">
          {hasAlternative ? (
            <>
              <Select
                label="בחר עובד מחליף"
                value={selectedEmployeeId == null ? '' : String(selectedEmployeeId)}
                onChange={(event) => {
                  const parsedEmployeeId = Number(event.target.value);
                  onSelectedEmployeeChange(
                    Number.isInteger(parsedEmployeeId) && parsedEmployeeId > 0
                      ? parsedEmployeeId
                      : null,
                  );
                }}
              >
                <option value="">בחר עובד פעיל</option>
                {activeEmployees.map((employee) => (
                  <option key={employee.employeeId} value={employee.employeeId}>
                    {employee.fullName || `עובד #${employee.employeeId}`}
                  </option>
                ))}
              </Select>
              {selectedEmployee && (
                <div className="editTaskDrawer__selectedEmployee" aria-live="polite">
                  <strong>עובד מחליף: {selectedEmployee.fullName}</strong>
                  <p>מקצועות: {formatEmployeeProfessions(selectedEmployee)}</p>
                </div>
              )}
            </>
          ) : (
            <InlineAlert variant="warning">
              אין עובד פעיל נוסף שניתן לבחור עבור שיוך זה.
            </InlineAlert>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onSelectedEmployeeChange(null);
              setIsReplacementOpen(false);
            }}
          >
            בטל החלפה
          </Button>
        </div>
      )}
    </div>
  );
}

function EditTaskForm({
  isOpen,
  isMaximized,
  onToggleMaximize,
  task,
  taskId,
  initialValues,
  workItem,
  assignments,
  employees,
  canEdit,
  onClose,
  onSaved,
}: EditTaskFormProps) {
  const queryClient = useQueryClient();
  const initialSchedule = hydratePlannedScheduleFromUtc(
    initialValues.plannedStart,
    initialValues.plannedEnd,
  );
  const isServiceCall =
    workItem?.taskCategory === 'ServiceCall' || workItem?.workType === 'ServiceCall';
  const isLocked = Boolean(workItem?.isLocked ?? task.isLocked);

  const [title, setTitle] = useState(initialValues.title || '');
  const [description, setDescription] = useState(initialValues.description || '');
  const [plannedStartDate, setPlannedStartDate] = useState(initialSchedule.startDate);
  const [plannedStartTime, setPlannedStartTime] = useState(initialSchedule.startTime);
  const [plannedEndDate, setPlannedEndDate] = useState(initialSchedule.endDate);
  const [plannedEndTime, setPlannedEndTime] = useState(initialSchedule.endTime);
  const [priority, setPriority] = useState<string>(
    normalizeWorkPlanPriorityCode(initialValues.priority) ?? WORKPLAN_PRIORITY_OPTIONS[1].code,
  );
  const [requiredRoles, setRequiredRoles] = useState<string[]>(() =>
    normalizeRequiredProfessions(
      initialValues.requiredRoles?.length
        ? initialValues.requiredRoles
        : initialValues.requiredRole
          ? [initialValues.requiredRole]
          : [],
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [replacementEmployeeIds, setReplacementEmployeeIds] = useState<
    Record<number, number | null>
  >({});
  const [stagedSmartReplacement, setStagedSmartReplacement] =
    useState<StagedSmartReplacement | null>(null);

  const rolesQuery = useEmployeePrimaryRoles(isOpen);
  const availableRoles = useMemo(
    () =>
      (rolesQuery.data ?? []).filter(
        (role) => !isRequiredProfessionSelected(requiredRoles, role),
      ),
    [requiredRoles, rolesQuery.data],
  );
  const directAssignments = useMemo(
    () => assignments.filter((assignment) =>
      assignment.workItemId === taskId
      && assignment.assignmentSource === 'Task'
      && (assignment.workEmployeeAssignmentId ?? 0) > 0),
    [assignments, taskId],
  );
  const primaryAssignment = directAssignments[0] ?? null;
  const assignedEmployeeIds = useMemo(
    () => new Set(
      directAssignments
        .map((assignment) => assignment.employeeId)
        .filter((employeeId): employeeId is number => employeeId != null && employeeId > 0),
    ),
    [directAssignments],
  );
  const selectedReplacementEmployeeIds = useMemo(
    () => new Set(
      Object.values(replacementEmployeeIds)
        .filter((employeeId): employeeId is number => employeeId != null && employeeId > 0),
    ),
    [replacementEmployeeIds],
  );

  const scheduleParts = useMemo(
    (): PlannedScheduleParts => ({
      startDate: plannedStartDate,
      startTime: plannedStartTime,
      endDate: plannedEndDate,
      endTime: plannedEndTime,
    }),
    [plannedStartDate, plannedStartTime, plannedEndDate, plannedEndTime],
  );

  const derivedDurationMinutes = useMemo(
    () => deriveDurationFromParts(scheduleParts),
    [scheduleParts],
  );

  const isRecommendationInputDirty = useMemo(
    () => hasUnsavedRecommendationAffectingChanges({
      persisted: {
        plannedStart: initialValues.plannedStart,
        plannedEnd: initialValues.plannedEnd,
        priority: initialValues.priority,
        requiredRole: initialValues.requiredRole,
        requiredRoles: initialValues.requiredRoles,
      },
      scheduleParts,
      priority,
      requiredRoles,
    }),
    [
      initialValues.plannedEnd,
      initialValues.plannedStart,
      initialValues.priority,
      initialValues.requiredRole,
      initialValues.requiredRoles,
      priority,
      requiredRoles,
      scheduleParts,
    ],
  );

  const showSmartRerun = canExposeSavedTaskSmartRerun({
    canEdit,
    isLocked,
    hasDirectAssignment: primaryAssignment != null,
  });

  const stagedSmartRerunSelection: StagedSmartRerunSelection | null =
    stagedSmartReplacement && primaryAssignment
      ? {
          employeeId: stagedSmartReplacement.employeeId,
          employeeName: employees.find(
            (employee) => employee.employeeId === stagedSmartReplacement.employeeId,
          )?.fullName
            ?? `עובד #${stagedSmartReplacement.employeeId}`,
          recommendationRunId: stagedSmartReplacement.recommendationRunId,
        }
      : null;

  function clearSmartStagingForAssignment(assignmentId: number) {
    setStagedSmartReplacement((current) =>
      current?.assignmentId === assignmentId ? null : current);
  }

  function handleStageSmartSelection(selection: StagedSmartRerunSelection | null) {
    if (!primaryAssignment || (primaryAssignment.workEmployeeAssignmentId ?? 0) <= 0) {
      setStagedSmartReplacement(null);
      return;
    }

    const assignmentId = primaryAssignment.workEmployeeAssignmentId!;
    if (!selection) {
      setStagedSmartReplacement(null);
      return;
    }

    // Selecting the currently assigned employee must not stage a replacement.
    if (selection.employeeId === primaryAssignment.employeeId) {
      setReplacementEmployeeIds((current) => ({
        ...current,
        [assignmentId]: null,
      }));
      setStagedSmartReplacement(null);
      return;
    }

    setReplacementEmployeeIds((current) => ({
      ...current,
      [assignmentId]: selection.employeeId,
    }));
    setStagedSmartReplacement({
      assignmentId,
      employeeId: selection.employeeId,
      recommendationRunId: selection.recommendationRunId,
    });
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!workItem) {
        throw new Error('לא נטענו נתוני המשימה');
      }
      if (isLocked || !canEdit) {
        throw new Error('אין הרשאה לשמור שינויים במשימה זו.');
      }

      if (!title.trim()) throw new Error('יש להזין כותרת משימה');
      const plannedTimeRange = validatePlannedUtcRange(scheduleParts);
      const requiredRole = legacyRequiredRole(requiredRoles);
      const pendingReplacements = buildPendingAssignmentReplacements({
        directAssignments,
        replacementEmployeeIds,
        stagedSmartReplacement,
      });
      const uniqueReplacementEmployeeIds = new Set(
        pendingReplacements.map((replacement) =>
          replacement.kind === 'smart'
            ? replacement.request.employeeId
            : replacement.employeeId),
      );
      if (uniqueReplacementEmployeeIds.size !== pendingReplacements.length) {
        throw new Error('לא ניתן לבחור את אותו עובד חלופי עבור יותר משיוך אחד.');
      }
      if (pendingReplacements.some((replacement) => {
        const employeeId = replacement.kind === 'smart'
          ? replacement.request.employeeId
          : replacement.employeeId;
        return !employees.some(
          (employee) => employee.employeeId === employeeId && employee.isActive,
        );
      })) {
        throw new Error('ניתן לבחור רק עובד פעיל כעובד חלופי.');
      }

      const manualEmployeeReplacements = toManualEmployeeReplacementRequests(pendingReplacements);
      const smartReplacements = getSmartPendingReplacements(pendingReplacements);

      if (isServiceCall) {
        await updateServiceCallAsync(taskId, {
          title: title.trim(),
          description: description.trim() || null,
          billingType: workItem.billingType || 'Hourly',
          customerId: workItem.customerId ?? 0,
          siteId: workItem.siteId ?? 0,
          priority: priority || null,
          plannedStart: plannedTimeRange.plannedStart,
          plannedEnd: plannedTimeRange.plannedEnd,
          requiredRole,
          requiredRoles,
          isLocked: workItem.isLocked,
          actualStart: workItem.actualStart ?? null,
          actualEnd: workItem.actualEnd ?? null,
          actualHours: workItem.actualHours ?? null,
          employeeReplacements: manualEmployeeReplacements,
        });
      } else {
        await updateWorkItemAsync(taskId, {
          title: title.trim(),
          description: description.trim() || null,
          billingType: workItem.billingType || 'Hourly',
          workType: workItem.workType,
          taskCategory: workItem.taskCategory,
          customerId: workItem.customerId,
          siteId: workItem.siteId,
          parentWorkItemId: workItem.parentWorkItemId,
          milestoneId: workItem.milestoneId,
          plannedStart: plannedTimeRange.plannedStart,
          plannedEnd: plannedTimeRange.plannedEnd,
          priority: priority || null,
          requiredRole,
          requiredRoles,
          isLocked: workItem.isLocked,
          dealCloseDate: workItem.dealCloseDate ?? null,
          financeProjectNumber: workItem.financeProjectNumber ?? null,
          invoiceNumber: workItem.invoiceNumber ?? null,
          actualStart: workItem.actualStart ?? null,
          actualEnd: workItem.actualEnd ?? null,
          actualHours: workItem.actualHours ?? null,
          employeeReplacements: manualEmployeeReplacements,
        });
      }

      for (const smartReplacement of smartReplacements) {
        await replaceEmployeeAssignmentAsync(
          taskId,
          smartReplacement.assignmentId,
          smartReplacement.request,
        );
      }

      return pendingReplacements;
    },
    onSuccess: async (pendingReplacements) => {
      const previousEmployeeIds = pendingReplacements.map(
        (replacement) => replacement.previousEmployeeId,
      );
      const nextEmployeeIds = pendingReplacements.map((replacement) =>
        replacement.kind === 'smart'
          ? replacement.request.employeeId
          : replacement.employeeId);

      await cancelStaleAssignmentFeedbackQueries(queryClient, {
        workItemId: taskId,
        previousEmployeeIds,
      });

      await Promise.all([
        invalidateWorkPlanQueries(queryClient, workItem?.parentWorkItemId),
        ...(isServiceCall
          ? [queryClient.invalidateQueries({ queryKey: ['serviceCalls'] })]
          : []),
      ]);

      purgeStaleAssignmentFeedbackQueries(queryClient, {
        workItemId: taskId,
        previousEmployeeIds,
        nextEmployeeIds,
      });

      onSaved?.();
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'שמירת המשימה נכשלה');
    },
  });

  const isBusy = saveMutation.isPending;

  function addProfession(value: string) {
    setRequiredRoles((current) => addRequiredProfession(current, value));
  }

  function removeProfession(value: string) {
    setRequiredRoles((current) => removeRequiredProfession(current, value));
  }

  const footer = (
    <div className="editTaskDrawer__footerContent">
      {error && <InlineAlert variant="danger">{error}</InlineAlert>}
      <div className="editTaskDrawer__actions">
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          isLoading={saveMutation.isPending}
          disabled={isBusy || !workItem || isLocked || !canEdit}
        >
          שמור
        </Button>
        <Button type="button" variant="secondary" onClick={onClose} disabled={isBusy}>
          בטל שינויים
        </Button>
      </div>
    </div>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="עריכת משימה"
      isMaximized={isMaximized}
      onToggleMaximize={onToggleMaximize}
      footer={footer}
    >
      <div className="editTaskDrawer__body">
        {!workItem && (
          <p className="editTaskDrawer__hint" role="status">
            טוען את פרטי המשימה המלאים…
          </p>
        )}

        <section className="editTaskDrawer__section">
          <h3 className="editTaskDrawer__sectionTitle">פרטי משימה</h3>
          {workItem?.taskCategory && (
            <p className="editTaskDrawer__hint">
              סוג: {getTaskCategoryLabel(workItem.taskCategory)}
            </p>
          )}
          <Input
            label="כותרת משימה"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />

          <Textarea
            label="תיאור"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </section>

        <section className="editTaskDrawer__section">
          <h3 className="editTaskDrawer__sectionTitle">תזמון</h3>
          <div className="editTaskDrawer__grid">
            <Input
              label="תאריך התחלה"
              type="date"
              value={plannedStartDate}
              onChange={(event) => setPlannedStartDate(event.target.value)}
            />
            <Input
              label="שעת התחלה"
              type="time"
              value={plannedStartTime}
              onChange={(event) => setPlannedStartTime(event.target.value)}
            />
            <Input
              label="תאריך סיום"
              type="date"
              value={plannedEndDate}
              onChange={(event) => setPlannedEndDate(event.target.value)}
            />
            <Input
              label="שעת סיום"
              type="time"
              value={plannedEndTime}
              onChange={(event) => setPlannedEndTime(event.target.value)}
            />
            <Input
              label="סה״כ זמן (מחושב)"
              value={formatDurationMinutes(derivedDurationMinutes)}
              readOnly
            />
          </div>
        </section>

        <section className="editTaskDrawer__section">
          <h3 className="editTaskDrawer__sectionTitle">סיווג</h3>
          <div className="editTaskDrawer__grid">
            <Select
              label="דחיפות"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            >
              {WORKPLAN_PRIORITY_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.display}
                </option>
              ))}
            </Select>
            <div className="editTaskDrawer__professionsField">
              <ListSelect
                label="מקצועות נדרשים"
                value=""
                onChange={addProfession}
                placeholder={rolesQuery.isLoading ? 'טוען מקצועות…' : 'בחר מקצוע להוספה'}
                searchable
                searchPlaceholder="חיפוש מקצוע..."
                emptyMessage="אין מקצועות נוספים לבחירה."
                disabled={rolesQuery.isLoading || rolesQuery.isError}
                options={
                  availableRoles.length === 0
                    ? [
                        {
                          value: '__none__',
                          label: rolesQuery.isLoading
                            ? 'טוען מקצועות…'
                            : 'אין מקצועות נוספים לבחירה',
                          disabled: true,
                        },
                      ]
                    : availableRoles.map((option) => ({ value: option, label: option }))
                }
              />
              {requiredRoles.length > 0 && (
                <ul className="editTaskDrawer__professionChips" aria-label="מקצועות שנבחרו">
                  {requiredRoles.map((role) => (
                    <li key={role} className="editTaskDrawer__professionChip">
                      <span>{role}</span>
                      <button
                        type="button"
                        className="editTaskDrawer__professionRemove"
                        onClick={() => removeProfession(role)}
                        aria-label={`הסר את המקצוע ${role}`}
                      >
                        הסר
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {rolesQuery.isError && (
            <InlineAlert variant="danger">
              <span>טעינת המקצועות נכשלה.</span>
              <Button type="button" variant="secondary" onClick={() => rolesQuery.refetch()}>
                נסה שוב
              </Button>
            </InlineAlert>
          )}
        </section>

        <section className="editTaskDrawer__section">
          <h3 className="editTaskDrawer__sectionTitle">שיוך עובדים</h3>
          <p className="editTaskDrawer__hint">
            לעדכון הנתונים לחץ שמור.
          </p>
          {directAssignments.length > 0 ? (
            <div className="editTaskDrawer__assignmentEditors">
              {directAssignments.map((assignment, index) => {
                const assignmentId = assignment.workEmployeeAssignmentId ?? 0;
                const selectedEmployeeId = replacementEmployeeIds[assignmentId] ?? null;
                const unavailableEmployeeIds = new Set([
                  ...assignedEmployeeIds,
                  ...selectedReplacementEmployeeIds,
                ]);
                if (selectedEmployeeId != null) unavailableEmployeeIds.delete(selectedEmployeeId);
                return (
                  <AssignmentReplacementEditor
                    key={`${assignmentId || index}:${assignment.employeeId ?? 'none'}`}
                    assignment={assignment}
                    employees={employees}
                    unavailableEmployeeIds={unavailableEmployeeIds}
                    selectedEmployeeId={selectedEmployeeId}
                    onSelectedEmployeeChange={(employeeId) => {
                      clearSmartStagingForAssignment(assignmentId);
                      setReplacementEmployeeIds((current) => ({
                        ...current,
                        [assignmentId]: employeeId,
                      }));
                    }}
                  />
                );
              })}
            </div>
          ) : (
            <InlineAlert variant="info">
              אין למשימה שיוך עובד ישיר שניתן להחליף.
            </InlineAlert>
          )}

          {showSmartRerun && (
            <SmartRerunPanel
              task={task}
              isRecommendationInputDirty={isRecommendationInputDirty}
              stagedSelection={stagedSmartRerunSelection}
              onStageSelection={handleStageSmartSelection}
              disabled={isBusy || !workItem}
            />
          )}
        </section>
      </div>
    </Drawer>
  );
}
