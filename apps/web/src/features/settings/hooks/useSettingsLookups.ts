import { useQuery } from '@tanstack/react-query';
import {
  getSettingsDepartmentNamesAsync,
  getSettingsRoleNamesAsync,
} from '../api/settingsApiClient';

export function useSettingsLookups(isAdmin: boolean) {
  const rolesQuery = useQuery({
    queryKey: ['settings', 'roles'],
    queryFn: getSettingsRoleNamesAsync,
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
  });

  const departmentsQuery = useQuery({
    queryKey: ['settings', 'departments'],
    queryFn: getSettingsDepartmentNamesAsync,
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
  });

  return { rolesQuery, departmentsQuery };
}
