import { useState } from 'react';
import type { CSSProperties } from 'react';
import { getWorkPlanStatusDisplay, HOUR_LABELS } from '../../constants';
import { getTaskCategoryLabel } from '@shared/constants/taskCategories';
import { taskCategoryModifierClass } from '@shared/constants/taskCategoryStyles';
import { formatHourAsTime, hourSpanToWidth, hourToPercent } from '../../lib/workPlanScheduling';
import type { ScheduledTaskBar } from '../../types';
import './WorkPlanDailyGrid.css';

interface EmployeeRow {
  employee: { employeeId: number; fullName: string; primaryRole: string };
  tasks: ScheduledTaskBar[];
}

interface ProjectRow {
  projectId: number | null;
  projectTitle: string;
  tasks: ScheduledTaskBar[];
}

interface WorkPlanDailyGridProps {
  mode: 'employees' | 'projects';
  employeeRows?: EmployeeRow[];
  projectRows?: ProjectRow[];
  unscheduledTasks?: ScheduledTaskBar[];
  onTaskSelect: (task: ScheduledTaskBar) => void;
  selectedTaskId?: number | null;
}

const LANE_HEIGHT = 58;
const LANE_GAP = 6;
const TRACK_PADDING = 10;

type DailyDensity = 'normal' | 'wide' | 'max';

const DENSITY_LEVELS: Array<{ id: DailyDensity; label: string; width: number }> = [
  { id: 'normal', label: 'רגיל', width: 1400 },
  { id: 'wide', label: 'רחב', width: 2000 },
  { id: 'max', label: 'מירבי', width: 2800 },
];

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
  const classes = [taskCategoryModifierClass('workPlanDailyGrid__task', task.taskCategory)];
  if (task.isUnscheduled) classes.push('workPlanDailyGrid__task--unscheduled');
  if (task.isLocked) classes.push('workPlanDailyGrid__task--locked');
  if (task.violationCount > 0) classes.push('workPlanDailyGrid__task--violation');
  else if (task.warningCount > 0) classes.push('workPlanDailyGrid__task--warning');
  if (task.isUrgent) classes.push('workPlanDailyGrid__task--urgent');
  return classes.join(' ');
}

function buildTaskTooltip(task: ScheduledTaskBar): string {
  return [
    task.title,
    getTaskCategoryLabel(task.taskCategory),
    `${task.projectTitle} · ${getWorkPlanStatusDisplay(task.status)}`,
    task.assigneeName && task.assigneeName !== '—' ? `מבצע: ${task.assigneeName}` : null,
    task.isUnscheduled
      ? 'לא מתוזמנת'
      : `שעות: ${formatHourAsTime(task.startHour)}–${formatHourAsTime(task.endHour)}`,
    task.description?.trim() ? task.description.trim() : null,
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
      <span className="workPlanDailyGrid__taskTop">
        <span className="workPlanDailyGrid__taskType" title={getTaskCategoryLabel(task.taskCategory)}>
          {task.taskCategory === 'ServiceCall' ? 'ש' : task.taskCategory === 'Regular' ? 'כ' : 'פ'}
        </span>
        {task.isUrgent && (
          <span className="workPlanDailyGrid__taskFlag" title="דחוף">
            דחוף
          </span>
        )}
        <span className="workPlanDailyGrid__taskName">{task.title}</span>
      </span>
      <span className="workPlanDailyGrid__taskMeta">
        {task.isUnscheduled
          ? 'לא מתוזמנת'
          : `${formatHourAsTime(task.startHour)}–${formatHourAsTime(task.endHour)}`}{' '}
        · {getWorkPlanStatusDisplay(task.status)}
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
  unscheduledTasks = [],
  onTaskSelect,
  selectedTaskId,
}: WorkPlanDailyGridProps) {
  const [density, setDensity] = useState<DailyDensity>('normal');
  const dayWidth = DENSITY_LEVELS.find((level) => level.id === density)?.width ?? 1400;

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
    <div className="workPlanDailyGrid">
      <div className="workPlanDailyGrid__controls">
        <span className="workPlanDailyGrid__controlsLabel">ציר 24 שעות · צפיפות תצוגה</span>
        <div className="workPlanDailyGrid__density" role="group" aria-label="צפיפות תצוגה יומית">
          {DENSITY_LEVELS.map((level) => (
            <button
              key={level.id}
              type="button"
              className={`workPlanDailyGrid__densityBtn ${
                density === level.id ? 'workPlanDailyGrid__densityBtn--active' : ''
              }`}
              aria-pressed={density === level.id}
              onClick={() => setDensity(level.id)}
            >
              {level.label}
            </button>
          ))}
        </div>
      </div>

      <div className="workPlanShell">
        <div
          className="workPlanDailyGrid__grid"
          style={{ '--workplan-day-width': `${dayWidth}px` } as CSSProperties}
        >
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

      {unscheduledTasks.length > 0 && (
        <section className="workPlanDailyGrid__unscheduled" aria-label="משימות לא מתוזמנות">
          <h3 className="workPlanDailyGrid__unscheduledTitle">
            משימות ללא זמן מתוכנן ({unscheduledTasks.length})
          </h3>
          <div className="workPlanDailyGrid__unscheduledList">
            {unscheduledTasks.map((task) => (
              <button
                key={task.taskId}
                type="button"
                className={`${taskClassName(task)} ${
                  selectedTaskId === task.taskId ? 'workPlanDailyGrid__task--selected' : ''
                } workPlanDailyGrid__unscheduledItem`}
                onClick={() => onTaskSelect(task)}
                title={buildTaskTooltip(task)}
              >
                <span className="workPlanDailyGrid__taskName">{task.title}</span>
                <span className="workPlanDailyGrid__taskMeta">
                  {getTaskCategoryLabel(task.taskCategory)} · {task.projectTitle}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
