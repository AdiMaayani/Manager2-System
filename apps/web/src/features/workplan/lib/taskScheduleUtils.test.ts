import { describe, expect, it } from 'vitest';
import {
  buildPlannedUtcRangeFromParts,
  deriveDurationFromParts,
  hydratePlannedScheduleFromUtc,
} from './taskScheduleUtils';

describe('taskScheduleUtils', () => {
  it('accepts a valid same-day interval', () => {
    const parts = {
      startDate: '2026-06-19',
      startTime: '09:00',
      endDate: '2026-06-19',
      endTime: '11:30',
    };

    const range = buildPlannedUtcRangeFromParts(parts);
    expect(range.plannedStart.endsWith('Z')).toBe(true);
    expect(range.plannedEnd.endsWith('Z')).toBe(true);
    expect(deriveDurationFromParts(parts)).toBe(150);
  });

  it('rejects a same-day interval where end is not after start', () => {
    expect(() =>
      buildPlannedUtcRangeFromParts({
        startDate: '2026-06-19',
        startTime: '14:00',
        endDate: '2026-06-19',
        endTime: '13:00',
      }),
    ).toThrow(/אחרי/);
  });

  it('accepts an overnight interval without inferring the next day from time alone', () => {
    const parts = {
      startDate: '2026-06-19',
      startTime: '23:57',
      endDate: '2026-06-20',
      endTime: '01:57',
    };

    const range = buildPlannedUtcRangeFromParts(parts);
    expect(deriveDurationFromParts(parts)).toBe(120);
    expect(range.plannedStart).not.toBe(range.plannedEnd);
  });

  it('accepts a multi-day interval', () => {
    const parts = {
      startDate: '2026-06-19',
      startTime: '08:00',
      endDate: '2026-06-21',
      endTime: '17:00',
    };

    expect(deriveDurationFromParts(parts)).toBe(57 * 60);
  });

  it('hydrates edit fields from stored UTC values', () => {
    const parts = hydratePlannedScheduleFromUtc(
      '2026-06-19T20:57:00.000Z',
      '2026-06-19T22:57:00.000Z',
    );

    expect(parts.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parts.startTime).toMatch(/^\d{2}:\d{2}$/);
    expect(parts.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parts.endTime).toMatch(/^\d{2}:\d{2}$/);
  });
});
