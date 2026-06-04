import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Drawer } from '@shared/components/Drawer';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { PageSpinner } from '@shared/components/PageSpinner';
import { isLocalDataMode } from '@/config/appConfig';
import { getWorkItemByIdAsync, updateWorkItemAsync } from '../../api/workplanApiClient';
import {
  normalizeWorkPlanPriorityCode,
  normalizeWorkPlanStatusCode,
  WORKPLAN_PRIORITY_OPTIONS,
  WORKPLAN_STATUS_OPTIONS,
} from '../../constants';
import type { WorkPlanTaskSelection } from '../../types';
import './EditTaskDrawer.css';

const ROLE_OPTIONS = ['מתקין', 'מנהל פרויקט', 'טכנאי'];

interface EditTaskDrawerProps {
  isOpen: boolean;
  task: WorkPlanTaskSelection | null;
  onClose: () => void;
  onSaved?: () => void;
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
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [plannedStart, setPlannedStart] = useState('');
  const [plannedEnd, setPlannedEnd] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [status, setStatus] = useState<string>(WORKPLAN_STATUS_OPTIONS[0].code);
  const [priority, setPriority] = useState<string>(WORKPLAN_PRIORITY_OPTIONS[1].code);
  const [requiredRole, setRequiredRole] = useState('');
  const [error, setError] = useState<string | null>(null);

  const workItemQuery = useQuery({
    queryKey: ['workplan', 'workItem', task?.taskId],
    queryFn: () => getWorkItemByIdAsync(task!.taskId),
    enabled: isOpen && isLocalDataMode && !!task?.taskId,
  });

  useEffect(() => {
    if (!isOpen || !workItemQuery.data) return;

    const workItem = workItemQuery.data;
    const startParts = splitDateTime(workItem.plannedStart);
    const endParts = splitDateTime(workItem.plannedEnd);

    setTitle(workItem.title || '');
    setDescription(workItem.description || '');
    setPlannedDate(startParts.date || endParts.date);
    setPlannedStart(startParts.time);
    setPlannedEnd(endParts.time);
    setEstimatedHours(
      workItem.estimatedHours != null ? String(workItem.estimatedHours) : '',
    );
    setStatus(normalizeWorkPlanStatusCode(workItem.status) ?? WORKPLAN_STATUS_OPTIONS[0].code);
    setPriority(normalizeWorkPlanPriorityCode(workItem.priority) ?? WORKPLAN_PRIORITY_OPTIONS[1].code);
    setRequiredRole(workItem.requiredRole || '');
    setError(null);
  }, [isOpen, workItemQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!isLocalDataMode) {
        throw new Error('עריכת משימות זמינה רק בחיבור לשרת אמיתי');
      }

      const workItem = workItemQuery.data;
      if (!workItem || !task) {
        throw new Error('לא נטענו נתוני המשימה');
      }

      if (!title.trim()) throw new Error('יש להזין כותרת משימה');
      const plannedTimeRange = validatePlannedTimeRange(plannedDate, plannedStart, plannedEnd);

      await updateWorkItemAsync(task.taskId, {
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
        parentWorkItemId: workItem.parentWorkItemId,
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

  function handleClose() {
    setError(null);
    onClose();
  }

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} title="עריכת משימה">
      <form
        className="editTaskDrawer"
        onSubmit={(event) => {
          event.preventDefault();
          saveMutation.mutate();
        }}
      >
        {workItemQuery.isLoading && <PageSpinner />}
        {workItemQuery.error && (
          <p className="editTaskDrawer__error">
            {workItemQuery.error instanceof Error
              ? workItemQuery.error.message
              : 'טעינת המשימה נכשלה'}
          </p>
        )}

        {!workItemQuery.isLoading && !workItemQuery.error && (
          <>
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
          </>
        )}

        {error && <p className="editTaskDrawer__error">{error}</p>}

        <div className="editTaskDrawer__actions">
          <Button type="submit" disabled={saveMutation.isPending || workItemQuery.isLoading}>
            {saveMutation.isPending ? 'שומר...' : 'שמור'}
          </Button>
          <Button type="button" variant="secondary" onClick={handleClose}>
            ביטול
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
