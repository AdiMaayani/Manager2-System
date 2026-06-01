import type { MappedWorkPlan } from '../../types';
import './WorkPlanMonthlyView.css';

interface WorkPlanMonthlyViewProps {
  workPlans: MappedWorkPlan[];
}

export function WorkPlanMonthlyView({ workPlans }: WorkPlanMonthlyViewProps) {
  const monthLabel = new Date().toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

  return (
    <div className="workPlanMonthlyView card">
      <h3 className="workPlanMonthlyView__title">תצוגה חודשית · {monthLabel}</h3>
      <div className="workPlanMonthlyView__list">
        {workPlans.length === 0 ? (
          <p className="workPlanMonthlyView__empty">אין פרויקטים להצגה</p>
        ) : (
          workPlans.map((workPlan) => (
            <section key={workPlan.project.id} className="workPlanMonthlyView__project">
              <header className="workPlanMonthlyView__projectHeader">
                <h4>{workPlan.project.title}</h4>
                <span className="workPlanMonthlyView__badge">{workPlan.project.status}</span>
              </header>
              <ul className="workPlanMonthlyView__tasks">
                {workPlan.tasks.map((task) => (
                  <li key={task.workItemId}>
                    <strong>{task.title}</strong>
                    <span>{task.status}</span>
                    {task.plannedStart && (
                      <span className="workPlanMonthlyView__date">
                        {new Date(task.plannedStart).toLocaleDateString('he-IL')}
                      </span>
                    )}
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
