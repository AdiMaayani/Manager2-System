import { HOUR_LABELS } from '../../constants';
import { hourSpanToWidth, hourToPercent } from '../../lib/workPlanScheduling';
import type { ScheduledTaskBar } from '../../types';
import './WorkPlanDailyGrid.css';

interface EmployeeRow {
  employee: { employeeId: number; fullName: string; primaryRole: string };
  tasks: ScheduledTaskBar[];
}

interface ProjectRow {
  projectId: number;
  projectTitle: string;
  tasks: ScheduledTaskBar[];
}

interface WorkPlanDailyGridProps {
  mode: 'employees' | 'projects';
  employeeRows?: EmployeeRow[];
  projectRows?: ProjectRow[];
  onTaskSelect: (task: ScheduledTaskBar) => void;
  selectedTaskId?: number | null;
}

function taskClassName(task: ScheduledTaskBar): string {
  const classes = ['workPlanDailyGrid__task'];
  if (task.isLocked) classes.push('workPlanDailyGrid__task--locked');
  else classes.push('workPlanDailyGrid__task--normal');
  if (task.violationCount > 0) classes.push('workPlanDailyGrid__task--violation');
  else if (task.warningCount > 0) classes.push('workPlanDailyGrid__task--warning');
  return classes.join(' ');
}

function TaskBar({
  task,
  onSelect,
  isSelected,
}: {
  task: ScheduledTaskBar;
  onSelect: (task: ScheduledTaskBar) => void;
  isSelected: boolean;
}) {
  return (
    <button
      type="button"
      className={`${taskClassName(task)} ${isSelected ? 'workPlanDailyGrid__task--selected' : ''}`}
      style={{
        insetInlineStart: `${hourToPercent(task.startHour)}%`,
        width: `${hourSpanToWidth(task.startHour, task.endHour)}%`,
      }}
      onClick={() => onSelect(task)}
      aria-pressed={isSelected}
    >
      <span className="workPlanDailyGrid__taskName">{task.title}</span>
      <span className="workPlanDailyGrid__taskMeta">
        {task.projectTitle} · {task.status}
      </span>
      {(task.violationCount > 0 || task.warningCount > 0 || task.suggestionCount > 0) && (
        <span className="workPlanDailyGrid__taskIndicators" aria-hidden>
          {task.violationCount > 0 && <span className="workPlanDailyGrid__indicator workPlanDailyGrid__indicator--violation" />}
          {task.warningCount > 0 && <span className="workPlanDailyGrid__indicator workPlanDailyGrid__indicator--warning" />}
          {task.suggestionCount > 0 && <span className="workPlanDailyGrid__indicator workPlanDailyGrid__indicator--suggestion" />}
        </span>
      )}
    </button>
  );
}

export function WorkPlanDailyGrid({
  mode,
  employeeRows = [],
  projectRows = [],
  onTaskSelect,
  selectedTaskId,
}: WorkPlanDailyGridProps) {
  const rows =
    mode === 'employees'
      ? employeeRows.map((row) => ({
          key: String(row.employee.employeeId),
          title: row.employee.fullName,
          subtitle: row.employee.primaryRole,
          tasks: row.tasks,
        }))
      : projectRows.map((row) => ({
          key: String(row.projectId),
          title: row.projectTitle,
          subtitle: `פרויקט #${row.projectId}`,
          tasks: row.tasks,
        }));

  return (
    <div className="workPlanDailyGrid workPlanShell">
      <div className="workPlanDailyGrid__grid">
        <div className="workPlanDailyGrid__header">
          <div className="workPlanDailyGrid__headerCell">שם</div>
          <div className="workPlanDailyGrid__hours">
            {HOUR_LABELS.map((label) => (
              <div key={label} className="workPlanDailyGrid__hour">
                {label}
              </div>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="workPlanDailyGrid__empty">אין משימות להצגה בטווח הנבחר</div>
        ) : (
          rows.map((row) => (
            <div key={row.key} className="workPlanDailyGrid__row">
              <div className="workPlanDailyGrid__stickyCol">
                <div className="workPlanDailyGrid__rowTitle">{row.title}</div>
                <div className="workPlanDailyGrid__rowSubtitle">{row.subtitle}</div>
              </div>
              <div className="workPlanDailyGrid__track">
                {row.tasks.map((task) => (
                  <TaskBar
                    key={task.taskId}
                    task={task}
                    onSelect={onTaskSelect}
                    isSelected={selectedTaskId === task.taskId}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
