import { useMemo } from 'react';
import type { MappedWorkPlan, WorkPlanTaskSelection } from '../../types';
import {
  getWorkPlanStatusDisplay,
  isWorkPlanStatusDone,
  isWorkPlanStatusInProgress,
} from '../../constants';
import {
  buildTaskSearchFields,
  buildWorkPlanTaskSelection,
  matchesWorkPlanSearch,
  resolveAssignment,
} from '../../lib/workPlanScheduling';
import './WorkPlanMonthlyView.css';

function monthlyTaskStatusClass(status?: string | null): string {
  if (isWorkPlanStatusDone(status)) return 'workPlanMonthlyView__taskButton--done';
  if (isWorkPlanStatusInProgress(status)) return 'workPlanMonthlyView__taskButton--progress';
  return 'workPlanMonthlyView__taskButton--planned';
}

interface WorkPlanMonthlyViewProps {
  workPlans: MappedWorkPlan[];
  searchQuery: string;
  periodAnchor: Date;
  onTaskClick?: (task: WorkPlanTaskSelection) => void;
}

export function WorkPlanMonthlyView({
  workPlans,
  searchQuery,
  periodAnchor,
  onTaskClick,
}: WorkPlanMonthlyViewProps) {
  const monthLabel = periodAnchor.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

  const projects = useMemo(
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

          const doneCount = tasks.filter((task) => isWorkPlanStatusDone(task.status)).length;
          const progressCount = tasks.filter((task) =>
            isWorkPlanStatusInProgress(task.status),
          ).length;
          const plannedCount = tasks.length - doneCount - progressCount;

          return { workPlan, tasks, doneCount, progressCount, plannedCount };
        })
        .filter((entry) => entry.tasks.length > 0 || !searchQuery.trim()),
    [workPlans, searchQuery],
  );

  return (
    <div className="workPlanMonthlyView card">
      <h3 className="workPlanMonthlyView__title">תצוגה חודשית · {monthLabel}</h3>
      <div className="workPlanMonthlyView__list">
        {projects.length === 0 ? (
          <p className="workPlanMonthlyView__empty">אין פרויקטים להצגה</p>
        ) : (
          projects.map(({ workPlan, tasks, doneCount, progressCount, plannedCount }) => (
            <section key={workPlan.project.id} className="workPlanMonthlyView__project">
              <header className="workPlanMonthlyView__projectHeader">
                <div className="workPlanMonthlyView__projectTitle">
                  <h4>{workPlan.project.title}</h4>
                  <span className="workPlanMonthlyView__badge">
                    {getWorkPlanStatusDisplay(workPlan.project.status)}
                  </span>
                </div>
                <div className="workPlanMonthlyView__counts">
                  <span className="workPlanMonthlyView__countChip workPlanMonthlyView__countChip--total">
                    {tasks.length} משימות
                  </span>
                  {plannedCount > 0 && (
                    <span className="workPlanMonthlyView__countChip workPlanMonthlyView__countChip--planned">
                      {plannedCount} מתוכננות
                    </span>
                  )}
                  {progressCount > 0 && (
                    <span className="workPlanMonthlyView__countChip workPlanMonthlyView__countChip--progress">
                      {progressCount} בביצוע
                    </span>
                  )}
                  {doneCount > 0 && (
                    <span className="workPlanMonthlyView__countChip workPlanMonthlyView__countChip--done">
                      {doneCount} הושלמו
                    </span>
                  )}
                </div>
              </header>
              {tasks.length === 0 ? (
                <p className="workPlanMonthlyView__noTasks">אין משימות בפרויקט זה</p>
              ) : (
                <ul className="workPlanMonthlyView__tasks">
                  {tasks.map((task, taskIndex) => (
                    <li key={task.workItemId}>
                      <button
                        type="button"
                        className={`workPlanMonthlyView__taskButton ${monthlyTaskStatusClass(task.status)}`}
                        onClick={() =>
                          onTaskClick?.(buildWorkPlanTaskSelection(workPlan, task, taskIndex))
                        }
                        title={`${task.title} · ${getWorkPlanStatusDisplay(task.status)}`}
                      >
                        <span className="workPlanMonthlyView__taskDot" aria-hidden />
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
