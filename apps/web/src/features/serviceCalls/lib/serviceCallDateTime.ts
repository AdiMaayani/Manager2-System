import { localPartsToUtcIso, utcToLocalParts } from '@shared/utils/utcDateTime';

const INVALID_DATE_TIME_MESSAGE = 'תאריך או שעה אינם תקינים.';

/** datetime-local: YYYY-MM-DDTHH:mm, optionally with seconds/fractional seconds. */
const DATETIME_LOCAL_PATTERN =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/;

/** Trailing Z or an explicit numeric offset (±HH:MM / ±HHMM). */
const EXPLICIT_UTC_OFFSET_PATTERN = /([Zz]|[+-]\d{2}:?\d{2})$/;

export function hasExplicitUtcOffset(value: string): boolean {
  return EXPLICIT_UTC_OFFSET_PATTERN.test(value.trim());
}

/**
 * Converts a datetime-local wall-clock value (Israel) to a UTC ISO API value with Z.
 * Empty input → null. Invalid input throws a Hebrew validation error.
 */
export function datetimeLocalToUtcIsoOptional(value: string): string | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const match = DATETIME_LOCAL_PATTERN.exec(trimmedValue);
  if (!match) {
    throw new Error(INVALID_DATE_TIME_MESSAGE);
  }

  const [, datePart, timePart] = match;
  try {
    return localPartsToUtcIso(datePart, timePart);
  } catch {
    throw new Error(INVALID_DATE_TIME_MESSAGE);
  }
}

/**
 * Converts an API datetime into a datetime-local input value (YYYY-MM-DDTHH:mm).
 * - Explicit UTC (Z / offset): convert to Israel local wall-clock.
 * - Legacy offset-less: treat as already-local; do not shift.
 */
export function apiDateTimeToDateTimeLocal(value?: string | null): string {
  if (value == null) return '';
  const trimmedValue = value.trim();
  if (!trimmedValue) return '';

  if (!hasExplicitUtcOffset(trimmedValue)) {
    return normalizeLegacyDateTimeLocal(trimmedValue);
  }

  try {
    const { date, time } = utcToLocalParts(trimmedValue);
    return `${date}T${time}`;
  } catch {
    throw new Error(INVALID_DATE_TIME_MESSAGE);
  }
}

function normalizeLegacyDateTimeLocal(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(value);
  if (!match) {
    throw new Error(INVALID_DATE_TIME_MESSAGE);
  }
  return `${match[1]}T${match[2]}`;
}

/**
 * Formats an API datetime for Service Call review display (Israel wall-clock).
 * Uses apiDateTimeToDateTimeLocal so UTC/offset values convert correctly and
 * legacy offset-less values stay unshifted. Formats components directly — never
 * via Date/Intl with the runtime's implicit timezone.
 */
export function formatServiceCallDateTimeForDisplay(
  value?: string | null,
): string | undefined {
  if (value == null || !value.trim()) return undefined;

  let localValue: string;
  try {
    localValue = apiDateTimeToDateTimeLocal(value);
  } catch {
    return undefined;
  }
  if (!localValue) return undefined;

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localValue);
  if (!match) return undefined;

  const [, year, month, day, hours, minutes] = match;
  // he-IL short style: D.M.YYYY, HH:mm (no leading zeros on day/month)
  return `${Number(day)}.${Number(month)}.${year}, ${hours}:${minutes}`;
}
