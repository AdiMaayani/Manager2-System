import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from '@api/auth';
import { getDashboardAsync, type DashboardResponse } from '../api/dashboardApiClient';

// Loads the entire command center in one request. Replaces the previous client-side fan-out across
// projects/reports/work-plans/service-calls/quotes/inventory hooks.
//
// The query key is scoped to the authenticated user id so a different user (after logout/login in the
// same browser tab) never reads the previous user's cached dashboard. The query stays disabled until a
// user is available, so the page shows its loading state instead of stale data while the user resolves.
export function useDashboard() {
  const userId = getCurrentUser()?.userId ?? null;

  return useQuery<DashboardResponse>({
    queryKey: ['dashboard', userId],
    queryFn: getDashboardAsync,
    enabled: userId != null,
  });
}
