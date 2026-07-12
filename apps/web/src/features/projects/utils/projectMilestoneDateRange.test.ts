import { describe, expect, it } from 'vitest';
import { validateProjectMilestoneDateRange } from './projectMilestoneDateRange';

describe('validateProjectMilestoneDateRange', () => {
  it('allows a same-day planned range', () => {
    expect(validateProjectMilestoneDateRange('2026-07-12', '2026-07-12', true)).toBeUndefined();
  });

  it('allows a later planned end date', () => {
    expect(validateProjectMilestoneDateRange('2026-07-12', '2026-07-13', true)).toBeUndefined();
  });

  it('rejects an earlier planned end date', () => {
    expect(validateProjectMilestoneDateRange('2026-07-13', '2026-07-12', true)).toBeTruthy();
  });

  it('rejects an incomplete range before it reaches the API', () => {
    expect(validateProjectMilestoneDateRange('2026-07-12', '', true)).toBe(
      'יש להזין גם תאריך התחלה וגם תאריך סיום.',
    );
  });

  it('keeps actual milestone dates strictly increasing', () => {
    expect(validateProjectMilestoneDateRange('2026-07-12', '2026-07-12', false)).toBeTruthy();
  });
});
