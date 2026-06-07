import { useCallback, useEffect, useState } from 'react';

export type DashboardSectionId =
  | 'kpis'
  | 'attentionTasks'
  | 'dailyTasks'
  | 'alerts'
  | 'activeProjects'
  | 'serviceCalls'
  | 'quotes'
  | 'recentReports'
  | 'recentActivity'
  | 'lowStock';

export interface DashboardSectionMeta {
  id: DashboardSectionId;
  label: string;
}

export const DASHBOARD_SECTIONS: DashboardSectionMeta[] = [
  { id: 'kpis', label: 'מדדים מהירים' },
  { id: 'attentionTasks', label: 'משימות הדורשות טיפול' },
  { id: 'dailyTasks', label: 'משימות להיום' },
  { id: 'alerts', label: 'התראות ניהוליות' },
  { id: 'activeProjects', label: 'פרויקטים פעילים' },
  { id: 'serviceCalls', label: 'קריאות שירות פתוחות' },
  { id: 'quotes', label: 'הצעות מחיר אחרונות' },
  { id: 'recentReports', label: 'דיווחים אחרונים' },
  { id: 'recentActivity', label: 'פעילות אחרונה' },
  { id: 'lowStock', label: 'מלאי במחסור' },
];

// UI-only preference; persisted locally so each user keeps their layout without
// any database/server involvement on this branch.
const STORAGE_KEY = 'manager2_dashboard_sections_v1';

type SectionVisibility = Record<DashboardSectionId, boolean>;

function buildDefaultVisibility(): SectionVisibility {
  return DASHBOARD_SECTIONS.reduce((accumulator, section) => {
    accumulator[section.id] = true;
    return accumulator;
  }, {} as SectionVisibility);
}

function readStoredVisibility(): SectionVisibility {
  const defaults = buildDefaultVisibility();

  if (typeof window === 'undefined') return defaults;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw) as Partial<Record<DashboardSectionId, boolean>>;
    return DASHBOARD_SECTIONS.reduce((accumulator, section) => {
      accumulator[section.id] =
        typeof parsed[section.id] === 'boolean' ? Boolean(parsed[section.id]) : true;
      return accumulator;
    }, {} as SectionVisibility);
  } catch {
    return defaults;
  }
}

export function useDashboardPreferences() {
  const [visibility, setVisibility] = useState<SectionVisibility>(readStoredVisibility);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
    } catch {
      // Ignore storage write failures (e.g. private mode); UI state still works.
    }
  }, [visibility]);

  const toggleSection = useCallback((sectionId: DashboardSectionId) => {
    setVisibility((current) => ({ ...current, [sectionId]: !current[sectionId] }));
  }, []);

  const resetSections = useCallback(() => {
    setVisibility(buildDefaultVisibility());
  }, []);

  const isVisible = useCallback(
    (sectionId: DashboardSectionId) => visibility[sectionId] ?? true,
    [visibility],
  );

  const hiddenCount = DASHBOARD_SECTIONS.filter((section) => !visibility[section.id]).length;

  return { visibility, isVisible, toggleSection, resetSections, hiddenCount };
}
