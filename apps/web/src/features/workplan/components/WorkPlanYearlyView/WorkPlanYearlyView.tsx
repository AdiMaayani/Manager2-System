import type { MappedWorkPlan } from '../../types';
import { getWorkPlanStatusDisplay, isWorkPlanStatusDone } from '../../constants';
import './WorkPlanYearlyView.css';

interface WorkPlanYearlyViewProps {
  workPlans: MappedWorkPlan[];
}

export function WorkPlanYearlyView({ workPlans }: WorkPlanYearlyViewProps) {
  const year = new Date().getFullYear();

  return (
    <div className="workPlanYearlyView card">
      <h3 className="workPlanYearlyView__title">תצוגה שנתית · {year}</h3>
      <div className="workPlanYearlyView__cards">
        {workPlans.length === 0 ? (
          <p className="workPlanYearlyView__empty">אין נתונים לשנה הנוכחית</p>
        ) : (
          workPlans.map((workPlan) => {
            const totalHours = workPlan.tasks.reduce(
              (sum, task) => sum + (task.estimatedHours ?? 0),
              0,
            );
            const completed = workPlan.tasks.filter((t) => isWorkPlanStatusDone(t.status)).length;
            const completionPct =
              workPlan.tasks.length > 0
                ? Math.round((completed / workPlan.tasks.length) * 100)
                : 0;

            return (
              <article key={workPlan.project.id} className="workPlanYearlyView__card">
                <header className="workPlanYearlyView__cardHead">
                  <h4>{workPlan.project.title}</h4>
                  <span className="workPlanYearlyView__status">
                    {getWorkPlanStatusDisplay(workPlan.project.status)}
                  </span>
                </header>

                <div
                  className="workPlanYearlyView__progress"
                  title={`${completed}/${workPlan.tasks.length} הושלמו`}
                >
                  <div
                    className="workPlanYearlyView__progressBar"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
                <span className="workPlanYearlyView__progressLabel">{completionPct}% הושלמו</span>

                <dl>
                  <div>
                    <dt>משימות</dt>
                    <dd>{workPlan.tasks.length}</dd>
                  </div>
                  <div>
                    <dt>הושלמו</dt>
                    <dd>{completed}</dd>
                  </div>
                  <div>
                    <dt>שעות משוערות</dt>
                    <dd>{totalHours}</dd>
                  </div>
                </dl>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
