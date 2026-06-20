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
import { getWorkItemByIdAsync, updateWorkItemAsync } from '../../api/workplanApiClient';
import { useEmployeePrimaryRoles } from '@features/employees/hooks/useEmployeePrimaryRoles';
import { invalidateWorkPlanQueries } from '../../hooks/useWorkPlanData';
import {
  normalizeWorkPlanPriorityCode,
  WORKPLAN_PRIORITY_OPTIONS,
} from '../../constants';
import type { WorkItemResponse, WorkPlanTaskSelection } from '../../types';
import './EditTaskDrawer.css';

interface EditTaskDrawerProps {
  isOpen: boolean;
  task: WorkPlanTaskSelection | null;
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
  onClose,
  onSaved,
}: EditTaskDrawerProps) {
  // Maximize state lives here (stable) so it survives the EditTaskForm remount on hydration.
  const { isMaximized, toggleMaximize } = useDrawerMaximize(isOpen);

  const workItemQuery = useQuery({
    queryKey: ['workplan', 'workItem', task?.taskId],
    queryFn: () => getWorkItemByIdAsync(task!.taskId),
    enabled: isOpen && !!task?.taskId,
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
        isOpen={isOpen}
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
        isOpen={isOpen}
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
      isOpen={isOpen}
      isMaximized={isMaximized}
      onToggleMaximize={toggleMaximize}
      taskId={task.taskId}
      initialValues={workItemQuery.data ?? task}
      workItem={workItemQuery.data ?? null}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

interface EditTaskFormProps {
  isOpen: boolean;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  taskId: number;
  initialValues: EditableTaskFieldsSource;
  // Full work item is required for saving: the backend PUT replaces every
  // column, so untouched fields must be echoed back from this record.
  workItem: WorkItemResponse | null;
  onClose: () => void;
  onSaved?: () => void;
}

function EditTaskForm({
  isOpen,
  isMaximized,
  onToggleMaximize,
  taskId,
  initialValues,
  workItem,
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

  const [title, setTitle] = useState(initialValues.title || '');
  const [description, setDescription] = useState(initialValues.description || '');
  const [plannedStartDate, setPlannedStartDate] = useState(initialSchedule.startDate);
  const [plannedStartTime, setPlannedStartTime] = useState(initialSchedule.startTime);
  const [plannedEndDate, setPlannedEndDate] = useState(initialSchedule.endDate);
  const [plannedEndTime, setPlannedEndTime] = useState(initialSchedule.endTime);
  const [priority, setPriority] = useState<string>(
    normalizeWorkPlanPriorityCode(initialValues.priority) ?? WORKPLAN_PRIORITY_OPTIONS[1].code,
  );
  const [requiredRole, setRequiredRole] = useState(initialValues.requiredRole || '');
  const [error, setError] = useState<string | null>(null);

  const rolesQuery = useEmployeePrimaryRoles(isOpen);

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

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!workItem) {
        throw new Error('לא נטענו נתוני המשימה');
      }

      if (!title.trim()) throw new Error('יש להזין כותרת משימה');
      const plannedTimeRange = validatePlannedUtcRange(scheduleParts);

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
          requiredRole: requiredRole || null,
          isLocked: workItem.isLocked,
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
          requiredRole: requiredRole || null,
          isLocked: workItem.isLocked,
          dealCloseDate: workItem.dealCloseDate ?? null,
          financeProjectNumber: workItem.financeProjectNumber ?? null,
          invoiceNumber: workItem.invoiceNumber ?? null,
          actualStart: workItem.actualStart ?? null,
          actualEnd: workItem.actualEnd ?? null,
          actualHours: workItem.actualHours ?? null,
        });
      }
    },
    onSuccess: async () => {
      await invalidateWorkPlanQueries(queryClient, workItem?.parentWorkItemId);
      if (isServiceCall) {
        await queryClient.invalidateQueries({ queryKey: ['serviceCalls'] });
      }
      onSaved?.();
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'שמירת המשימה נכשלה');
    },
  });

  const isBusy = saveMutation.isPending;

  const footer = (
    <div className="editTaskDrawer__footerContent">
      {error && <InlineAlert variant="danger">{error}</InlineAlert>}
      <div className="editTaskDrawer__actions">
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          isLoading={saveMutation.isPending}
          disabled={isBusy || !workItem}
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
            <ListSelect
              label="תפקיד נדרש"
              value={requiredRole}
              onChange={setRequiredRole}
              placeholder="בחר תפקיד"
              disabled={rolesQuery.isLoading || rolesQuery.isError}
              options={[
                { value: '', label: rolesQuery.isLoading ? 'טוען תפקידים…' : 'בחר תפקיד' },
                ...(rolesQuery.data ?? []).map((option) => ({ value: option, label: option })),
              ]}
            />
          </div>
          {rolesQuery.isError && (
            <InlineAlert variant="danger">
              טעינת תפקידים נכשלה. יש לפרוס את sp_Employees_GetDistinctPrimaryRoles בבסיס הנתונים.
            </InlineAlert>
          )}
        </section>
      </div>
    </Drawer>
  );
}
