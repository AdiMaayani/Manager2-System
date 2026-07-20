import { buildReportDetailPath } from '@shared/lib/reportDeepLink';

export interface DashboardActionRouteSource {
  actionRoute?: string | null;
  entityType?: string | null;
  entityId?: number | null;
}

function hasReportIdQuery(route: string): boolean {
  const queryIndex = route.indexOf('?');
  if (queryIndex < 0) return false;
  const params = new URLSearchParams(route.slice(queryIndex + 1));
  return params.has('reportId');
}

// Backend draft-report recommendations currently ship entityId but a generic "/reports" route.
// When entityType is WorkReport and a positive entityId is present, deep-link that exact report
// unless the server already provided a reportId-bearing route.
export function resolveDashboardActionRoute(
  item: DashboardActionRouteSource,
): string | null | undefined {
  const entityId = item.entityId;
  const isWorkReport =
    item.entityType === 'WorkReport' &&
    entityId != null &&
    Number.isInteger(entityId) &&
    entityId > 0;

  if (isWorkReport) {
    const route = item.actionRoute;
    if (
      route == null ||
      route === '' ||
      route === '/reports' ||
      (route.startsWith('/reports') && !hasReportIdQuery(route))
    ) {
      return buildReportDetailPath(entityId);
    }
  }

  return item.actionRoute;
}
