const ISRAEL_TZ = 'Asia/Jerusalem';

/** Formats a Date as UTC ISO 8601 with Z suffix for API payloads. */
export function toUtcIsoString(date: Date): string {
  return date.toISOString();
}

/** Parses an API UTC timestamp into a Date (throws on invalid input). */
export function parseUtcIso(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('תאריך/שעה אינם תקינים');
  }
  return parsed;
}

/** Local calendar date YYYY-MM-DD in Israel timezone. */
export function localDateKeyFromUtc(utcValue: string | Date): string {
  const date = utcValue instanceof Date ? utcValue : parseUtcIso(utcValue);
  return date.toLocaleDateString('en-CA', { timeZone: ISRAEL_TZ });
}

/** Local time HH:mm in Israel timezone from a UTC timestamp. */
export function localTimeFromUtc(utcValue: string | Date): string {
  const date = utcValue instanceof Date ? utcValue : parseUtcIso(utcValue);
  return date.toLocaleTimeString('en-GB', {
    timeZone: ISRAEL_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Splits a UTC ISO timestamp into local date + time parts (Israel). */
export function utcToLocalParts(utcValue: string): { date: string; time: string } {
  return {
    date: localDateKeyFromUtc(utcValue),
    time: localTimeFromUtc(utcValue),
  };
}

/**
 * Combines a local Israel wall-clock date + time into a UTC ISO string.
 * Uses the runtime's Intl offset resolution for DST-aware conversion.
 */
export function localPartsToUtcIso(date: string, time: string): string {
  if (!date || !time) {
    throw new Error('יש להזין תאריך ושעה');
  }

  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    throw new Error('תאריך או שעה אינם תקינים');
  }

  // Probe UTC instant that corresponds to the desired Israel local wall-clock.
  const probe = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ISRAEL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const desiredLocalMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(probe);
    const part = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value ?? '0');

    const actualLocalMs = Date.UTC(
      part('year'),
      part('month') - 1,
      part('day'),
      part('hour'),
      part('minute'),
      part('second'),
    );

    const deltaMs = desiredLocalMs - actualLocalMs;
    if (Math.abs(deltaMs) < 1000) {
      return probe.toISOString();
    }

    probe.setTime(probe.getTime() + deltaMs);
  }

  return probe.toISOString();
}

/** Decimal hour-of-day (0–24) from a UTC timestamp in Israel local time. */
export function localHourFromUtc(utcValue: string | Date): number {
  const time = localTimeFromUtc(utcValue);
  const [hours, minutes] = time.split(':').map(Number);
  return hours + minutes / 60;
}

/** Start/end of a local calendar day expressed as UTC ISO bounds (Israel). */
export function localDayUtcBounds(localDateKey: string): { fromUtc: string; toUtc: string } {
  const fromUtc = localPartsToUtcIso(localDateKey, '00:00');
  const nextDay = new Date(`${localDateKey}T12:00:00`);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextKey = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
  const toUtc = localPartsToUtcIso(nextKey, '00:00');
  return { fromUtc, toUtc };
}

/** UTC range covering a local week (Sunday–Saturday, Israel). */
export function localWeekUtcBounds(anchor: Date): { fromUtc: string; toUtc: string } {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const startKey = toLocalDateKey(start);
  const endKey = toLocalDateKey(end);
  return {
    fromUtc: localPartsToUtcIso(startKey, '00:00'),
    toUtc: localPartsToUtcIso(endKey, '00:00'),
  };
}

/** UTC range covering a local calendar month (Israel). */
export function localMonthUtcBounds(anchor: Date): { fromUtc: string; toUtc: string } {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
  return {
    fromUtc: localPartsToUtcIso(toLocalDateKey(start), '00:00'),
    toUtc: localPartsToUtcIso(toLocalDateKey(end), '00:00'),
  };
}

/** UTC range covering a local calendar year (Israel). */
export function localYearUtcBounds(anchor: Date): { fromUtc: string; toUtc: string } {
  const startKey = `${anchor.getFullYear()}-01-01`;
  const endKey = `${anchor.getFullYear() + 1}-01-01`;
  return {
    fromUtc: localPartsToUtcIso(startKey, '00:00'),
    toUtc: localPartsToUtcIso(endKey, '00:00'),
  };
}

export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Human-readable duration from minutes (e.g. "2 שעות 30 דקות"). */
export function formatDurationMinutes(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return '—';
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins} דקות`;
  if (mins === 0) return `${hours} שעות`;
  return `${hours} שעות ${mins} דקות`;
}

/** Computes duration minutes between two UTC ISO timestamps. */
export function durationMinutesBetweenUtc(
  startUtc: string,
  endUtc: string,
): number | null {
  try {
    const start = parseUtcIso(startUtc);
    const end = parseUtcIso(endUtc);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return null;
    return Math.round(diffMs / 60_000);
  } catch {
    return null;
  }
}

/** Clamps a UTC interval to a local day, returning local hour bounds or null if no overlap. */
export function clampUtcIntervalToLocalDay(
  plannedStartUtc: string,
  plannedEndUtc: string,
  localDayKey: string,
): { startHour: number; endHour: number } | null {
  const dayBounds = localDayUtcBounds(localDayKey);
  const taskStart = parseUtcIso(plannedStartUtc).getTime();
  const taskEnd = parseUtcIso(plannedEndUtc).getTime();
  const dayStart = parseUtcIso(dayBounds.fromUtc).getTime();
  const dayEnd = parseUtcIso(dayBounds.toUtc).getTime();

  const overlapStart = Math.max(taskStart, dayStart);
  const overlapEnd = Math.min(taskEnd, dayEnd);
  if (overlapEnd <= overlapStart) return null;

  return {
    startHour: localHourFromUtc(new Date(overlapStart)),
    endHour: localHourFromUtc(new Date(overlapEnd)),
  };
}
