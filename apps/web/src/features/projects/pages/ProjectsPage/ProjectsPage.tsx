import { useEffect, useMemo, useState } from 'react';
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
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [drawerState, setDrawerState] = useState<DrawerState | null>(null);

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

      return matchesStage && matchesSearch;
    });
  }, [projects, search, stageFilter]);

  useEffect(() => {
    const projectIdParam = searchParams.get('projectId');
    if (!projectIdParam || !projects?.length) return;

    const projectId = Number(projectIdParam);
    if (Number.isNaN(projectId)) return;

    setDrawerState({ projectId, mode: 'view' });
  }, [searchParams, projects]);

  const openProject = (project: ProjectListItem) => {
    setDrawerState({ projectId: project.workItemId, mode: 'view' });
    setSearchParams({ projectId: String(project.workItemId) });
  };

  const openCreateProject = () => {
    setDrawerState({ projectId: null, mode: 'create' });
    setSearchParams({});
  };

  const closeDrawer = () => {
    setDrawerState(null);
    setSearchParams({});
  };

  const handleProjectSaved = (projectId: number) => {
    setDrawerState({ projectId, mode: 'view' });
    setSearchParams({ projectId: String(projectId) });
    refetch();
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
        <Button type="button" onClick={openCreateProject}>
          פרויקט חדש
        </Button>
        <Input
          placeholder="חיפוש פרויקט..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="projectsPage__filter">
          <span>שלב</span>
          <select
            className="projectsPage__select"
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value)}
          >
            {STAGE_FILTER_OPTIONS.map((option) => (
              <option key={option.code || 'all'} value={option.code}>
                {option.display}
              </option>
            ))}
          </select>
        </label>
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
                <th>אתר</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((project) => {
                const statusMeta = getProjectStatusMeta(project.status);

                return (
                  <tr
                    key={project.workItemId}
                    className={
                      drawerState?.projectId === project.workItemId
                        ? 'projectsPage__row--selected'
                        : ''
                    }
                  >
                    <td>{project.projectNumber}</td>
                    <td>{project.title}</td>
                    <td>{project.customerName}</td>
                    <td>{project.projectManagerName}</td>
                    <td>
                      <Badge variant={statusMeta.badgeVariant}>{statusMeta.display}</Badge>
                    </td>
                    <td>{formatProjectDate(project.createdAt)}</td>
                    <td>{project.siteName}</td>
                    <td>
                      <Button variant="ghost" onClick={() => openProject(project)}>
                        פתח
                      </Button>
                    </td>
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
      />
    </PageShell>
  );
}
