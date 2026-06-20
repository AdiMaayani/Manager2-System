import { useMemo } from 'react';
import type { WorkPlanSchedule } from '../../types';
import {
  isWorkPlanStatusDone,
  isWorkPlanStatusInProgress,
} from '../../constants';
import {
  buildTaskSearchFields,
  matchesWorkPlanSearch,
  resolveFlatAssignment,
} from '../../lib/workPlanScheduling';
import { getTaskCategoryLabel } from '@shared/constants/taskCategories';
import { taskCategoryModifierClass } from '@shared/constants/taskCategoryStyles';
import './WorkPlanYearlyView.css';

interface WorkPlanYearlyViewProps {
  schedule: WorkPlanSchedule;
  taskCategoryFilter: string;
  searchQuery: string;
  periodAnchor: Date;
}

export function WorkPlanYearlyView({
  schedule,
  taskCategoryFilter,
  searchQuery,
  periodAnchor,
}: WorkPlanYearlyViewProps) {
  const year = periodAnchor.getFullYear();

  const cards = useMemo(() => {
    const map = new Map<
      string,
      {
        title: string;
        tasks: typeof schedule.scheduledTasks;
      }
    >();

    for (const task of [...schedule.scheduledTasks, ...schedule.unscheduledTasks]) {
      if (taskCategoryFilter !== 'all' && task.taskCategory !== taskCategoryFilter) continue;
      const assignment = resolveFlatAssignment(task, schedule.assignments);
      if (!matchesWorkPlanSearch(buildTaskSearchFields(task, assignment), searchQuery)) continue;

      const title = task.projectTitle ?? task.customerName ?? 'ללא פרויקט';
      if (!map.has(title)) map.set(title, { title, tasks: [] });
      map.get(title)!.tasks.push(task);
    }

    return Array.from(map.values())
      .map(({ title, tasks }) => {
        const completed = tasks.filter((t) => isWorkPlanStatusDone(t.status)).length;
        const inProgress = tasks.filter((t) => isWorkPlanStatusInProgress(t.status)).length;
        const planned = tasks.length - completed - inProgress;
        const totalHours = tasks.reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0);
        const categories = [...new Set(tasks.map((t) => t.taskCategory).filter(Boolean))];

        return {
          title,
          taskCount: tasks.length,
          completed,
          inProgress,
          planned,
          totalHours,
          categories,
          completionPct: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
          progressPct: tasks.length > 0 ? Math.round((inProgress / tasks.length) * 100) : 0,
        };
      })
      .filter((card) => card.taskCount > 0 || !searchQuery.trim());
  }, [schedule, taskCategoryFilter, searchQuery]);

  return (
    <div className="workPlanYearlyView card">
      <h3 className="workPlanYearlyView__title">תצוגה שנתית · {year}</h3>
      <div className="workPlanYearlyView__cards">
        {cards.length === 0 ? (
          <p className="workPlanYearlyView__empty">אין נתונים לשנה הנוכחית</p>
        ) : (
          cards.map((card) => (
            <article key={card.title} className="workPlanYearlyView__card">
              <header className="workPlanYearlyView__cardHead">
                <h4>{card.title}</h4>
                <div className="workPlanYearlyView__categories">
                  {card.categories.map((category) => (
                    <span
                      key={category}
                      className={taskCategoryModifierClass(
                        'workPlanYearlyView__categoryChip',
                        category,
                      )}
                    >
                      {getTaskCategoryLabel(category)}
                    </span>
                  ))}
                </div>
              </header>
              <dl className="workPlanYearlyView__stats">
                <div>
                  <dt>משימות</dt>
                  <dd>{card.taskCount}</dd>
                </div>
                <div>
                  <dt>הושלמו</dt>
                  <dd>{card.completed}</dd>
                </div>
                <div>
                  <dt>בביצוע</dt>
                  <dd>{card.inProgress}</dd>
                </div>
                <div>
                  <dt>מתוכננות</dt>
                  <dd>{card.planned}</dd>
                </div>
                <div>
                  <dt>שעות משוערות</dt>
                  <dd>{card.totalHours.toFixed(1)}</dd>
                </div>
              </dl>
              <div className="workPlanYearlyView__bars">
                <div
                  className="workPlanYearlyView__bar workPlanYearlyView__bar--done"
                  style={{ width: `${card.completionPct}%` }}
                  title={`${card.completionPct}% הושלמו`}
                />
                <div
                  className="workPlanYearlyView__bar workPlanYearlyView__bar--progress"
                  style={{ width: `${card.progressPct}%` }}
                  title={`${card.progressPct}% בביצוע`}
                />
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
