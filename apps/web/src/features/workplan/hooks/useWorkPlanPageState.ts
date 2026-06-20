import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WORKPLAN_DEFAULTS, WORKPLAN_QUERY } from '../constants';
import {
  addPeriod,
  formatPeriodLabel,
  parseAnchorDate,
  toAnchorParam,
} from '../lib/workPlanPeriod';
import type {
  WorkPlanProjectFilter,
  WorkPlanRange,
  WorkPlanScope,
  WorkPlanTaskCategoryFilter,
} from '../types';

export function useWorkPlanPageState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const scope = (searchParams.get('scope') as WorkPlanScope) || WORKPLAN_DEFAULTS.SCOPE;
  const range = (searchParams.get('range') as WorkPlanRange) || WORKPLAN_DEFAULTS.RANGE;
  const statusFilter = searchParams.get('status') ?? 'all';
  const taskCategoryFilter =
    (searchParams.get('taskCategory') as WorkPlanTaskCategoryFilter) ?? 'all';
  const employeeFilterId = searchParams.get('employeeId') ?? '';
  const searchQuery = searchParams.get(WORKPLAN_QUERY.SEARCH) ?? '';

  const periodAnchor = useMemo(
    () => parseAnchorDate(searchParams.get(WORKPLAN_QUERY.DATE)),
    [searchParams],
  );

  const periodLabel = useMemo(
    () => formatPeriodLabel(periodAnchor, range),
    [periodAnchor, range],
  );

  // Optional deep-link target (e.g. from the dashboard): the WorkItem whose task drawer should open
  // automatically once the work-plan data has loaded. Absent for normal navigation.
  const requestedWorkItemId = useMemo(() => {
    const raw = searchParams.get(WORKPLAN_QUERY.WORK_ITEM_ID);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);

  const projectFilter = useMemo((): WorkPlanProjectFilter => {
    const raw = searchParams.get(WORKPLAN_QUERY.PROJECT_ID);
    if (!raw || raw.toLowerCase() === 'all') return 'all';
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 'all';
  }, [searchParams]);

  const setScope = useCallback(
    (nextScope: WorkPlanScope) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('scope', nextScope);
        if (nextScope !== 'project') {
          next.delete(WORKPLAN_QUERY.PROJECT_ID);
        }
        if (nextScope !== 'employee') {
          next.delete('employeeId');
        }
        return next;
      });
    },
    [setSearchParams],
  );

  const setRange = useCallback(
    (nextRange: WorkPlanRange) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('range', nextRange);
        return next;
      });
    },
    [setSearchParams],
  );

  const setProjectFilter = useCallback(
    (projectId: WorkPlanProjectFilter) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (projectId === 'all') {
          next.delete(WORKPLAN_QUERY.PROJECT_ID);
        } else {
          next.set('scope', 'project');
          next.set(WORKPLAN_QUERY.PROJECT_ID, String(projectId));
        }
        return next;
      });
    },
    [setSearchParams],
  );

  const setEmployeeFilterId = useCallback(
    (employeeId: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (employeeId) {
          next.set('scope', 'employee');
          next.set('employeeId', employeeId);
        } else {
          next.delete('employeeId');
        }
        return next;
      });
    },
    [setSearchParams],
  );

  const setStatusFilter = useCallback(
    (status: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('status', status);
        return next;
      });
    },
    [setSearchParams],
  );

  const setTaskCategoryFilter = useCallback(
    (category: WorkPlanTaskCategoryFilter) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (category === 'all') next.delete('taskCategory');
        else next.set('taskCategory', category);
        return next;
      });
    },
    [setSearchParams],
  );

  const setSearchQuery = useCallback(
    (query: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (query.trim()) next.set(WORKPLAN_QUERY.SEARCH, query);
          else next.delete(WORKPLAN_QUERY.SEARCH);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setPeriodAnchor = useCallback(
    (nextAnchor: Date) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set(WORKPLAN_QUERY.DATE, toAnchorParam(nextAnchor));
        return next;
      });
    },
    [setSearchParams],
  );

  const goToPreviousPeriod = useCallback(() => {
    setPeriodAnchor(addPeriod(periodAnchor, range, -1));
  }, [periodAnchor, range, setPeriodAnchor]);

  const goToNextPeriod = useCallback(() => {
    setPeriodAnchor(addPeriod(periodAnchor, range, 1));
  }, [periodAnchor, range, setPeriodAnchor]);

  const goToToday = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(WORKPLAN_QUERY.DATE);
      return next;
    });
  }, [setSearchParams]);

  const isAllProjectsMode = projectFilter === 'all';

  return {
    scope,
    range,
    statusFilter,
    taskCategoryFilter,
    employeeFilterId,
    projectFilter,
    isAllProjectsMode,
    searchQuery,
    requestedWorkItemId,
    periodAnchor,
    periodLabel,
    setScope,
    setRange,
    setProjectFilter,
    setEmployeeFilterId,
    setStatusFilter,
    setTaskCategoryFilter,
    setSearchQuery,
    goToPreviousPeriod,
    goToNextPeriod,
    goToToday,
  };
}
