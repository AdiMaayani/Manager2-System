import type { BadgeVariant } from '@shared/components/Badge';

export interface StatusMeta {
  label: string;
  variant: BadgeVariant;
}

/**
 * Domains that carry a status with a semantic colour. Centralising these maps
 * removes the duplicated/conflicting per-feature lookups the audit found (e.g.
 * the triplicated service-call map and the report list/detail disagreement).
 */
export type StatusDomain =
  | 'project'
  | 'milestone'
  | 'equipment'
  | 'quote'
  | 'serviceCall'
  | 'serviceCallPriority'
  | 'workPlanTask'
  | 'report'
  | 'severity';

type StatusMap = Record<string, StatusMeta>;

const PROJECT: StatusMap = {
  Open: { label: 'פתוח', variant: 'neutral' },
  Planned: { label: 'בתכנון', variant: 'primary' },
  Design: { label: 'תוכניות', variant: 'primary' },
  Wiring: { label: 'השחלה', variant: 'warning' },
  Execution: { label: 'ביצוע', variant: 'warning' },
  Closed: { label: 'סיום', variant: 'success' },
  Cancelled: { label: 'מבוטל', variant: 'neutral' },
};

const MILESTONE: StatusMap = {
  Planned: { label: 'מתוכנן', variant: 'primary' },
  Execution: { label: 'בביצוע', variant: 'warning' },
  Closed: { label: 'סגור', variant: 'success' },
  Cancelled: { label: 'מבוטל', variant: 'neutral' },
};

const EQUIPMENT: StatusMap = {
  installed: { label: 'מותקן', variant: 'success' },
  installing: { label: 'בהתקנה', variant: 'warning' },
  ordered: { label: 'בהזמנה', variant: 'primary' },
  waiting: { label: 'ממתין', variant: 'neutral' },
};

const QUOTE: StatusMap = {
  Draft: { label: 'טיוטה', variant: 'neutral' },
  Sent: { label: 'נשלח', variant: 'primary' },
  Tracking: { label: 'במעקב', variant: 'warning' },
  Approved: { label: 'אושר', variant: 'success' },
  Rejected: { label: 'נדחה', variant: 'danger' },
};

const SERVICE_CALL: StatusMap = {
  Open: { label: 'פתוחה', variant: 'warning' },
  InProgress: { label: 'בטיפול', variant: 'primary' },
  Done: { label: 'בוצעה', variant: 'success' },
  Cancelled: { label: 'בוטלה', variant: 'danger' },
};

const SERVICE_CALL_PRIORITY: StatusMap = {
  Low: { label: 'נמוכה', variant: 'neutral' },
  Medium: { label: 'רגילה', variant: 'neutral' },
  High: { label: 'גבוהה', variant: 'warning' },
  Urgent: { label: 'דחופה', variant: 'danger' },
};

/** Work-plan task status arrives as free text; classify by keyword. */
const WORK_PLAN_TASK: StatusMap = {
  done: { label: 'הושלם', variant: 'success' },
  inProgress: { label: 'בביצוע', variant: 'primary' },
  planned: { label: 'מתוכנן', variant: 'neutral' },
};

/** Report status arrives as Hebrew display text from the backend. */
const REPORT: StatusMap = {
  'טיוטה': { label: 'טיוטה', variant: 'neutral' },
  'הוגש': { label: 'הוגש', variant: 'primary' },
  'הועבר להנה״ח': { label: 'הועבר להנה״ח', variant: 'success' },
};

const SEVERITY: StatusMap = {
  Info: { label: 'מידע', variant: 'neutral' },
  Warning: { label: 'אזהרה', variant: 'warning' },
  Critical: { label: 'קריטי', variant: 'danger' },
};

const REGISTRY: Record<StatusDomain, StatusMap> = {
  project: PROJECT,
  milestone: MILESTONE,
  equipment: EQUIPMENT,
  quote: QUOTE,
  serviceCall: SERVICE_CALL,
  serviceCallPriority: SERVICE_CALL_PRIORITY,
  workPlanTask: WORK_PLAN_TASK,
  report: REPORT,
  severity: SEVERITY,
};

/**
 * Resolve a raw status string to a label + badge variant. Falls back to a
 * neutral badge that echoes the raw value, so unknown statuses are still shown.
 */
export function resolveStatus(domain: StatusDomain, status?: string | null): StatusMeta {
  const raw = String(status ?? '').trim();
  if (!raw) return { label: '—', variant: 'neutral' };

  const map = REGISTRY[domain];
  if (map[raw]) return map[raw];

  // Case-insensitive fallback for free-text domains (e.g. work-plan tasks).
  const lower = raw.toLowerCase();
  const match = Object.keys(map).find((key) => key.toLowerCase() === lower);
  if (match) return map[match];

  return { label: raw, variant: 'neutral' };
}
