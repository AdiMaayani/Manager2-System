import type { MappedWorkPlan, WorkPlanTaskSelection } from '../../types';
import {
  getWorkPlanStatusDisplay,
  isWorkPlanStatusDone,
  isWorkPlanStatusInProgress,
} from '../../constants';
import { buildWorkPlanTaskSelection } from '../../lib/workPlanScheduling';
import './WorkPlanMonthlyView.css';

function monthlyTaskStatusClass(status?: string | null): string {
  if (isWorkPlanStatusDone(status)) return 'workPlanMonthlyView__taskButton--done';
  if (isWorkPlanStatusInProgress(status)) return 'workPlanMonthlyView__taskButton--progress';
  return 'workPlanMonthlyView__taskButton--planned';
}

interface WorkPlanMonthlyViewProps {
  workPlans: MappedWorkPlan[];
  onTaskClick?: (task: WorkPlanTaskSelection) => void;
}

export function WorkPlanMonthlyView({ workPlans, onTaskClick }: WorkPlanMonthlyViewProps) {
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
                <div className="workPlanMonthlyView__projectTitle">
                  <h4>{workPlan.project.title}</h4>
                  <span className="workPlanMonthlyView__count">
                    {workPlan.tasks.length} משימות
                  </span>
                </div>
                <span className="workPlanMonthlyView__badge">{getWorkPlanStatusDisplay(workPlan.project.status)}</span>
              </header>
              {workPlan.tasks.length === 0 ? (
                <p className="workPlanMonthlyView__noTasks">אין משימות בפרויקט זה</p>
              ) : (
                <ul className="workPlanMonthlyView__tasks">
                  {workPlan.tasks.map((task, taskIndex) => (
                    <li key={task.workItemId}>
                      <button
                        type="button"
                        className={`workPlanMonthlyView__taskButton ${monthlyTaskStatusClass(task.status)}`}
                        onClick={() =>
                          onTaskClick?.(
                            buildWorkPlanTaskSelection(workPlan, task, taskIndex),
                          )
                        }
                        title={`${task.title} · ${getWorkPlanStatusDisplay(task.status)}`}
                      >
                        <strong className="workPlanMonthlyView__taskTitle">{task.title}</strong>
                        <span className="workPlanMonthlyView__taskStatus">
                          {getWorkPlanStatusDisplay(task.status)}
                        </span>
                        {task.plannedStart && (
                          <span className="workPlanMonthlyView__date">
                            {new Date(task.plannedStart).toLocaleDateString('he-IL')}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
