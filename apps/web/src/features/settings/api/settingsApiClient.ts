import { apiRequest } from '@api/client';

export function getSettingsRoleNamesAsync(): Promise<string[]> {
  return apiRequest<string[]>('/Users/roles');
}

export function getSettingsDepartmentNamesAsync(): Promise<string[]> {
  return apiRequest<string[]>('/Users/departments');
}
