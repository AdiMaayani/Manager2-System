import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { Button } from '@shared/components/Button';
import { FilterBar, FilterField } from '@shared/components/FilterBar';
import { StatusBadge } from '@shared/components/StatusBadge';
import { DataTable, type DataTableColumn } from '@shared/components/DataTable';
import { ProjectDrawer } from '../../components/ProjectDrawer';
import { useProjects } from '../../hooks/useProjects';
import type { ProjectDrawerTabId, ProjectListItem } from '../../types';
import {
  STAGE_FILTER_OPTIONS,
  formatProjectDate,
  getProjectStatusMeta,
} from '../../utils/projectDisplayUtils';
import { resolveProjectDrawerState } from '../../utils/projectDrawerUrlState';
import './ProjectsPage.css';

export function ProjectsPage() {
  const { data: projects, isLoading, error, refetch } = useProjects();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [stageFilter, setStageFilter] = useState(() => searchParams.get('stage') ?? '');
  const [customerFilter, setCustomerFilter] = useState(() => searchParams.get('customer') ?? '');
  const [pmFilter, setPmFilter] = useState(() => searchParams.get('pm') ?? '');
  // The query string is the single source of truth for the drawer, so the drawer state is derived
  // from it rather than mirrored into local state via an effect (which previously required a
  // deferred setState to satisfy the lint rule and risked racing the param updates).
  const drawerState = useMemo(
    () => resolveProjectDrawerState(searchParams),
    [searchParams],
  );

  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>, options?: { replace?: boolean }) => {
      const nextParams = new URLSearchParams(searchParams);

      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          nextParams.set(key, value);
        } else {
          nextParams.delete(key);
        }
      });

      setSearchParams(nextParams, { replace: options?.replace ?? false });
    },
    [searchParams, setSearchParams],
  );

  const customerOptions = useMemo(
    () => [...new Set((projects ?? []).map((p) => p.customerName))].sort(),
    [projects],
  );

  const pmOptions = useMemo(
    () =>
      [...new Set((projects ?? []).map((p) => p.projectManagerName).filter((n) => n !== '-'))].sort(),
    [projects],
  );

  const filtered = useMemo(() => {
    if (!projects) return [];

    const query = search.trim().toLowerCase();

    return projects.filter((project) => {
      const statusMeta = getProjectStatusMeta(project.status);
      const matchesStage = !stageFilter || statusMeta.code === stageFilter;
      const matchesSearch =
        !query ||
        project.title.toLowerCase().includes(query) ||
        project.customerName.toLowerCase().includes(query) ||
        project.projectNumber.toLowerCase().includes(query);
      const matchesCustomer = !customerFilter || project.customerName === customerFilter;
      const matchesPm = !pmFilter || project.projectManagerName === pmFilter;

      return matchesStage && matchesSearch && matchesCustomer && matchesPm;
    });
  }, [projects, search, stageFilter, customerFilter, pmFilter]);

  const openProject = (project: ProjectListItem) => {
    updateSearchParams({
      projectId: String(project.workItemId),
      mode: null,
      tab: 'overview',
    });
  };

  const openCreateProject = () => {
    updateSearchParams({ projectId: null, mode: 'create', tab: 'overview' });
  };

  const closeDrawer = () => {
    updateSearchParams({ projectId: null, mode: null, tab: null });
  };

  const handleProjectSaved = (projectId: number) => {
    updateSearchParams({ projectId: String(projectId), mode: null, tab: 'overview' });
    refetch();
  };

  const handleDrawerTabChange = (tabId: ProjectDrawerTabId) => {
    // Manual tab switches replace the current history entry so browsing tabs inside an open project
    // does not add a back-button step per click, while the tab stays deep-linkable.
    updateSearchParams({ tab: tabId }, { replace: true });
  };

  const hasActiveFilters = Boolean(search || stageFilter || customerFilter || pmFilter);

  const resetFilters = () => {
    setSearch('');
    setStageFilter('');
    setCustomerFilter('');
    setPmFilter('');
    updateSearchParams({ search: null, stage: null, customer: null, pm: null, site: null });
  };

  const columns: DataTableColumn<ProjectListItem>[] = [
    { id: 'number', header: 'מספר', width: '110px', cell: (project) => project.projectNumber },
    { id: 'title', header: 'שם הפרויקט', cell: (project) => project.title },
    { id: 'customer', header: 'לקוח', width: '180px', cell: (project) => project.customerName },
    {
      id: 'pm',
      header: 'מנהל פרויקט',
      width: '160px',
      cell: (project) => project.projectManagerName,
    },
    {
      id: 'status',
      header: 'סטטוס',
      width: '130px',
      align: 'center',
      cell: (project) => <StatusBadge domain="project" status={project.status} />,
    },
    {
      id: 'created',
      header: 'תאריך פתיחה',
      width: '130px',
      align: 'end',
      cell: (project) => formatProjectDate(project.createdAt),
    },
  ];

  if (isLoading) {
    return (
      <PageShell title="פרויקטים" wide>
        <PageSpinner />
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell title="פרויקטים" wide>
        <ErrorState message={error.message} onRetry={() => refetch()} />
      </PageShell>
    );
  }

  return (
    <PageShell title="פרויקטים" wide>
      <FilterBar
        actions={
          <>
            {hasActiveFilters && (
              <Button type="button" variant="ghost" onClick={resetFilters}>
                נקה סינון
              </Button>
            )}
            <Button type="button" iconStart={<Plus size={18} />} onClick={openCreateProject}>
              פרויקט חדש
            </Button>
          </>
        }
      >
        <FilterField label="חיפוש" grow>
          <Input
            placeholder="חיפוש לפי שם, לקוח או מספר..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              updateSearchParams({ search: event.target.value.trim() || null });
            }}
          />
        </FilterField>
        <FilterField label="שלב">
          <Select
            value={stageFilter}
            onChange={(event) => {
              setStageFilter(event.target.value);
              updateSearchParams({ stage: event.target.value || null });
            }}
          >
            {STAGE_FILTER_OPTIONS.map((option) => (
              <option key={option.code || 'all'} value={option.code}>
                {option.display}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="לקוח">
          <Select
            value={customerFilter}
            onChange={(event) => {
              setCustomerFilter(event.target.value);
              updateSearchParams({ customer: event.target.value || null });
            }}
          >
            <option value="">הכל</option>
            {customerOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="מנהל פרויקט">
          <Select
            value={pmFilter}
            onChange={(event) => {
              setPmFilter(event.target.value);
              updateSearchParams({ pm: event.target.value || null });
            }}
          >
            <option value="">הכל</option>
            {pmOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={filtered}
        getRowId={(project) => project.workItemId}
        onRowClick={openProject}
        selectedRowId={drawerState?.projectId ?? null}
        emptyTitle="לא נמצאו פרויקטים"
        emptyDescription="התאימו את הסינון או צרו פרויקט חדש."
      />

      <ProjectDrawer
        isOpen={drawerState !== null}
        projectId={drawerState?.projectId ?? null}
        mode={drawerState?.mode ?? 'view'}
        initialTab={drawerState?.initialTab}
        onClose={closeDrawer}
        onSaved={handleProjectSaved}
        onActiveTabChange={handleDrawerTabChange}
      />
    </PageShell>
  );
}
