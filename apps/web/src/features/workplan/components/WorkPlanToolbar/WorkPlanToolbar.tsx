import {
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Printer,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@shared/components/Button';
import { IconButton } from '@shared/components/IconButton';
import { Select } from '@shared/components/Select';
import { SegmentedControl, type SegmentItem } from '@shared/components/SegmentedControl';
import { RANGE_LABELS, SCOPE_LABELS, STATUS_FILTER_OPTIONS, TASK_CATEGORY_FILTER_OPTIONS } from '../../constants';
import { TASK_CATEGORY_LEGEND_ITEMS } from '@shared/constants/taskCategoryStyles';
import type { WorkPlanProjectFilter, WorkPlanRange, WorkPlanScope, WorkPlanTaskCategoryFilter } from '../../types';
import './WorkPlanToolbar.css';

interface ProjectOption {
  id: number;
  title: string;
}

interface WorkPlanToolbarProps {
  scope: WorkPlanScope;
  range: WorkPlanRange;
  statusFilter: string;
  taskCategoryFilter: WorkPlanTaskCategoryFilter;
  projectFilter: WorkPlanProjectFilter;
  employeeFilterId: string;
  searchQuery: string;
  periodLabel: string;
  projectOptions: ProjectOption[];
  employees: Array<{ employeeId: number; fullName: string }>;
  onScopeChange: (scope: WorkPlanScope) => void;
  onRangeChange: (range: WorkPlanRange) => void;
  onStatusFilterChange: (status: string) => void;
  onTaskCategoryFilterChange: (category: WorkPlanTaskCategoryFilter) => void;
  onProjectFilterChange: (projectId: WorkPlanProjectFilter) => void;
  onEmployeeFilterChange: (employeeId: string) => void;
  onSearchChange: (query: string) => void;
  onPreviousPeriod: () => void;
  onNextPeriod: () => void;
  onToday: () => void;
  onPrint: () => void;
  onNewTask: () => void;
  canCreateTask: boolean;
}

const SCOPE_ITEMS: SegmentItem<WorkPlanScope>[] = (
  ['company', 'personal', 'employee', 'project'] as WorkPlanScope[]
).map((id) => ({ id, label: SCOPE_LABELS[id] }));

const RANGE_ITEMS: SegmentItem<WorkPlanRange>[] = (
  ['daily', 'weekly', 'monthly', 'yearly'] as WorkPlanRange[]
).map((id) => ({ id, label: RANGE_LABELS[id] }));

const OVERLAY_LEGEND_ITEMS: Array<{ modifier: string; label: string }> = [
  { modifier: 'locked', label: 'נעולה' },
  { modifier: 'warning', label: 'אזהרה' },
  { modifier: 'violation', label: 'חריגה / ללא שיבוץ' },
  { modifier: 'urgent', label: 'דחוף' },
  { modifier: 'unscheduled', label: 'לא מתוזמנת' },
];

export function WorkPlanToolbar({
  scope,
  range,
  statusFilter,
  taskCategoryFilter,
  projectFilter,
  employeeFilterId,
  searchQuery,
  periodLabel,
  projectOptions,
  employees,
  onScopeChange,
  onRangeChange,
  onStatusFilterChange,
  onTaskCategoryFilterChange,
  onProjectFilterChange,
  onEmployeeFilterChange,
  onSearchChange,
  onPreviousPeriod,
  onNextPeriod,
  onToday,
  onPrint,
  onNewTask,
  canCreateTask,
}: WorkPlanToolbarProps) {
  const isProjectScope = scope === 'project';

  return (
    <div className="workPlanToolbar card">
      <div className="workPlanToolbar__main">
        <div className="workPlanToolbar__selectors">
          <div className="workPlanToolbar__group">
            <span className="workPlanToolbar__groupLabel">חתך</span>
            <div className="workPlanToolbar__scopeRow">
              <SegmentedControl
                items={SCOPE_ITEMS}
                value={scope}
                onChange={onScopeChange}
                ariaLabel="היקף תצוגה"
              />

              {scope === 'employee' && (
                <Select
                  value={employeeFilterId}
                  onChange={(e) => onEmployeeFilterChange(e.target.value)}
                  aria-label="בחירת עובד"
                  required
                >
                  <option value="">בחר עובד</option>
                  {employees.map((employee) => (
                    <option key={employee.employeeId} value={String(employee.employeeId)}>
                      {employee.fullName}
                    </option>
                  ))}
                </Select>
              )}

              {isProjectScope && (
                <Select
                  value={projectFilter === 'all' ? '' : String(projectFilter)}
                  onChange={(e) => {
                    const value = e.target.value;
                    onProjectFilterChange(value ? Number(value) : 'all');
                  }}
                  aria-label="בחירת פרויקט"
                  required
                >
                  <option value="">בחר פרויקט</option>
                  {projectOptions.map((project) => (
                    <option key={project.id} value={String(project.id)}>
                      {project.title}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          </div>

          <div className="workPlanToolbar__group">
            <span className="workPlanToolbar__groupLabel">תצוגה</span>
            <SegmentedControl
              items={RANGE_ITEMS}
              value={range}
              onChange={onRangeChange}
              ariaLabel="טווח תצוגה"
            />
          </div>

          <div className="workPlanToolbar__group">
            <span className="workPlanToolbar__groupLabel">סוג משימה</span>
            <Select
              value={taskCategoryFilter}
              onChange={(e) =>
                onTaskCategoryFilterChange(e.target.value as WorkPlanTaskCategoryFilter)
              }
              aria-label="סינון לפי סוג משימה"
            >
              {TASK_CATEGORY_FILTER_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="workPlanToolbar__group">
            <span className="workPlanToolbar__groupLabel">סטטוס</span>
            <Select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              aria-label="סינון לפי סטטוס"
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="workPlanToolbar__actions">
          {canCreateTask && (
            <Button type="button" iconStart={<Plus size={18} />} onClick={onNewTask}>
              משימה חדשה
            </Button>
          )}
          <div className="workPlanToolbar__iconActions">
            <IconButton
              variant="subtle"
              onClick={onPrint}
              label="הדפסה"
              title="הדפסת התצוגה הנוכחית"
              icon={<Printer size={18} />}
            />
            <IconButton
              variant="subtle"
              disabled
              label="ייצוא (בקרוב)"
              title="ייצוא נתונים — בקרוב"
              icon={<Download size={18} />}
            />
            <IconButton
              variant="subtle"
              disabled
              label="ייבוא (בקרוב)"
              title="ייבוא נתונים — בקרוב"
              icon={<Upload size={18} />}
            />
          </div>
        </div>
      </div>

      <div className="workPlanToolbar__tools">
        <div className="workPlanToolbar__nav" role="group" aria-label="ניווט בין תקופות">
          <IconButton
            variant="subtle"
            onClick={onPreviousPeriod}
            label="התקופה הקודמת"
            title="הקודם"
            icon={<ChevronRight size={18} />}
          />
          <Button type="button" variant="secondary" size="sm" onClick={onToday}>
            היום
          </Button>
          <IconButton
            variant="subtle"
            onClick={onNextPeriod}
            label="התקופה הבאה"
            title="הבא"
            icon={<ChevronLeft size={18} />}
          />
          <span className="workPlanToolbar__periodLabel" aria-live="polite">
            {periodLabel}
          </span>
        </div>

        <div className="workPlanToolbar__search">
          <Search size={16} aria-hidden className="workPlanToolbar__searchIcon" />
          <input
            type="search"
            className="workPlanToolbar__searchInput"
            placeholder="חיפוש משימה, פרויקט, עובד, תפקיד או סטטוס"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="חיפוש בתוכנית העבודה"
          />
          {searchQuery && (
            <button
              type="button"
              className="workPlanToolbar__searchClear"
              onClick={() => onSearchChange('')}
              aria-label="נקה חיפוש"
              title="נקה חיפוש"
            >
              <X size={14} aria-hidden />
            </button>
          )}
        </div>
      </div>

      <div className="workPlanToolbar__legend" aria-label="מקרא משימות">
        {TASK_CATEGORY_LEGEND_ITEMS.map((item) => (
          <span key={item.modifier} className="workPlanToolbar__legendItem">
            <span
              className={`workPlanToolbar__chip workPlanToolbar__chip--${item.modifier}`}
              aria-hidden
            />
            {item.label}
          </span>
        ))}
        {OVERLAY_LEGEND_ITEMS.map((item) => (
          <span key={item.modifier} className="workPlanToolbar__legendItem">
            <span
              className={`workPlanToolbar__chip workPlanToolbar__chip--${item.modifier}`}
              aria-hidden
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
