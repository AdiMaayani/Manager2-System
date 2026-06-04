import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { EditTaskDrawer } from '../EditTaskDrawer';
import { getWorkPlanPriorityDisplay, getWorkPlanStatusDisplay } from '../../constants';
import { formatHourAsTime } from '../../lib/workPlanScheduling';
import type { WorkPlanTaskSelection } from '../../types';
import './WorkPlanTaskPanel.css';

const QUICK_REPORT_KEY = 'manager2_quick_report_prefill';
const WORKPLAN_REFRESH_KEY = 'manager2_workplan_refresh_needed';

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

  return (
    <aside className="workPlanTaskPanel" aria-label="פרטי משימה">
      <div className="workPlanTaskPanel__header">
        <h3>פרטי משימה</h3>
        <button type="button" className="workPlanTaskPanel__close" onClick={onClose} aria-label="סגור">
          ×
        </button>
      </div>

      <div className="workPlanTaskPanel__body">
        <p className="workPlanTaskPanel__project">{task.projectTitle}</p>
        <h4 className="workPlanTaskPanel__title">{task.title}</h4>

        <dl className="workPlanTaskPanel__meta">
          <div>
            <dt>מבצע</dt>
            <dd>{task.assigneeName}</dd>
          </div>
          <div>
            <dt>שעות</dt>
            <dd>
              {formatHourAsTime(task.startHour)} – {formatHourAsTime(task.endHour)}
            </dd>
          </div>
          <div>
            <dt>סטטוס</dt>
            <dd>
              <Badge variant="neutral">{getWorkPlanStatusDisplay(task.status)}</Badge>
            </dd>
          </div>
          {task.priority && (
            <div>
              <dt>עדיפות</dt>
              <dd>{getWorkPlanPriorityDisplay(task.priority)}</dd>
            </div>
          )}
          {task.requiredRole && (
            <div>
              <dt>תפקיד נדרש</dt>
              <dd>{task.requiredRole}</dd>
            </div>
          )}
          {task.estimatedHours != null && (
            <div>
              <dt>שעות משוערות</dt>
              <dd>{task.estimatedHours}</dd>
            </div>
          )}
        </dl>

        <p className="workPlanTaskPanel__perms">
          {task.isLocked
            ? 'משימה נעולה — לא ניתן לערוך.'
            : canEdit
              ? 'יש הרשאה לעריכה.'
              : 'אין הרשאה לעריכה בחתך הנוכחי.'}
        </p>

        <div className="workPlanTaskPanel__actions">
          <Button
            type="button"
            variant="secondary"
            disabled={!canEdit || task.isLocked}
            onClick={() => setIsEditOpen(true)}
          >
            עריכה
          </Button>
          <Button type="button" variant="ghost" onClick={handleQuickReport}>
            דיווח מהיר
          </Button>
        </div>
      </div>

      <EditTaskDrawer
        isOpen={isEditOpen}
        task={task}
        onClose={() => setIsEditOpen(false)}
        onSaved={() => {
          setIsEditOpen(false);
          onTaskUpdated();
        }}
      />
    </aside>
  );
}
