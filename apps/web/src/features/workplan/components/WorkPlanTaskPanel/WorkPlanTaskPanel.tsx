import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ComponentProps } from 'react';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { Modal } from '@shared/components/Modal';
import { EditTaskDrawer } from '../EditTaskDrawer';
import {
  getWorkPlanPriorityDisplay,
  getWorkPlanStatusDisplay,
  isWorkPlanStatusDone,
  isWorkPlanStatusInProgress,
} from '../../constants';
import { formatHourAsTime } from '../../lib/workPlanScheduling';
import type { WorkPlanTaskSelection } from '../../types';
import './WorkPlanTaskPanel.css';

const QUICK_REPORT_KEY = 'manager2_quick_report_prefill';
const WORKPLAN_REFRESH_KEY = 'manager2_workplan_refresh_needed';

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
  onTaskUpdated: () => void;
}

export function WorkPlanTaskPanel({
  task,
  onClose,
  canEdit,
  onTaskUpdated,
}: WorkPlanTaskPanelProps) {
  const navigate = useNavigate();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  if (!task) return null;

  function handleQuickReport() {
    if (!task) return;

    const today = new Date().toISOString().slice(0, 10);
    const prefill = {
      date: today,
      projectId: task.projectId,
      projectName: task.projectTitle,
      start: formatHourAsTime(task.startHour),
      end: formatHourAsTime(task.endHour),
      reporterName: task.assigneeName !== '—' ? task.assigneeName : '',
      reporterRole: task.requiredRole || '',
      taskAssigneeName: task.assigneeName,
    };

    sessionStorage.setItem(QUICK_REPORT_KEY, JSON.stringify(prefill));
    sessionStorage.setItem(WORKPLAN_REFRESH_KEY, '1');
    navigate('/reports?quick=1');
  }

  const permissionTone = task.isLocked ? 'locked' : canEdit ? 'allowed' : 'blocked';
  const permissionMessage = task.isLocked
    ? 'משימה נעולה — לא ניתן לערוך.'
    : canEdit
      ? 'יש הרשאה לעריכה.'
      : 'אין הרשאה לעריכה בחתך הנוכחי.';

  const plannedDate = formatPlannedDate(task.plannedStart);
  const description = task.description?.trim();

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        title="פרטי משימה"
        isMaximized={isMaximized}
        onToggleMaximize={() => setIsMaximized((value) => !value)}
      >
        <div className="workPlanTaskPanel">
          <div className="workPlanTaskPanel__intro">
            <p className="workPlanTaskPanel__project">{task.projectTitle}</p>
            <h3 className="workPlanTaskPanel__title">{task.title}</h3>
            <Badge variant={resolveStatusVariant(task.status)}>
              {getWorkPlanStatusDisplay(task.status)}
            </Badge>
          </div>

          <dl className="workPlanTaskPanel__meta">
            <div className="workPlanTaskPanel__metaRow">
              <dt>מבצע</dt>
              <dd>{task.assigneeName}</dd>
            </div>
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
            {task.requiredRole && (
              <div className="workPlanTaskPanel__metaRow">
                <dt>תפקיד נדרש</dt>
                <dd>{task.requiredRole}</dd>
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

          <div className="workPlanTaskPanel__footer">
            <p className={`workPlanTaskPanel__perms workPlanTaskPanel__perms--${permissionTone}`}>
              {permissionMessage}
            </p>
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
            </div>
          </div>
        </div>
      </Modal>

      <EditTaskDrawer
        isOpen={isEditOpen}
        task={task}
        onClose={() => setIsEditOpen(false)}
        onSaved={() => {
          setIsEditOpen(false);
          onTaskUpdated();
        }}
      />
    </>
  );
}
