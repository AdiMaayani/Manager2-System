import { PlusCircle } from 'lucide-react';
import { Button } from '@shared/components/Button';
import { RANGE_LABELS, SCOPE_LABELS, STATUS_FILTER_OPTIONS } from '../../constants';
import type { WorkPlanProjectFilter, WorkPlanRange, WorkPlanScope } from '../../types';
import './WorkPlanToolbar.css';

interface ProjectOption {
  id: number;
  title: string;
}

interface WorkPlanToolbarProps {
  scope: WorkPlanScope;
  range: WorkPlanRange;
  statusFilter: string;
  projectFilter: WorkPlanProjectFilter;
  employeeFilterId: string;
  projectOptions: ProjectOption[];
  employees: Array<{ employeeId: number; fullName: string }>;
  onScopeChange: (scope: WorkPlanScope) => void;
  onRangeChange: (range: WorkPlanRange) => void;
  onStatusFilterChange: (status: string) => void;
  onProjectFilterChange: (projectId: WorkPlanProjectFilter) => void;
  onEmployeeFilterChange: (employeeId: string) => void;
  onNewTask: () => void;
  onSmartAssignment: () => void;
}

const SCOPES: WorkPlanScope[] = ['company', 'personal', 'employee', 'project'];
const RANGES: WorkPlanRange[] = ['daily', 'weekly', 'monthly', 'yearly'];

export function WorkPlanToolbar({
  scope,
  range,
  statusFilter,
  projectFilter,
  employeeFilterId,
  projectOptions,
  employees,
  onScopeChange,
  onRangeChange,
  onStatusFilterChange,
  onProjectFilterChange,
  onEmployeeFilterChange,
  onNewTask,
  onSmartAssignment,
}: WorkPlanToolbarProps) {
  return (
    <div className="workPlanToolbar card">
      <div className="workPlanToolbar__layout">
        <div className="workPlanToolbar__left">
          <Button type="button" onClick={onNewTask}>
            <PlusCircle size={18} aria-hidden />
            משימה חדשה
          </Button>
          <Button type="button" variant="secondary" onClick={onSmartAssignment}>
            שיבוץ חכם
          </Button>
        </div>

        <div className="workPlanToolbar__right">
          <div className="workPlanToolbar__tabsRow">
            <div className="workPlanToolbar__segment" role="tablist" aria-label="היקף תצוגה">
              {SCOPES.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={scope === item}
                  className={`workPlanToolbar__segBtn ${scope === item ? 'workPlanToolbar__segBtn--active' : ''}`}
                  onClick={() => onScopeChange(item)}
                >
                  {SCOPE_LABELS[item]}
                </button>
              ))}
            </div>

            <div className="workPlanToolbar__conditional">
              {scope === 'employee' && (
                <select
                  className="workPlanToolbar__select"
                  value={employeeFilterId}
                  onChange={(e) => onEmployeeFilterChange(e.target.value)}
                  aria-label="בחירת עובד"
                >
                  <option value="">כל העובדים</option>
                  {employees.map((employee) => (
                    <option key={employee.employeeId} value={String(employee.employeeId)}>
                      {employee.fullName}
                    </option>
                  ))}
                </select>
              )}

              {scope === 'project' && (
                <select
                  className="workPlanToolbar__select"
                  value={projectFilter === 'all' ? 'all' : String(projectFilter)}
                  onChange={(e) => {
                    const value = e.target.value;
                    onProjectFilterChange(value === 'all' ? 'all' : Number(value));
                  }}
                  aria-label="בחירת פרויקט"
                >
                  <option value="all">כל הפרויקטים</option>
                  {projectOptions.map((project) => (
                    <option key={project.id} value={String(project.id)}>
                      {project.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="workPlanToolbar__segment" role="tablist" aria-label="טווח תצוגה">
            {RANGES.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={range === item}
                className={`workPlanToolbar__segBtn ${range === item ? 'workPlanToolbar__segBtn--active' : ''}`}
                onClick={() => onRangeChange(item)}
              >
                {RANGE_LABELS[item]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="workPlanToolbar__filtersRow">
        <div className="workPlanToolbar__segment workPlanToolbar__segment--filters">
          {STATUS_FILTER_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`workPlanToolbar__segBtn ${statusFilter === option.id ? 'workPlanToolbar__segBtn--active' : ''}`}
              onClick={() => onStatusFilterChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="workPlanToolbar__legend" aria-label="מקרא משימות">
          <span className="workPlanToolbar__legendItem">
            <span className="workPlanToolbar__chip workPlanToolbar__chip--locked" /> נעול
          </span>
          <span className="workPlanToolbar__legendItem">
            <span className="workPlanToolbar__chip workPlanToolbar__chip--normal" /> רגיל
          </span>
          <span className="workPlanToolbar__legendItem">
            <span className="workPlanToolbar__chip workPlanToolbar__chip--warning" /> אזהרה
          </span>
        </div>
      </div>
    </div>
  );
}
