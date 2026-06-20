import { useMemo } from 'react';
import {
  getWorkPlanStatusDisplay,
  isWorkPlanStatusDone,
  isWorkPlanStatusInProgress,
  matchesWorkPlanStatusFilter,
  WEEKDAY_LABELS,
} from '../../constants';
import type { WorkPlanSchedule, WorkPlanTaskSelection } from '../../types';
import {
  buildTaskSearchFields,
  buildWorkPlanTaskSelection,
  formatHourAsTime,
  matchesWorkPlanSearch,
  resolveFlatAssignment,
  taskMatchesSelectedLocalDate,
} from '../../lib/workPlanScheduling';
import { isSameDay, startOfWeek } from '../../lib/workPlanPeriod';
import { localDateKeyFromUtc, toLocalDateKey } from '@shared/utils/utcDateTime';
import { taskCategoryModifierClass } from '@shared/constants/taskCategoryStyles';
import './WorkPlanWeeklyView.css';

function weeklyTaskStatusClass(status?: string | null): string {
  if (isWorkPlanStatusDone(status)) return 'workPlanWeeklyView__task--done';
  if (isWorkPlanStatusInProgress(status)) return 'workPlanWeeklyView__task--progress';
  return 'workPlanWeeklyView__task--planned';
}

interface WorkPlanWeeklyViewProps {
  schedule: WorkPlanSchedule;
  statusFilter: string;
  taskCategoryFilter: string;
  searchQuery: string;
  periodAnchor: Date;
  onTaskClick?: (task: WorkPlanTaskSelection) => void;
}

interface WeeklyTask extends WorkPlanTaskSelection {
  dayIndex: number;
}

export function WorkPlanWeeklyView({
  schedule,
  statusFilter,
  taskCategoryFilter,
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

  const { rows } = useMemo(() => {
    const assigneeMap = new Map<string, WeeklyTask[]>();

    for (const task of schedule.scheduledTasks) {
      if (!matchesWorkPlanStatusFilter(task.status, statusFilter)) continue;
      if (taskCategoryFilter !== 'all' && task.taskCategory !== taskCategoryFilter) continue;

      const assignment = resolveFlatAssignment(task, schedule.assignments);
      if (!matchesWorkPlanSearch(buildTaskSearchFields(task, assignment), searchQuery)) continue;

      if (!task.plannedStart || !task.plannedEnd) continue;

      let matchedDayIndex = -1;
      for (let index = 0; index < weekDays.length; index += 1) {
        if (taskMatchesSelectedLocalDate(task.plannedStart, task.plannedEnd, weekDays[index].date)) {
          matchedDayIndex = index;
          break;
        }
      }
      if (matchedDayIndex < 0) continue;

      const assignee =
        assignment.displayName && assignment.displayName !== '—'
          ? assignment.displayName
          : 'לא משויך';
      if (!assigneeMap.has(assignee)) assigneeMap.set(assignee, []);

      const dayKey = toLocalDateKey(weekDays[matchedDayIndex].date);
      assigneeMap.get(assignee)!.push({
        ...buildWorkPlanTaskSelection(task, assignment, dayKey, false),
        dayIndex: matchedDayIndex,
      });
    }

    const builtRows = Array.from(assigneeMap.entries())
      .map(([assignee, tasks]) => ({
        assignee,
        days: weekDays.map((_, index) => tasks.filter((task) => task.dayIndex === index)),
      }))
      .sort((left, right) => left.assignee.localeCompare(right.assignee, 'he'));

    return { rows: builtRows };
  }, [schedule, statusFilter, taskCategoryFilter, searchQuery, weekDays]);

  const today = new Date();

  return (
    <div className="workPlanWeeklyView card">
      <div className="workPlanWeeklyView__head">
        <h3 className="workPlanWeeklyView__title">תצוגה שבועית</h3>
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
                            className={`${taskCategoryModifierClass('workPlanWeeklyView__task', task.taskCategory)} ${weeklyTaskStatusClass(task.status)}`}
                            onClick={() => onTaskClick?.(task)}
                            title={`${task.title} · ${getWorkPlanStatusDisplay(task.status)} · ${localDateKeyFromUtc(task.plannedStart ?? '')}`}
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
