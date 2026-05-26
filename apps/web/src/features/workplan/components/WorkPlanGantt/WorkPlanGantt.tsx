import { useEffect, useRef } from 'react';
import Gantt from 'frappe-gantt';
import type { GanttTask } from '../../types';
import './WorkPlanGantt.css';

interface WorkPlanGanttProps {
  tasks: GanttTask[];
}

export function WorkPlanGantt({ tasks }: WorkPlanGanttProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || tasks.length === 0) return;

    containerRef.current.innerHTML = '';
    const ganttTasks = tasks.map((t) => ({
      id: t.id,
      name: t.name,
      start: t.start,
      end: t.end,
      progress: t.progress,
    }));

    new Gantt(containerRef.current, ganttTasks, {
      view_mode: 'Week',
      language: 'he',
    });
  }, [tasks]);

  return <div ref={containerRef} className="workPlanGantt" />;
}
