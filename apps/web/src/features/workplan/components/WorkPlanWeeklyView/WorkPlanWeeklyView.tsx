import { useMemo } from 'react';
import { WEEKDAY_LABELS } from '../../constants';
import type { MappedWorkPlan } from '../../types';
import { resolveAssignment } from '../../lib/workPlanScheduling';
import './WorkPlanWeeklyView.css';

interface WorkPlanWeeklyViewProps {
  workPlans: MappedWorkPlan[];
  statusFilter: string;
  onTaskClick?: (taskId: number, projectTitle: string, title: string) => void;
}

function matchesStatus(status: string, filter: string): boolean {
  if (filter === 'all') return true;
  const n = status.toLowerCase();
  if (filter === 'planned') return n.includes('תכנון') || n.includes('מתוכנן');
  if (filter === 'in-progress') return n.includes('ביצוע');
  if (filter === 'done') return n.includes('הושלם') || n.includes('סיום');
  return true;
}

export function WorkPlanWeeklyView({
  workPlans,
  statusFilter,
  onTaskClick,
}: WorkPlanWeeklyViewProps) {
  const weekStart = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
    return start;
  }, []);

  const rows = useMemo(() => {
    const assigneeMap = new Map<string, Map<number, Array<{ id: number; title: string; project: string }>>>();

    for (const workPlan of workPlans) {
      for (const task of workPlan.tasks) {
        if (!matchesStatus(task.status, statusFilter)) continue;
        const assignment = resolveAssignment(task, workPlan);
        const assignee = assignment.displayName || 'לא משויך';
        if (!assigneeMap.has(assignee)) {
          assigneeMap.set(assignee, new Map());
        }
        const dayIndex = task.plannedStart
          ? new Date(task.plannedStart).getDay()
          : task.workItemId % 5;
        const dayTasks = assigneeMap.get(assignee)!;
        if (!dayTasks.has(dayIndex)) dayTasks.set(dayIndex, []);
        dayTasks.get(dayIndex)!.push({
          id: task.workItemId,
          title: task.title,
          project: workPlan.project.title,
        });
      }
    }

    return Array.from(assigneeMap.entries()).map(([assignee, dayMap]) => ({
      assignee,
      days: WEEKDAY_LABELS.map((_, index) => dayMap.get(index) ?? []),
    }));
  }, [workPlans, statusFilter]);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const title = `${weekStart.toLocaleDateString('he-IL')} – ${weekEnd.toLocaleDateString('he-IL')}`;

  return (
    <div className="workPlanWeeklyView card">
      <h3 className="workPlanWeeklyView__title">תצוגה שבועית · {title}</h3>
      <div className="workPlanWeeklyView__grid">
        <div className="workPlanWeeklyView__header">
          <div className="workPlanWeeklyView__nameHeader" />
          {WEEKDAY_LABELS.map((day, index) => {
            const dayDate = new Date(weekStart);
            dayDate.setDate(weekStart.getDate() + index);
            return (
              <div key={day} className="workPlanWeeklyView__dayHeader">
                <div>{day}</div>
                <div className="workPlanWeeklyView__dayDate">
                  {dayDate.getDate()}/{dayDate.getMonth() + 1}
                </div>
              </div>
            );
          })}
        </div>

        {rows.length === 0 ? (
          <div className="workPlanWeeklyView__empty">אין משימות לשבוע הנוכחי</div>
        ) : (
          rows.map((row) => (
            <div key={row.assignee} className="workPlanWeeklyView__row">
              <div className="workPlanWeeklyView__name">{row.assignee}</div>
              {row.days.map((tasks, dayIndex) => (
                <div key={`${row.assignee}-${dayIndex}`} className="workPlanWeeklyView__cell">
                  {tasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      className="workPlanWeeklyView__task"
                      onClick={() => onTaskClick?.(task.id, task.project, task.title)}
                    >
                      {task.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
