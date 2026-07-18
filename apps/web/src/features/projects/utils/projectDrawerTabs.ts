import type { ProjectDrawerTabId } from '../types';

// Canonical set of project drawer tabs (ids only). Kept separate from the labelled tab list so the
// validation logic can be unit tested without pulling in React/component code.
export const PROJECT_DRAWER_TAB_IDS: readonly ProjectDrawerTabId[] = [
  'overview',
  'milestones',
  'quote',
  'boq',
  'drawings',
  'equipment',
];

export function isProjectDrawerTabId(value: unknown): value is ProjectDrawerTabId {
  return typeof value === 'string' && (PROJECT_DRAWER_TAB_IDS as readonly string[]).includes(value);
}

// Resolve an externally requested tab (e.g. from the URL) to a valid tab, falling back to the
// overview tab when the request is missing or unrecognized.
export function resolveProjectDrawerTab(
  candidate: ProjectDrawerTabId | null | undefined,
): ProjectDrawerTabId {
  return isProjectDrawerTabId(candidate) ? candidate : 'overview';
}
