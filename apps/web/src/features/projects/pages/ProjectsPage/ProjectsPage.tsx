import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { EmptyState } from '@shared/components/EmptyState';
import { Input } from '@shared/components/Input';
import { Button } from '@shared/components/Button';
import { Badge } from '@shared/components/Badge';
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
      <div className="projectsPage__toolbar">
        <div className="projectsPage__toolbarLead">
          <Button type="button" onClick={openCreateProject}>
            פרויקט חדש
          </Button>
          <div className="projectsPage__search">
            <Input
              placeholder="חיפוש לפי שם, לקוח או מספר..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                updateSearchParams({ search: event.target.value.trim() || null });
              }}
            />
          </div>
        </div>
        <div className="projectsPage__filters">
          <label className="projectsPage__filter">
            <span>שלב</span>
            <select
              className="projectsPage__select"
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
            </select>
          </label>
          <label className="projectsPage__filter">
            <span>לקוח</span>
            <select
              className="projectsPage__select"
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
            </select>
          </label>
          <label className="projectsPage__filter">
            <span>מנהל פרויקט</span>
            <select
              className="projectsPage__select"
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
            </select>
          </label>
          <label className="projectsPage__filter">
            <span>אתר</span>
            <select
              className="projectsPage__select"
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
            </select>
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="לא נמצאו פרויקטים" />
      ) : (
        <div className="projectsPage__tableWrap">
          <table className="projectsPage__table">
            <thead>
              <tr>
                <th>מספר</th>
                <th>שם</th>
                <th>לקוח</th>
                <th>מנהל</th>
                <th>סטטוס</th>
                <th>תאריך פתיחה</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((project) => {
                const statusMeta = getProjectStatusMeta(project.status);

                return (
                  <tr
                    key={project.workItemId}
                    role="button"
                    tabIndex={0}
                    className={`projectsPage__row ${
                      drawerState?.projectId === project.workItemId
                        ? 'projectsPage__row--selected'
                        : ''
                    }`.trim()}
                    onClick={() => openProject(project)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openProject(project);
                      }
                    }}
                  >
                    <td>{project.projectNumber}</td>
                    <td>{project.title}</td>
                    <td>{project.customerName}</td>
                    <td>{project.projectManagerName}</td>
                    <td>
                      <Badge variant={statusMeta.badgeVariant}>{statusMeta.display}</Badge>
                    </td>
                    <td>{formatProjectDate(project.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
