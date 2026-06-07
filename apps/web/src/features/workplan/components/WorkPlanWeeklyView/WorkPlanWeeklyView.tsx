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
  buildTaskSearchFields,
  buildWorkPlanTaskSelection,
  formatHourAsTime,
  matchesWorkPlanSearch,
  resolveAssignment,
} from '../../lib/workPlanScheduling';
import { isSameDay, startOfWeek } from '../../lib/workPlanPeriod';
import './WorkPlanWeeklyView.css';

function weeklyTaskStatusClass(status?: string | null): string {
  if (isWorkPlanStatusDone(status)) return 'workPlanWeeklyView__task--done';
  if (isWorkPlanStatusInProgress(status)) return 'workPlanWeeklyView__task--progress';
  return 'workPlanWeeklyView__task--planned';
}

interface WorkPlanWeeklyViewProps {
  workPlans: MappedWorkPlan[];
  statusFilter: string;
  searchQuery: string;
  periodAnchor: Date;
  onTaskClick?: (task: WorkPlanTaskSelection) => void;
}

interface WeeklyTask extends WorkPlanTaskSelection {
  dayIndex: number;
}

export function WorkPlanWeeklyView({
  workPlans,
  statusFilter,
  searchQuery,
  periodAnchor,
  onTaskClick,
}: WorkPlanWeeklyViewProps) {
  const weekDays = useMemo(() => {
    const start = startOfWeek(periodAnchor);
    return WEEKDAY_LABELS.map((label, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return { label, date };
    });
  }, [periodAnchor]);

  const { rows, hiddenCount } = useMemo(() => {
    const assigneeMap = new Map<string, WeeklyTask[]>();
    const weekStart = weekDays[0].date;
    const weekEnd = new Date(weekDays[6].date);
    weekEnd.setHours(23, 59, 59, 999);
    let hidden = 0;

    for (const workPlan of workPlans) {
      for (const [taskIndex, task] of workPlan.tasks.entries()) {
        if (!matchesWorkPlanStatusFilter(task.status, statusFilter)) continue;
        const assignment = resolveAssignment(task, workPlan);
        if (!matchesWorkPlanSearch(buildTaskSearchFields(task, workPlan, assignment), searchQuery)) {
          continue;
        }

        const plannedDate = task.plannedStart ? new Date(task.plannedStart) : null;
        const isInWeek =
          plannedDate &&
          !Number.isNaN(plannedDate.getTime()) &&
          plannedDate >= weekStart &&
          plannedDate <= weekEnd;

        if (!isInWeek) {
          hidden += 1;
          continue;
        }

        const assignee = assignment.displayName && assignment.displayName !== '—'
          ? assignment.displayName
          : 'לא משויך';
        if (!assigneeMap.has(assignee)) assigneeMap.set(assignee, []);
        assigneeMap.get(assignee)!.push({
          ...buildWorkPlanTaskSelection(workPlan, task, taskIndex),
          dayIndex: plannedDate!.getDay(),
        });
      }
    }

    const builtRows = Array.from(assigneeMap.entries())
      .map(([assignee, tasks]) => ({
        assignee,
        days: weekDays.map((_, index) => tasks.filter((task) => task.dayIndex === index)),
      }))
      .sort((left, right) => left.assignee.localeCompare(right.assignee, 'he'));

    return { rows: builtRows, hiddenCount: hidden };
  }, [workPlans, statusFilter, searchQuery, weekDays]);

  const today = new Date();

  return (
    <div className="workPlanWeeklyView card">
      <div className="workPlanWeeklyView__head">
        <h3 className="workPlanWeeklyView__title">תצוגה שבועית</h3>
        {hiddenCount > 0 && (
          <span className="workPlanWeeklyView__note">
            {hiddenCount} משימות אינן בשבוע זה (תאריך אחר או ללא תאריך מתוכנן)
          </span>
        )}
      </div>

      <div className="workPlanWeeklyView__scroll">
        <div className="workPlanWeeklyView__grid">
          <div className="workPlanWeeklyView__header">
            <div className="workPlanWeeklyView__nameHeader">עובד / משויך</div>
            {weekDays.map(({ label, date }) => {
              const isToday = isSameDay(date, today);
              return (
                <div
                  key={label}
                  className={`workPlanWeeklyView__dayHeader ${
                    isToday ? 'workPlanWeeklyView__dayHeader--today' : ''
                  }`}
                >
                  <div className="workPlanWeeklyView__dayName">{label}</div>
                  <div className="workPlanWeeklyView__dayDate">
                    {date.getDate()}/{date.getMonth() + 1}
                  </div>
                </div>
              );
            })}
          </div>

          {rows.length === 0 ? (
            <div className="workPlanWeeklyView__empty">
              אין משימות מתוזמנות לשבוע זה — נווט בין השבועות כדי לראות משימות נוספות.
            </div>
          ) : (
            rows.map((row) => (
              <div key={row.assignee} className="workPlanWeeklyView__row">
                <div className="workPlanWeeklyView__name">{row.assignee}</div>
                {row.days.map((tasks, dayIndex) => {
                  const isToday = isSameDay(weekDays[dayIndex].date, today);
                  return (
                    <div
                      key={`${row.assignee}-${dayIndex}`}
                      className={`workPlanWeeklyView__cell ${
                        isToday ? 'workPlanWeeklyView__cell--today' : ''
                      }`}
                    >
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
                            <span className="workPlanWeeklyView__taskBody">
                              <span className="workPlanWeeklyView__taskText">{task.title}</span>
                              <span className="workPlanWeeklyView__taskTime">
                                {formatHourAsTime(task.startHour)}
                              </span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
