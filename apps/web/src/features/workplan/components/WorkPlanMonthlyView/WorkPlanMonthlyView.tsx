import { useMemo } from 'react';
import type { WorkPlanSchedule, WorkPlanTaskSelection } from '../../types';
import {
  getWorkPlanStatusDisplay,
  isWorkPlanStatusDone,
  isWorkPlanStatusInProgress,
  matchesWorkPlanStatusFilter,
} from '../../constants';
import {
  buildTaskSearchFields,
  buildWorkPlanTaskSelection,
  matchesWorkPlanSearch,
  resolveFlatAssignment,
} from '../../lib/workPlanScheduling';
import { toLocalDateKey } from '@shared/utils/utcDateTime';
import { getTaskCategoryLabel } from '@shared/constants/taskCategories';
import { taskCategoryModifierClass } from '@shared/constants/taskCategoryStyles';
import './WorkPlanMonthlyView.css';

function monthlyTaskStatusClass(status?: string | null): string {
  if (isWorkPlanStatusDone(status)) return 'workPlanMonthlyView__taskButton--done';
  if (isWorkPlanStatusInProgress(status)) return 'workPlanMonthlyView__taskButton--progress';
  return 'workPlanMonthlyView__taskButton--planned';
}

interface WorkPlanMonthlyViewProps {
  schedule: WorkPlanSchedule;
  statusFilter: string;
  taskCategoryFilter: string;
  searchQuery: string;
  periodAnchor: Date;
  onTaskClick?: (task: WorkPlanTaskSelection) => void;
}

export function WorkPlanMonthlyView({
  schedule,
  statusFilter,
  taskCategoryFilter,
  searchQuery,
  periodAnchor,
  onTaskClick,
}: WorkPlanMonthlyViewProps) {
  const monthLabel = periodAnchor.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
  const localDayKey = toLocalDateKey(periodAnchor);

  const groups = useMemo(() => {
    const map = new Map<string, WorkPlanTaskSelection[]>();

    for (const task of [...schedule.scheduledTasks, ...schedule.unscheduledTasks]) {
      if (!matchesWorkPlanStatusFilter(task.status, statusFilter)) continue;
      if (taskCategoryFilter !== 'all' && task.taskCategory !== taskCategoryFilter) continue;

      const assignment = resolveFlatAssignment(task, schedule.assignments);
      if (!matchesWorkPlanSearch(buildTaskSearchFields(task, assignment), searchQuery)) continue;

      const groupKey = task.projectTitle ?? task.customerName ?? 'ללא פרויקט';
      if (!map.has(groupKey)) map.set(groupKey, []);
      map.get(groupKey)!.push(
        buildWorkPlanTaskSelection(
          task,
          assignment,
          localDayKey,
          !task.plannedStart || !task.plannedEnd,
        ),
      );
    }

    return Array.from(map.entries())
      .map(([title, tasks]) => {
        const doneCount = tasks.filter((t) => isWorkPlanStatusDone(t.status)).length;
        const progressCount = tasks.filter((t) => isWorkPlanStatusInProgress(t.status)).length;
        return {
          title,
          tasks,
          doneCount,
          progressCount,
          plannedCount: tasks.length - doneCount - progressCount,
        };
      })
      .filter((entry) => entry.tasks.length > 0 || !searchQuery.trim());
  }, [schedule, statusFilter, taskCategoryFilter, searchQuery, localDayKey]);

  return (
    <div className="workPlanMonthlyView card">
      <h3 className="workPlanMonthlyView__title">תצוגה חודשית · {monthLabel}</h3>
      <div className="workPlanMonthlyView__list">
        {groups.length === 0 ? (
          <p className="workPlanMonthlyView__empty">אין משימות להצגה</p>
        ) : (
          groups.map(({ title, tasks, doneCount, progressCount, plannedCount }) => (
            <section key={title} className="workPlanMonthlyView__project">
              <header className="workPlanMonthlyView__projectHeader">
                <div className="workPlanMonthlyView__projectTitle">
                  <h4>{title}</h4>
                </div>
                <div className="workPlanMonthlyView__counts">
                  <span className="workPlanMonthlyView__countChip workPlanMonthlyView__countChip--total">
                    {tasks.length} משימות
                  </span>
                  <span className="workPlanMonthlyView__countChip workPlanMonthlyView__countChip--planned">
                    {plannedCount} מתוכננות
                  </span>
                  <span className="workPlanMonthlyView__countChip workPlanMonthlyView__countChip--progress">
                    {progressCount} בביצוע
                  </span>
                  <span className="workPlanMonthlyView__countChip workPlanMonthlyView__countChip--done">
                    {doneCount} הושלמו
                  </span>
                </div>
              </header>
              <ul className="workPlanMonthlyView__tasks">
                {tasks.map((task) => (
                  <li key={task.taskId}>
                    <button
                      type="button"
                      className={`${taskCategoryModifierClass('workPlanMonthlyView__taskButton', task.taskCategory)} ${monthlyTaskStatusClass(task.status)}`}
                      onClick={() => onTaskClick?.(task)}
                    >
                      <span className="workPlanMonthlyView__taskTitle">{task.title}</span>
                      <span className="workPlanMonthlyView__taskMeta">
                        {getTaskCategoryLabel(task.taskCategory)} ·{' '}
                        {getWorkPlanStatusDisplay(task.status)}
                        {task.isUnscheduled ? ' · לא מתוזמנת' : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
