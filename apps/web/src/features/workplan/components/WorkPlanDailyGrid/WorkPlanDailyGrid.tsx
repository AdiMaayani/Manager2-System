import { getWorkPlanStatusDisplay, HOUR_LABELS } from '../../constants';
import { formatHourAsTime, hourSpanToWidth, hourToPercent } from '../../lib/workPlanScheduling';
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

const LANE_HEIGHT = 56;
const LANE_GAP = 6;
const TRACK_PADDING = 10;

interface PositionedTask {
  task: ScheduledTaskBar;
  lane: number;
}

/**
 * Assigns each task to a vertical lane so that tasks overlapping in time never
 * sit on top of each other. Pure layout — does not alter scheduling values.
 */
function assignLanes(tasks: ScheduledTaskBar[]): { positioned: PositionedTask[]; laneCount: number } {
  const sorted = [...tasks].sort(
    (left, right) => left.startHour - right.startHour || left.endHour - right.endHour,
  );
  const laneEndHours: number[] = [];

  const positioned = sorted.map((task) => {
    let lane = laneEndHours.findIndex((endHour) => endHour <= task.startHour);
    if (lane === -1) {
      lane = laneEndHours.length;
      laneEndHours.push(task.endHour);
    } else {
      laneEndHours[lane] = task.endHour;
    }
    return { task, lane };
  });

  return { positioned, laneCount: Math.max(1, laneEndHours.length) };
}

function taskClassName(task: ScheduledTaskBar): string {
  const classes = ['workPlanDailyGrid__task'];
  if (task.isLocked) classes.push('workPlanDailyGrid__task--locked');
  else classes.push('workPlanDailyGrid__task--normal');
  if (task.violationCount > 0) classes.push('workPlanDailyGrid__task--violation');
  else if (task.warningCount > 0) classes.push('workPlanDailyGrid__task--warning');
  return classes.join(' ');
}

function buildTaskTooltip(task: ScheduledTaskBar): string {
  return [
    task.title,
    `${task.projectTitle} · ${getWorkPlanStatusDisplay(task.status)}`,
    task.assigneeName && task.assigneeName !== '—' ? `מבצע: ${task.assigneeName}` : null,
    `שעות: ${formatHourAsTime(task.startHour)}–${formatHourAsTime(task.endHour)}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function TaskBar({
  task,
  lane,
  onSelect,
  isSelected,
}: {
  task: ScheduledTaskBar;
  lane: number;
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
        top: `${TRACK_PADDING + lane * (LANE_HEIGHT + LANE_GAP)}px`,
        height: `${LANE_HEIGHT}px`,
      }}
      onClick={() => onSelect(task)}
      aria-pressed={isSelected}
      title={buildTaskTooltip(task)}
    >
      <span className="workPlanDailyGrid__taskName">{task.title}</span>
      <span className="workPlanDailyGrid__taskMeta">
        {formatHourAsTime(task.startHour)}–{formatHourAsTime(task.endHour)} · {getWorkPlanStatusDisplay(task.status)}
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
          rows.map((row) => {
            const { positioned, laneCount } = assignLanes(row.tasks);
            const trackMinHeight =
              laneCount * LANE_HEIGHT + (laneCount - 1) * LANE_GAP + TRACK_PADDING * 2;

            return (
              <div key={row.key} className="workPlanDailyGrid__row">
                <div className="workPlanDailyGrid__stickyCol">
                  <div className="workPlanDailyGrid__rowTitle">{row.title}</div>
                  <div className="workPlanDailyGrid__rowSubtitle">{row.subtitle}</div>
                  {row.tasks.length > 0 && (
                    <div className="workPlanDailyGrid__rowCount">{row.tasks.length} משימות</div>
                  )}
                </div>
                <div className="workPlanDailyGrid__track" style={{ minHeight: `${trackMinHeight}px` }}>
                  {positioned.map(({ task, lane }) => (
                    <TaskBar
                      key={task.taskId}
                      task={task}
                      lane={lane}
                      onSelect={onTaskSelect}
                      isSelected={selectedTaskId === task.taskId}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
