import type { WorkPlanRange } from '../types';

const ANCHOR_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses the `date` URL param into an anchor Date. Falls back to "today" when
 * the value is missing or malformed so navigation never lands on an invalid
 * period. Display-only — does not influence scheduling math.
 */
export function parseAnchorDate(value?: string | null): Date {
  if (value && ANCHOR_PARAM_PATTERN.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setHours(0, 0, 0, 0);
      return parsed;
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export function toAnchorParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Sunday-based start of the week that contains the given date. */
export function startOfWeek(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function endOfWeek(date: Date): Date {
  const end = startOfWeek(date);
  end.setDate(end.getDate() + 6);
  return end;
}

/** Last day (28–31) of the month that `year`/`monthIndex` point at. */
function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Moves the anchor forward/backward by one period of the active range. Month
 * and year steps clamp the day so navigation never skips a month (e.g. Jan 31
 * → Feb 28 rather than Mar 3).
 */
export function addPeriod(anchor: Date, range: WorkPlanRange, direction: 1 | -1): Date {
  const next = new Date(anchor);
  next.setHours(0, 0, 0, 0);

  switch (range) {
    case 'daily':
      next.setDate(next.getDate() + direction);
      break;
    case 'weekly':
      next.setDate(next.getDate() + direction * 7);
      break;
    case 'monthly': {
      const day = next.getDate();
      const targetMonth = next.getMonth() + direction;
      next.setDate(1);
      next.setMonth(targetMonth);
      next.setDate(Math.min(day, lastDayOfMonth(next.getFullYear(), next.getMonth())));
      break;
    }
    case 'yearly': {
      const day = next.getDate();
      const targetYear = next.getFullYear() + direction;
      next.setDate(1);
      next.setFullYear(targetYear);
      next.setDate(Math.min(day, lastDayOfMonth(targetYear, next.getMonth())));
      break;
    }
  }

  return next;
}

export function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

/** Builds the human-readable label shown in the period navigator. */
export function formatPeriodLabel(anchor: Date, range: WorkPlanRange): string {
  switch (range) {
    case 'daily':
      return anchor.toLocaleDateString('he-IL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    case 'weekly': {
      const start = startOfWeek(anchor);
      const end = endOfWeek(anchor);
      const sameMonth = start.getMonth() === end.getMonth();
      const startLabel = start.toLocaleDateString('he-IL', {
        day: 'numeric',
        month: sameMonth ? undefined : 'short',
      });
      const endLabel = end.toLocaleDateString('he-IL', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      return `${startLabel} – ${endLabel}`;
    }
    case 'monthly':
      return anchor.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
    case 'yearly':
      return String(anchor.getFullYear());
  }
}
