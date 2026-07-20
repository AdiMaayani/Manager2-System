import { describe, expect, it } from 'vitest';
import {
  REPORT_ID_PARAM,
  buildReportDetailPath,
  buildReportDetailSearchParams,
  parseReportIdParam,
} from './reportDeepLink';

describe('reportDeepLink', () => {
  it('builds a Reports path that targets the exact report id', () => {
    expect(buildReportDetailPath(42)).toBe('/reports?reportId=42');
  });

  it('parses valid report ids and rejects malformed values', () => {
    expect(parseReportIdParam('42')).toBe(42);
    expect(parseReportIdParam(null)).toBeNull();
    expect(parseReportIdParam('0')).toBeNull();
    expect(parseReportIdParam('01')).toBeNull();
    expect(parseReportIdParam('abc')).toBeNull();
  });

  it('sets and clears reportId while preserving unrelated search params', () => {
    const current = new URLSearchParams('status=טיוטה&search=alpha');
    const opened = buildReportDetailSearchParams(current, 7);
    expect(opened.get(REPORT_ID_PARAM)).toBe('7');
    expect(opened.get('status')).toBe('טיוטה');
    expect(opened.get('search')).toBe('alpha');

    const closed = buildReportDetailSearchParams(opened, null);
    expect(closed.get(REPORT_ID_PARAM)).toBeNull();
    expect(closed.get('status')).toBe('טיוטה');
    expect(closed.get('search')).toBe('alpha');
  });
});
