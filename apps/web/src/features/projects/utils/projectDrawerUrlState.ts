import type { ProjectDrawerMode, ProjectDrawerTabId } from '../types';

export interface ProjectDrawerUrlState {
  projectId: number | null;
  mode: ProjectDrawerMode;
  initialTab?: ProjectDrawerTabId;
}

// Derive the projects drawer state purely from the query string, which is the single source of
// truth for the drawer. `mode=create` opens the create drawer; a valid positive `projectId` opens
// the review drawer; anything else (missing/invalid id) keeps the drawer closed so malformed links
// fail safely. `tab` selects the initial tab when present.
export function resolveProjectDrawerState(
  params: URLSearchParams,
): ProjectDrawerUrlState | null {
  const tabParam = params.get('tab') as ProjectDrawerTabId | null;
  const initialTab = tabParam ?? undefined;

  if (params.get('mode') === 'create') {
    return { projectId: null, mode: 'create', initialTab };
  }

  const projectIdParam = params.get('projectId');
  if (!projectIdParam) return null;

  const projectId = Number(projectIdParam);
  if (!Number.isInteger(projectId) || projectId <= 0) return null;

  return { projectId, mode: 'view', initialTab };
}
