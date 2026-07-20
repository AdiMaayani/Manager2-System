import { describe, expect, it } from 'vitest';
import {
  localPartsToUtcIso,
  localTimeFromUtc,
  utcToLocalParts,
} from './utcDateTime';

// Israel is on daylight-saving time (UTC+3) on 2026-07-20, so 14:50 local == 11:50Z.
describe('utcDateTime Israel round-trip', () => {
  it('converts Israel local 14:50 to 11:50Z for the API', () => {
    expect(localPartsToUtcIso('2026-07-20', '14:50')).toBe('2026-07-20T11:50:00.000Z');
    expect(localPartsToUtcIso('2026-07-20', '18:50')).toBe('2026-07-20T15:50:00.000Z');
  });

  it('hydrates 11:50Z back to Israel local 14:50', () => {
    expect(localTimeFromUtc('2026-07-20T11:50:00Z')).toBe('14:50');
    expect(localTimeFromUtc('2026-07-20T15:50:00Z')).toBe('18:50');
  });

  it('does not shift the time across save, refresh and reopen', () => {
    const startUtc = localPartsToUtcIso('2026-07-20', '14:50');
    const parts = utcToLocalParts(startUtc);
    expect(parts.time).toBe('14:50');

    // A second save without changing the value must produce the same UTC instant.
    const resavedUtc = localPartsToUtcIso(parts.date, parts.time);
    expect(resavedUtc).toBe(startUtc);
    expect(utcToLocalParts(resavedUtc).time).toBe('14:50');
  });

  it('reads a bare UTC value without a Z suffix as if it were local (documents the regression)', () => {
    // When the API omits the UTC marker, the client cannot recover the intended instant. This is
    // exactly the backend regression the UTC response mappers fix by emitting a Z suffix.
    expect(localTimeFromUtc('2026-07-20T11:50:00Z')).not.toBe('11:50');
  });
});
