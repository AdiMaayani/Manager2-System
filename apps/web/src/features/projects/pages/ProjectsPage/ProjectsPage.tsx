import { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { ProjectDrawerMode, ProjectDrawerTabId, ProjectListItem } from '../../types';
import {
  STAGE_FILTER_OPTIONS,
  formatProjectDate,
  getProjectStatusMeta,
} from '../../utils/projectDisplayUtils';
import './ProjectsPage.css';

interface DrawerState {
  projectId: number | null;
  mode: ProjectDrawerMode;
  initialTab?: ProjectDrawerTabId;
}

export function ProjectsPage() {
  const { data: projects, isLoading, error, refetch } = useProjects();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [stageFilter, setStageFilter] = useState(() => searchParams.get('stage') ?? '');
  const [customerFilter, setCustomerFilter] = useState(() => searchParams.get('customer') ?? '');
  const [pmFilter, setPmFilter] = useState(() => searchParams.get('pm') ?? '');
  const [siteFilter, setSiteFilter] = useState(() => searchParams.get('site') ?? '');
  const [drawerState, setDrawerState] = useState<DrawerState | null>(null);

  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>) => {
      const nextParams = new URLSearchParams(searchParams);

      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          nextParams.set(key, value);
        } else {
          nextParams.delete(key);
        }
      });

      setSearchParams(nextParams);
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

  const siteOptions = useMemo(
    () =>
      [...new Set((projects ?? []).map((p) => p.siteName).filter((s) => s !== '-'))].sort(),
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
      const matchesSite = !siteFilter || project.siteName === siteFilter;

      return matchesStage && matchesSearch && matchesCustomer && matchesPm && matchesSite;
    });
  }, [projects, search, stageFilter, customerFilter, pmFilter, siteFilter]);

  useEffect(() => {
    const modeParam = searchParams.get('mode');
    const tabParam = searchParams.get('tab') as ProjectDrawerTabId | null;
    const initialTab = tabParam ?? undefined;

    if (modeParam === 'create') {
      setDrawerState({ projectId: null, mode: 'create', initialTab });
      return;
    }

    const projectIdParam = searchParams.get('projectId');
    if (!projectIdParam) {
      setDrawerState(null);
      return;
    }

    const projectId = Number(projectIdParam);
    if (Number.isNaN(projectId)) return;

    setDrawerState({ projectId, mode: 'view', initialTab });
  }, [searchParams]);

  const openProject = (project: ProjectListItem) => {
    setDrawerState({ projectId: project.workItemId, mode: 'view', initialTab: 'overview' });
    updateSearchParams({
      projectId: String(project.workItemId),
      mode: null,
      tab: 'overview',
    });
  };

  const openCreateProject = () => {
    setDrawerState({ projectId: null, mode: 'create' });
    updateSearchParams({ projectId: null, mode: 'create', tab: 'overview' });
  };

  const closeDrawer = () => {
    setDrawerState(null);
    updateSearchParams({ projectId: null, mode: null, tab: null });
  };

  const handleProjectSaved = (projectId: number) => {
    setDrawerState({ projectId, mode: 'view', initialTab: 'overview' });
    updateSearchParams({ projectId: String(projectId), mode: null, tab: 'overview' });
    refetch();
  };

  const handleDrawerTabChange = (tabId: ProjectDrawerTabId) => {
    updateSearchParams({ tab: tabId });
    setDrawerState((current) =>
      current ? { ...current, initialTab: tabId } : current,
    );
  };

  const hasActiveFilters = Boolean(
    search || stageFilter || customerFilter || pmFilter || siteFilter,
  );

  const resetFilters = () => {
    setSearch('');
    setStageFilter('');
    setCustomerFilter('');
    setPmFilter('');
    setSiteFilter('');
    updateSearchParams({ search: null, stage: null, customer: null, pm: null, site: null });
  };

  const columns: DataTableColumn<ProjectListItem>[] = [
    { id: 'number', header: 'מספר', width: '110px', cell: (project) => project.projectNumber },
    { id: 'title', header: 'שם הפרויקט', cell: (project) => project.title },
    { id: 'customer', header: 'לקוח', cell: (project) => project.customerName },
    { id: 'pm', header: 'מנהל פרויקט', cell: (project) => project.projectManagerName },
    {
      id: 'status',
      header: 'סטטוס',
      cell: (project) => <StatusBadge domain="project" status={project.status} />,
    },
    {
      id: 'created',
      header: 'תאריך פתיחה',
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
        <FilterField label="אתר">
          <Select
            value={siteFilter}
            onChange={(event) => {
              setSiteFilter(event.target.value);
              updateSearchParams({ site: event.target.value || null });
            }}
          >
            <option value="">הכל</option>
            {siteOptions.map((name) => (
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
