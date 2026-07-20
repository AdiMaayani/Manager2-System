import {
  buildEntityDrawerSearchParams,
  parseEntityIdParam,
} from '@shared/lib/urlEntityDrawer';

// Query param for opening a specific work report detail modal from a deep link.
export const REPORT_ID_PARAM = 'reportId';

// Build a Reports page deep link that opens the exact report detail modal.
export function buildReportDetailPath(reportId: number): string {
  return `/reports?${REPORT_ID_PARAM}=${reportId}`;
}

// Reuse the shared entity-id parser so report deep links reject the same malformed values.
export function parseReportIdParam(raw: string | null): number | null {
  return parseEntityIdParam(raw);
}

// Set or clear reportId while preserving unrelated Reports page query params.
export function buildReportDetailSearchParams(
  current: URLSearchParams,
  reportId: number | null,
): URLSearchParams {
  return buildEntityDrawerSearchParams(
    current,
    REPORT_ID_PARAM,
    reportId == null ? { kind: 'closed' } : { kind: 'existing', id: reportId },
  );
}
