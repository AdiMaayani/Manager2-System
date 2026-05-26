import type { MappedWorkPlan } from '../../types';
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
            const completed = workPlan.tasks.filter((t) =>
              t.status.toLowerCase().includes('הושלם'),
            ).length;

            return (
              <article key={workPlan.project.id} className="workPlanYearlyView__card">
                <h4>{workPlan.project.title}</h4>
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
                  <div>
                    <dt>סטטוס</dt>
                    <dd>{workPlan.project.status}</dd>
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
