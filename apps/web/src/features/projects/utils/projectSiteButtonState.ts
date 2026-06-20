export interface ProjectSiteButtonStateInput {
  /** Selected site on the project form (0 = none). */
  siteId: number;
  /** Site id persisted on the project record when form.siteId is not yet synced. */
  projectSiteId?: number | null;
}

export function hasAssociatedProjectSite({
  siteId,
  projectSiteId,
}: ProjectSiteButtonStateInput): boolean {
  if (siteId > 0) {
    return true;
  }

  return (projectSiteId ?? 0) > 0;
}

export function getProjectSiteActionLabel(input: ProjectSiteButtonStateInput): 'הוסף אתר' | 'ערוך אתר' {
  return hasAssociatedProjectSite(input) ? 'ערוך אתר' : 'הוסף אתר';
}

export function getProjectSiteToggleLabel(
  input: ProjectSiteButtonStateInput,
  isSiteFormOpen: boolean,
): string {
  if (isSiteFormOpen) {
    return hasAssociatedProjectSite(input) ? 'ביטול עריכת אתר' : 'ביטול הוספת אתר';
  }

  return getProjectSiteActionLabel(input);
}
