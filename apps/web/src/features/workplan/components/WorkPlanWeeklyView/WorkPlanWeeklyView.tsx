import { useMemo } from 'react';
import {
  getWorkPlanStatusDisplay,
  isWorkPlanStatusDone,
  isWorkPlanStatusInProgress,
  matchesWorkPlanStatusFilter,
  WEEKDAY_LABELS,
} from '../../constants';
import type { MappedWorkPlan, WorkPlanTaskSelection } from '../../types';
import {
  buildWorkPlanTaskSelection,
  resolveAssignment,
} from '../../lib/workPlanScheduling';
import './WorkPlanWeeklyView.css';

function weeklyTaskStatusClass(status?: string | null): string {
  if (isWorkPlanStatusDone(status)) return 'workPlanWeeklyView__task--done';
  if (isWorkPlanStatusInProgress(status)) return 'workPlanWeeklyView__task--progress';
  return 'workPlanWeeklyView__task--planned';
}

interface WorkPlanWeeklyViewProps {
  workPlans: MappedWorkPlan[];
  statusFilter: string;
  onTaskClick?: (task: WorkPlanTaskSelection) => void;
}

export function WorkPlanWeeklyView({
  workPlans,
  statusFilter,
  onTaskClick,
}: WorkPlanWeeklyViewProps) {
  const weekStart = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
    return start;
  }, []);

  const rows = useMemo(() => {
    const assigneeMap = new Map<string, Map<number, WorkPlanTaskSelection[]>>();

    for (const workPlan of workPlans) {
      for (const [taskIndex, task] of workPlan.tasks.entries()) {
        if (!matchesWorkPlanStatusFilter(task.status, statusFilter)) continue;
        const assignment = resolveAssignment(task, workPlan);
        const assignee = assignment.displayName || 'לא משויך';
        if (!assigneeMap.has(assignee)) {
          assigneeMap.set(assignee, new Map());
        }
        const dayIndex = task.plannedStart
          ? new Date(task.plannedStart).getDay()
          : task.workItemId % 5;
        const dayTasks = assigneeMap.get(assignee)!;
        if (!dayTasks.has(dayIndex)) dayTasks.set(dayIndex, []);
        dayTasks.get(dayIndex)!.push(
          buildWorkPlanTaskSelection(workPlan, task, taskIndex),
        );
      }
    }

    return Array.from(assigneeMap.entries()).map(([assignee, dayMap]) => ({
      assignee,
      days: WEEKDAY_LABELS.map((_, index) => dayMap.get(index) ?? []),
    }));
  }, [workPlans, statusFilter]);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const title = `${weekStart.toLocaleDateString('he-IL')} – ${weekEnd.toLocaleDateString('he-IL')}`;

  return (
    <div className="workPlanWeeklyView card">
      <h3 className="workPlanWeeklyView__title">תצוגה שבועית · {title}</h3>
      <div className="workPlanWeeklyView__grid">
        <div className="workPlanWeeklyView__header">
          <div className="workPlanWeeklyView__nameHeader" />
          {WEEKDAY_LABELS.map((day, index) => {
            const dayDate = new Date(weekStart);
            dayDate.setDate(weekStart.getDate() + index);
            return (
              <div key={day} className="workPlanWeeklyView__dayHeader">
                <div>{day}</div>
                <div className="workPlanWeeklyView__dayDate">
                  {dayDate.getDate()}/{dayDate.getMonth() + 1}
                </div>
              </div>
            );
          })}
        </div>

        {rows.length === 0 ? (
          <div className="workPlanWeeklyView__empty">אין משימות לשבוע הנוכחי</div>
        ) : (
          rows.map((row) => (
            <div key={row.assignee} className="workPlanWeeklyView__row">
              <div className="workPlanWeeklyView__name">{row.assignee}</div>
              {row.days.map((tasks, dayIndex) => (
                <div key={`${row.assignee}-${dayIndex}`} className="workPlanWeeklyView__cell">
                  {tasks.length === 0 ? (
                    <span className="workPlanWeeklyView__cellEmpty" aria-hidden>
                      ·
                    </span>
                  ) : (
                    tasks.map((task) => (
                      <button
                        key={task.taskId}
                        type="button"
                        className={`workPlanWeeklyView__task ${weeklyTaskStatusClass(task.status)}`}
                        onClick={() => onTaskClick?.(task)}
                        title={`${task.title} · ${getWorkPlanStatusDisplay(task.status)}`}
                      >
                        <span className="workPlanWeeklyView__taskDot" aria-hidden />
                        <span className="workPlanWeeklyView__taskText">{task.title}</span>
                      </button>
                    ))
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
