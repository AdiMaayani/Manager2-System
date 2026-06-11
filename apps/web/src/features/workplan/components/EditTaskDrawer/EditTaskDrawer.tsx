import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Drawer } from '@shared/components/Drawer';
import { Button } from '@shared/components/Button';
import { ErrorState } from '@shared/components/ErrorState';
import { Input } from '@shared/components/Input';
import { isLocalDataMode } from '@/config/appConfig';
import {
  cancelWorkPlanTaskAsync,
  getWorkItemByIdAsync,
  updateWorkItemAsync,
} from '../../api/workplanApiClient';
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
  const workItemQuery = useQuery({
    queryKey: ['workplan', 'workItem', task?.taskId],
    queryFn: () => getWorkItemByIdAsync(task!.taskId),
    enabled: isOpen && isLocalDataMode && !!task?.taskId,
  });

  if (!isLocalDataMode) {
    return (
      <Drawer isOpen={isOpen} onClose={onClose} title="עריכת משימה">
        <div className="editTaskDrawer">
          <div className="editTaskDrawer__body">
            <p className="editTaskDrawer__notice">
              עריכת משימות אינה זמינה במצב נתוני דמו. יש להפעיל את האפליקציה במצב חיבור לשרת
              (VITE_APP_DATA_MODE=local) כדי לערוך ולשמור משימות.
            </p>
          </div>
          <div className="editTaskDrawer__footer">
            <div className="editTaskDrawer__actions">
              <Button type="button" variant="secondary" onClick={onClose}>
                סגור
              </Button>
            </div>
          </div>
        </div>
      </Drawer>
    );
  }

  if (workItemQuery.isError) {
    return (
      <Drawer isOpen={isOpen} onClose={onClose} title="עריכת משימה">
        <div className="editTaskDrawer">
          <div className="editTaskDrawer__body">
            <ErrorState
              message="טעינת פרטי המשימה נכשלה — לא ניתן לערוך ללא הנתונים המלאים."
              onRetry={() => workItemQuery.refetch()}
            />
          </div>
          <div className="editTaskDrawer__footer">
            <div className="editTaskDrawer__actions">
              <Button type="button" variant="secondary" onClick={onClose}>
                סגור
              </Button>
            </div>
          </div>
        </div>
      </Drawer>
    );
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="עריכת משימה">
      {task && (
        <EditTaskForm
          // Seed from the selection right away, then remount with the
          // authoritative work item once it loads so fields are never empty.
          key={`${task.taskId}-${workItemQuery.data ? 'hydrated' : 'seed'}`}
          taskId={task.taskId}
          initialValues={workItemQuery.data ?? task}
          workItem={workItemQuery.data ?? null}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Drawer>
  );
}

interface EditTaskFormProps {
  taskId: number;
  initialValues: EditableTaskFieldsSource;
  // Full work item is required for saving: the backend PUT replaces every
  // column, so untouched fields must be echoed back from this record.
  workItem: WorkItemResponse | null;
  onClose: () => void;
  onSaved?: () => void;
}

function EditTaskForm({ taskId, initialValues, workItem, onClose, onSaved }: EditTaskFormProps) {
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
  const [confirmCancelTask, setConfirmCancelTask] = useState(false);

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

  // Soft-cancels the task through the existing WorkItems cancel endpoint; the
  // cancelled task drops out of the work plan once the queries refetch.
  const cancelTaskMutation = useMutation({
    mutationFn: () => cancelWorkPlanTaskAsync(taskId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workplan'] });
      onSaved?.();
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'ביטול המשימה נכשל');
    },
  });

  const isBusy = saveMutation.isPending || cancelTaskMutation.isPending;

  return (
    <form
      className="editTaskDrawer"
      onSubmit={(event) => {
        event.preventDefault();
        saveMutation.mutate();
      }}
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

          <label className="editTaskDrawer__field">
            <span>תיאור</span>
            <textarea
              className="editTaskDrawer__textarea"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </label>
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
            <label className="editTaskDrawer__field">
              <span>סטטוס</span>
              <select
                className="editTaskDrawer__select"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                {WORKPLAN_STATUS_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.display}
                  </option>
                ))}
              </select>
            </label>
            <label className="editTaskDrawer__field">
              <span>דחיפות</span>
              <select
                className="editTaskDrawer__select"
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              >
                {WORKPLAN_PRIORITY_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.display}
                  </option>
                ))}
              </select>
            </label>
            <label className="editTaskDrawer__field">
              <span>תפקיד נדרש</span>
              <select
                className="editTaskDrawer__select"
                value={requiredRole}
                onChange={(event) => setRequiredRole(event.target.value)}
              >
                <option value="">בחר תפקיד</option>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      </div>

      <div className="editTaskDrawer__footer">
        {error && <p className="editTaskDrawer__error">{error}</p>}
        <div className="editTaskDrawer__actions">
          <Button type="submit" disabled={isBusy || !workItem}>
            {saveMutation.isPending ? 'שומר...' : 'שמור'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isBusy}>
            בטל שינויים
          </Button>

          {/* Locked tasks keep the existing lock rule: no destructive action. */}
          {workItem && !workItem.isLocked && (
            <div className="editTaskDrawer__dangerActions">
              {confirmCancelTask ? (
                <>
                  <span className="editTaskDrawer__confirmText">לבטל את המשימה?</span>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => cancelTaskMutation.mutate()}
                    disabled={isBusy}
                  >
                    {cancelTaskMutation.isPending ? 'מבטל...' : 'אישור ביטול'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setConfirmCancelTask(false)}
                    disabled={isBusy}
                  >
                    חזור
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setConfirmCancelTask(true)}
                  disabled={isBusy}
                >
                  בטל משימה
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
