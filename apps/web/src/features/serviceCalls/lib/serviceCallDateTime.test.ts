import { describe, expect, it } from 'vitest';
import {
  apiDateTimeToDateTimeLocal,
  datetimeLocalToUtcIsoOptional,
  formatServiceCallDateTimeForDisplay,
} from './serviceCallDateTime';

describe('datetimeLocalToUtcIsoOptional', () => {
  it('maps empty datetime-local input to null', () => {
    expect(datetimeLocalToUtcIsoOptional('')).toBeNull();
    expect(datetimeLocalToUtcIsoOptional('   ')).toBeNull();
  });

  it('maps Israel summer local time to the correct UTC Z timestamp', () => {
    // IDT (UTC+3): 09:30 local → 06:30 UTC
    expect(datetimeLocalToUtcIsoOptional('2026-07-19T09:30')).toBe(
      '2026-07-19T06:30:00.000Z',
    );
  });

  it('maps Israel winter local time using the correct DST offset', () => {
    // IST (UTC+2): 09:30 local → 07:30 UTC
    expect(datetimeLocalToUtcIsoOptional('2026-01-15T09:30')).toBe(
      '2026-01-15T07:30:00.000Z',
    );
  });

  it('normalizes seconds on datetime-local input before converting', () => {
    expect(datetimeLocalToUtcIsoOptional('2026-07-19T09:30:45')).toBe(
      '2026-07-19T06:30:00.000Z',
    );
  });

  it('rejects invalid input with a Hebrew validation error', () => {
    expect(() => datetimeLocalToUtcIsoOptional('not-a-date')).toThrow(
      'תאריך או שעה אינם תקינים.',
    );
    expect(() => datetimeLocalToUtcIsoOptional('2026-07-19')).toThrow(
      'תאריך או שעה אינם תקינים.',
    );
  });
});

describe('apiDateTimeToDateTimeLocal', () => {
  it('maps null/empty API values to an empty input', () => {
    expect(apiDateTimeToDateTimeLocal(null)).toBe('');
    expect(apiDateTimeToDateTimeLocal(undefined)).toBe('');
    expect(apiDateTimeToDateTimeLocal('')).toBe('');
  });

  it('maps a UTC Z API value to the correct Israel datetime-local value', () => {
    expect(apiDateTimeToDateTimeLocal('2026-07-19T06:30:00Z')).toBe(
      '2026-07-19T09:30',
    );
    expect(apiDateTimeToDateTimeLocal('2026-07-19T06:30:00.000Z')).toBe(
      '2026-07-19T09:30',
    );
  });

  it('maps an explicit-offset API value correctly', () => {
    expect(apiDateTimeToDateTimeLocal('2026-07-19T06:30:00+00:00')).toBe(
      '2026-07-19T09:30',
    );
  });

  it('keeps legacy offset-less API values unshifted', () => {
    expect(apiDateTimeToDateTimeLocal('2026-07-01T09:30:00')).toBe(
      '2026-07-01T09:30',
    );
    expect(apiDateTimeToDateTimeLocal('2026-07-01T09:30:00.000')).toBe(
      '2026-07-01T09:30',
    );
  });

  it('normalizes seconds for datetime-local display', () => {
    expect(apiDateTimeToDateTimeLocal('2026-07-19T06:30:45.123Z')).toBe(
      '2026-07-19T09:30',
    );
  });
});

describe('formatServiceCallDateTimeForDisplay', () => {
  it('displays summer UTC Z values as Israel local time (UTC+3)', () => {
    expect(formatServiceCallDateTimeForDisplay('2026-07-19T09:33:00.000Z')).toBe(
      '19.7.2026, 12:33',
    );
  });

  it('displays a July Israel cancellation UTC instant correctly', () => {
    // Cancellation at 14:13 Israel (IDT, UTC+3) → 11:13Z
    expect(formatServiceCallDateTimeForDisplay('2026-07-19T11:13:00.000Z')).toBe(
      '19.7.2026, 14:13',
    );
  });

  it('displays winter UTC values with Israel UTC+2', () => {
    // 09:33 UTC in January → 11:33 Israel (IST)
    expect(formatServiceCallDateTimeForDisplay('2026-01-15T09:33:00.000Z')).toBe(
      '15.1.2026, 11:33',
    );
  });

  it('displays a winter Israel cancellation UTC instant with UTC+2', () => {
    // Cancellation at 14:13 Israel (IST, UTC+2) → 12:13Z
    expect(formatServiceCallDateTimeForDisplay('2026-01-15T12:13:00.000Z')).toBe(
      '15.1.2026, 14:13',
    );
  });

  it('displays explicit-offset API values correctly', () => {
    expect(formatServiceCallDateTimeForDisplay('2026-07-19T09:33:00+00:00')).toBe(
      '19.7.2026, 12:33',
    );
  });

  it('keeps legacy offset-less values unshifted', () => {
    expect(formatServiceCallDateTimeForDisplay('2026-07-19T12:33:00')).toBe(
      '19.7.2026, 12:33',
    );
  });

  it('returns undefined for null and empty values', () => {
    expect(formatServiceCallDateTimeForDisplay(null)).toBeUndefined();
    expect(formatServiceCallDateTimeForDisplay(undefined)).toBeUndefined();
    expect(formatServiceCallDateTimeForDisplay('')).toBeUndefined();
    expect(formatServiceCallDateTimeForDisplay('   ')).toBeUndefined();
  });

  it('does not rely on the machine/browser local timezone', () => {
    // UTC 09:33 must become Israel 12:33 in summer. That equals formatting the
    // already-local wall-clock string — proving conversion + direct component
    // formatting, not Date/Intl with the runtime timezone.
    const fromUtc = formatServiceCallDateTimeForDisplay('2026-07-19T09:33:00.000Z');
    const fromLocalWallClock = formatServiceCallDateTimeForDisplay('2026-07-19T12:33:00');
    expect(fromUtc).toBe('19.7.2026, 12:33');
    expect(fromUtc).toBe(fromLocalWallClock);
    expect(fromUtc).not.toContain('09:33');
  });
});
