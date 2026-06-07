import {
  ChevronLeft,
  ChevronRight,
  Download,
  PlusCircle,
  Printer,
  Search,
  Upload,
  X,
} from 'lucide-react';
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
  searchQuery: string;
  periodLabel: string;
  projectOptions: ProjectOption[];
  employees: Array<{ employeeId: number; fullName: string }>;
  onScopeChange: (scope: WorkPlanScope) => void;
  onRangeChange: (range: WorkPlanRange) => void;
  onStatusFilterChange: (status: string) => void;
  onProjectFilterChange: (projectId: WorkPlanProjectFilter) => void;
  onEmployeeFilterChange: (employeeId: string) => void;
  onSearchChange: (query: string) => void;
  onPreviousPeriod: () => void;
  onNextPeriod: () => void;
  onToday: () => void;
  onPrint: () => void;
  onNewTask: () => void;
}

const SCOPES: WorkPlanScope[] = ['company', 'personal', 'employee', 'project'];
const RANGES: WorkPlanRange[] = ['daily', 'weekly', 'monthly', 'yearly'];

const LEGEND_ITEMS: Array<{ modifier: string; label: string }> = [
  { modifier: 'normal', label: 'משימת פרויקט' },
  { modifier: 'locked', label: 'נעולה' },
  { modifier: 'warning', label: 'אזהרה' },
  { modifier: 'violation', label: 'חריגה / ללא שיבוץ' },
  { modifier: 'urgent', label: 'דחוף' },
];

export function WorkPlanToolbar({
  scope,
  range,
  statusFilter,
  projectFilter,
  employeeFilterId,
  searchQuery,
  periodLabel,
  projectOptions,
  employees,
  onScopeChange,
  onRangeChange,
  onStatusFilterChange,
  onProjectFilterChange,
  onEmployeeFilterChange,
  onSearchChange,
  onPreviousPeriod,
  onNextPeriod,
  onToday,
  onPrint,
  onNewTask,
}: WorkPlanToolbarProps) {
  const isProjectScope = scope === 'project';

  return (
    <div className="workPlanToolbar card">
      <div className="workPlanToolbar__main">
        <div className="workPlanToolbar__selectors">
          <div className="workPlanToolbar__group">
            <span className="workPlanToolbar__groupLabel">חתך</span>
            <div className="workPlanToolbar__scopeRow">
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

              {isProjectScope && (
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

          <div className="workPlanToolbar__group">
            <span className="workPlanToolbar__groupLabel">תצוגה</span>
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

          {isProjectScope && (
            <div className="workPlanToolbar__group">
              <span className="workPlanToolbar__groupLabel">סטטוס</span>
              <select
                className="workPlanToolbar__select"
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value)}
                aria-label="סינון לפי סטטוס"
              >
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="workPlanToolbar__actions">
          <Button type="button" onClick={onNewTask}>
            <PlusCircle size={18} aria-hidden />
            משימה חדשה
          </Button>
          <div className="workPlanToolbar__iconActions">
            <button
              type="button"
              className="workPlanToolbar__iconBtn"
              onClick={onPrint}
              title="הדפסת התצוגה הנוכחית"
              aria-label="הדפסה"
            >
              <Printer size={18} aria-hidden />
            </button>
            <button
              type="button"
              className="workPlanToolbar__iconBtn"
              disabled
              title="ייצוא נתונים — בקרוב"
              aria-label="ייצוא (בקרוב)"
            >
              <Download size={18} aria-hidden />
            </button>
            <button
              type="button"
              className="workPlanToolbar__iconBtn"
              disabled
              title="ייבוא נתונים — בקרוב"
              aria-label="ייבוא (בקרוב)"
            >
              <Upload size={18} aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <div className="workPlanToolbar__tools">
        <div className="workPlanToolbar__nav" role="group" aria-label="ניווט בין תקופות">
          <button
            type="button"
            className="workPlanToolbar__navBtn"
            onClick={onPreviousPeriod}
            aria-label="התקופה הקודמת"
            title="הקודם"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
          <button type="button" className="workPlanToolbar__todayBtn" onClick={onToday}>
            היום
          </button>
          <button
            type="button"
            className="workPlanToolbar__navBtn"
            onClick={onNextPeriod}
            aria-label="התקופה הבאה"
            title="הבא"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
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
        {LEGEND_ITEMS.map((item) => (
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
