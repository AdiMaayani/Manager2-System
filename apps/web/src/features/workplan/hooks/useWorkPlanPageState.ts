import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WORKPLAN_DEFAULTS, WORKPLAN_QUERY } from '../constants';
import type { WorkPlanProjectFilter, WorkPlanRange, WorkPlanScope } from '../types';

export function useWorkPlanPageState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const scope = (searchParams.get('scope') as WorkPlanScope) || WORKPLAN_DEFAULTS.SCOPE;
  const range = (searchParams.get('range') as WorkPlanRange) || WORKPLAN_DEFAULTS.RANGE;
  const statusFilter = searchParams.get('status') ?? 'all';
  const employeeFilterId = searchParams.get('employeeId') ?? '';

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

  const isAllProjectsMode = projectFilter === 'all';

  return {
    scope,
    range,
    statusFilter,
    employeeFilterId,
    projectFilter,
    isAllProjectsMode,
    setScope,
    setRange,
    setProjectFilter,
    setEmployeeFilterId,
    setStatusFilter,
  };
}
