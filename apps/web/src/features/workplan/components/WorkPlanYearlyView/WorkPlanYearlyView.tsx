import { useMemo } from 'react';
import type { MappedWorkPlan } from '../../types';
import {
  getWorkPlanStatusDisplay,
  isWorkPlanStatusDone,
  isWorkPlanStatusInProgress,
} from '../../constants';
import {
  buildTaskSearchFields,
  matchesWorkPlanSearch,
  resolveAssignment,
} from '../../lib/workPlanScheduling';
import './WorkPlanYearlyView.css';

interface WorkPlanYearlyViewProps {
  workPlans: MappedWorkPlan[];
  searchQuery: string;
  periodAnchor: Date;
}

export function WorkPlanYearlyView({
  workPlans,
  searchQuery,
  periodAnchor,
}: WorkPlanYearlyViewProps) {
  const year = periodAnchor.getFullYear();

  const cards = useMemo(
    () =>
      workPlans
        .map((workPlan) => {
          const tasks = workPlan.tasks.filter((task) => {
            const assignment = resolveAssignment(task, workPlan);
            return matchesWorkPlanSearch(
              buildTaskSearchFields(task, workPlan, assignment),
              searchQuery,
            );
          });

          const completed = tasks.filter((task) => isWorkPlanStatusDone(task.status)).length;
          const inProgress = tasks.filter((task) =>
            isWorkPlanStatusInProgress(task.status),
          ).length;
          const planned = tasks.length - completed - inProgress;
          const totalHours = tasks.reduce((sum, task) => sum + (task.estimatedHours ?? 0), 0);
          const completionPct =
            tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
          const progressPct =
            tasks.length > 0 ? Math.round((inProgress / tasks.length) * 100) : 0;

          return {
            workPlan,
            taskCount: tasks.length,
            completed,
            inProgress,
            planned,
            totalHours,
            completionPct,
            progressPct,
          };
        })
        .filter((card) => card.taskCount > 0 || !searchQuery.trim()),
    [workPlans, searchQuery],
  );

  return (
    <div className="workPlanYearlyView card">
      <h3 className="workPlanYearlyView__title">תצוגה שנתית · {year}</h3>
      <div className="workPlanYearlyView__cards">
        {cards.length === 0 ? (
          <p className="workPlanYearlyView__empty">אין נתונים לשנה הנוכחית</p>
        ) : (
          cards.map((card) => (
            <article key={card.workPlan.project.id} className="workPlanYearlyView__card">
              <header className="workPlanYearlyView__cardHead">
                <h4>{card.workPlan.project.title}</h4>
                <span className="workPlanYearlyView__status">
                  {getWorkPlanStatusDisplay(card.workPlan.project.status)}
                </span>
              </header>

              <div
                className="workPlanYearlyView__progress"
                title={`${card.completed}/${card.taskCount} הושלמו`}
                role="img"
                aria-label={`${card.completionPct}% הושלמו`}
              >
                <div
                  className="workPlanYearlyView__progressBar workPlanYearlyView__progressBar--done"
                  style={{ width: `${card.completionPct}%` }}
                />
                <div
                  className="workPlanYearlyView__progressBar workPlanYearlyView__progressBar--progress"
                  style={{ width: `${card.progressPct}%` }}
                />
              </div>
              <span className="workPlanYearlyView__progressLabel">
                {card.completionPct}% הושלמו
              </span>

              <dl>
                <div>
                  <dt>משימות</dt>
                  <dd>{card.taskCount}</dd>
                </div>
                <div>
                  <dt>
                    <span className="workPlanYearlyView__dot workPlanYearlyView__dot--planned" />
                    מתוכננות
                  </dt>
                  <dd>{card.planned}</dd>
                </div>
                <div>
                  <dt>
                    <span className="workPlanYearlyView__dot workPlanYearlyView__dot--progress" />
                    בביצוע
                  </dt>
                  <dd>{card.inProgress}</dd>
                </div>
                <div>
                  <dt>
                    <span className="workPlanYearlyView__dot workPlanYearlyView__dot--done" />
                    הושלמו
                  </dt>
                  <dd>{card.completed}</dd>
                </div>
                <div>
                  <dt>שעות משוערות</dt>
                  <dd>{card.totalHours}</dd>
                </div>
              </dl>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
