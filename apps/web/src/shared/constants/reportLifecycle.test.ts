import { describe, expect, it } from 'vitest';
import {
  canDeleteReport,
  REPORT_LIFECYCLE_STATUSES,
} from './reportLifecycle';

describe('canDeleteReport', () => {
  it('allows delete only for Draft lifecycle', () => {
    expect(canDeleteReport(REPORT_LIFECYCLE_STATUSES.Draft)).toBe(true);
    expect(canDeleteReport(REPORT_LIFECYCLE_STATUSES.Finalized)).toBe(false);
    expect(canDeleteReport(REPORT_LIFECYCLE_STATUSES.Reversed)).toBe(false);
    expect(canDeleteReport(null)).toBe(false);
  });
});
