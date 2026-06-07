import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WORKPLAN_DEFAULTS, WORKPLAN_QUERY } from '../constants';
import {
  addPeriod,
  formatPeriodLabel,
  parseAnchorDate,
  toAnchorParam,
} from '../lib/workPlanPeriod';
import type { WorkPlanProjectFilter, WorkPlanRange, WorkPlanScope } from '../types';

export function useWorkPlanPageState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const scope = (searchParams.get('scope') as WorkPlanScope) || WORKPLAN_DEFAULTS.SCOPE;
  const range = (searchParams.get('range') as WorkPlanRange) || WORKPLAN_DEFAULTS.RANGE;
  const statusFilter = searchParams.get('status') ?? 'all';
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
          next.set(WORKPLAN_QUERY.PROJECT_ID, 'all');
        } else {
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
        if (employeeId) next.set('employeeId', employeeId);
        else next.delete('employeeId');
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
    employeeFilterId,
    projectFilter,
    isAllProjectsMode,
    searchQuery,
    periodAnchor,
    periodLabel,
    setScope,
    setRange,
    setProjectFilter,
    setEmployeeFilterId,
    setStatusFilter,
    setSearchQuery,
    goToPreviousPeriod,
    goToNextPeriod,
    goToToday,
  };
}
