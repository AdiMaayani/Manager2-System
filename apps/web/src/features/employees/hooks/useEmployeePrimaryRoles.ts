import { useQuery } from '@tanstack/react-query';
import { getEmployeePrimaryRolesAsync } from '@features/workplan/api/workplanApiClient';

export const EMPLOYEE_PRIMARY_ROLES_QUERY_KEY = ['employees', 'primaryRoles'] as const;

export function useEmployeePrimaryRoles(enabled = true) {
  return useQuery({
    queryKey: EMPLOYEE_PRIMARY_ROLES_QUERY_KEY,
    queryFn: getEmployeePrimaryRolesAsync,
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
