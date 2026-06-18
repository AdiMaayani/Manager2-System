import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Drawer, useDrawerMaximize } from '@shared/components/Drawer';
import { Button } from '@shared/components/Button';
import { ErrorState } from '@shared/components/ErrorState';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { Textarea } from '@shared/components/Textarea';
import { InlineAlert } from '@shared/components/InlineAlert';
import { isLocalDataMode } from '@/config/appConfig';
import { getWorkItemByIdAsync, updateWorkItemAsync } from '../../api/workplanApiClient';
import {
  normalizeWorkPlanPriorityCode,
  normalizeWorkPlanStatusCode,
  WORKPLAN_PRIORITY_OPTIONS,
  WORKPLAN_STATUS_OPTIONS,
} from '../../constants';
import type { WorkItemResponse, WorkPlanTaskSelection } from '../../types';
import './EditTaskDrawer.css';

const ROLE_OPTIONS = ['מתקין', 'מנהל פרויקט', 'טכנאי'];

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
}

function splitDateTime(value?: string | null): { date: string; time: string } {
  if (!value) return { date: '', time: '' };
  const [datePart, timePart = ''] = value.split('T');
  return { date: datePart, time: timePart.slice(0, 5) };
}

function combineDateAndTime(date: string, time: string): string | null {
  if (!date || !time) return null;
  return `${date}T${time}:00`;
}

function validatePlannedTimeRange(date: string, startTime: string, endTime: string): {
  plannedStart: string;
  plannedEnd: string;
} {
  if (!date) throw new Error('יש להזין תאריך מתוכנן.');
  if (!startTime) throw new Error('יש להזין זמן התחלה מתוכנן.');
  if (!endTime) throw new Error('יש להזין זמן סיום מתוכנן.');

  const plannedStart = combineDateAndTime(date, startTime);
  const plannedEnd = combineDateAndTime(date, endTime);
  const plannedStartDate = plannedStart ? new Date(plannedStart) : null;
  const plannedEndDate = plannedEnd ? new Date(plannedEnd) : null;

  if (!plannedStart || !plannedStartDate || Number.isNaN(plannedStartDate.getTime())) {
    throw new Error('יש להזין זמן התחלה מתוכנן.');
  }

  if (!plannedEnd || !plannedEndDate || Number.isNaN(plannedEndDate.getTime())) {
    throw new Error('יש להזין זמן סיום מתוכנן.');
  }

  if (plannedEndDate <= plannedStartDate) {
    throw new Error('זמן הסיום חייב להיות אחרי זמן ההתחלה.');
  }

  return { plannedStart, plannedEnd };
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
    enabled: isOpen && isLocalDataMode && !!task?.taskId,
  });

  const closeFooter = (
    <div className="editTaskDrawer__actions">
      <Button type="button" variant="secondary" onClick={onClose}>
        סגור
      </Button>
    </div>
  );

  if (!isLocalDataMode) {
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
          <p className="editTaskDrawer__notice">
            עריכת משימות אינה זמינה במצב נתוני דמו. יש להפעיל את האפליקציה במצב חיבור לשרת
            (VITE_APP_DATA_MODE=local) כדי לערוך ולשמור משימות.
          </p>
        </div>
      </Drawer>
    );
  }

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
  const initialStartParts = splitDateTime(initialValues.plannedStart);
  const initialEndParts = splitDateTime(initialValues.plannedEnd);

  const [title, setTitle] = useState(initialValues.title || '');
  const [description, setDescription] = useState(initialValues.description || '');
  const [plannedDate, setPlannedDate] = useState(initialStartParts.date || initialEndParts.date);
  const [plannedStart, setPlannedStart] = useState(initialStartParts.time);
  const [plannedEnd, setPlannedEnd] = useState(initialEndParts.time);
  const [estimatedHours, setEstimatedHours] = useState(
    initialValues.estimatedHours != null ? String(initialValues.estimatedHours) : '',
  );
  const [status, setStatus] = useState<string>(
    normalizeWorkPlanStatusCode(initialValues.status) ?? WORKPLAN_STATUS_OPTIONS[0].code,
  );
  const [priority, setPriority] = useState<string>(
    normalizeWorkPlanPriorityCode(initialValues.priority) ?? WORKPLAN_PRIORITY_OPTIONS[1].code,
  );
  const [requiredRole, setRequiredRole] = useState(initialValues.requiredRole || '');
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!workItem) {
        throw new Error('לא נטענו נתוני המשימה');
      }

      if (!title.trim()) throw new Error('יש להזין כותרת משימה');
      const plannedTimeRange = validatePlannedTimeRange(plannedDate, plannedStart, plannedEnd);

      await updateWorkItemAsync(taskId, {
        title: title.trim(),
        description: description.trim() || null,
        status,
        billingType: workItem.billingType || 'Hourly',
        workType: workItem.workType,
        customerId: workItem.customerId,
        siteId: workItem.siteId,
        plannedStart: plannedTimeRange.plannedStart,
        plannedEnd: plannedTimeRange.plannedEnd,
        estimatedHours: estimatedHours ? Number(estimatedHours) : null,
        priority: priority || null,
        requiredRole: requiredRole || null,
        isLocked: workItem.isLocked,
        // Preserve fields the form does not edit; the backend update replaces
        // every column, so omitting these would wipe them to NULL.
        dealCloseDate: workItem.dealCloseDate ?? null,
        financeProjectNumber: workItem.financeProjectNumber ?? null,
        invoiceNumber: workItem.invoiceNumber ?? null,
        actualStart: workItem.actualStart ?? null,
        actualEnd: workItem.actualEnd ?? null,
        actualHours: workItem.actualHours ?? null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workplan'] });
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
              label="תאריך מתוכנן"
              type="date"
              value={plannedDate}
              onChange={(event) => setPlannedDate(event.target.value)}
            />
            <Input
              label="שעת התחלה"
              type="time"
              value={plannedStart}
              onChange={(event) => setPlannedStart(event.target.value)}
            />
            <Input
              label="שעת סיום"
              type="time"
              value={plannedEnd}
              onChange={(event) => setPlannedEnd(event.target.value)}
            />
            <Input
              label="הערכת שעות"
              type="number"
              min="0"
              step="0.5"
              value={estimatedHours}
              onChange={(event) => setEstimatedHours(event.target.value)}
            />
          </div>
        </section>

        <section className="editTaskDrawer__section">
          <h3 className="editTaskDrawer__sectionTitle">סיווג</h3>
          <div className="editTaskDrawer__grid">
            <Select
              label="סטטוס"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {WORKPLAN_STATUS_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.display}
                </option>
              ))}
            </Select>
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
            <Select
              label="תפקיד נדרש"
              value={requiredRole}
              onChange={(event) => setRequiredRole(event.target.value)}
            >
              <option value="">בחר תפקיד</option>
              {ROLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
        </section>
      </div>
    </Drawer>
  );
}
