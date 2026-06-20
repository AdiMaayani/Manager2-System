import { describe, expect, it } from 'vitest';
import {
  getProjectSiteActionLabel,
  getProjectSiteToggleLabel,
  hasAssociatedProjectSite,
} from './projectSiteButtonState';

describe('projectSiteButtonState', () => {
  it('shows add label when the project has no associated site', () => {
    expect(
      getProjectSiteActionLabel({ siteId: 0, projectSiteId: null }),
    ).toBe('הוסף אתר');
  });

  it('shows edit label when the project form has a site id', () => {
    expect(
      getProjectSiteActionLabel({ siteId: 15, projectSiteId: null }),
    ).toBe('ערוך אתר');
  });

  it('shows edit label when only the persisted project site id is available', () => {
    expect(
      getProjectSiteActionLabel({ siteId: 0, projectSiteId: 22 }),
    ).toBe('ערוך אתר');
  });

  it('switches to edit label immediately after a site is attached to the form', () => {
    const beforeCreate = getProjectSiteActionLabel({ siteId: 0, projectSiteId: null });
    const afterCreate = getProjectSiteActionLabel({ siteId: 31, projectSiteId: null });

    expect(beforeCreate).toBe('הוסף אתר');
    expect(afterCreate).toBe('ערוך אתר');
  });

  it('keeps edit label while editing an existing site', () => {
    expect(
      getProjectSiteToggleLabel({ siteId: 31, projectSiteId: 31 }, true),
    ).toBe('ביטול עריכת אתר');
    expect(
      getProjectSiteActionLabel({ siteId: 31, projectSiteId: 31 }),
    ).toBe('ערוך אתר');
  });

  it('derives association from project site id rather than address profile presence', () => {
    expect(hasAssociatedProjectSite({ siteId: 0, projectSiteId: 8 })).toBe(true);
    expect(hasAssociatedProjectSite({ siteId: 0, projectSiteId: 0 })).toBe(false);
  });
});
