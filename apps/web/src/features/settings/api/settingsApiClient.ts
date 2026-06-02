import { apiRequest } from '@api/client';
import type { CompanySettings, UpdateCompanySettingsRequest } from '../types';

export function getCompanySettingsAsync(): Promise<CompanySettings> {
  return apiRequest<CompanySettings>('/Settings/company');
}

export function updateCompanySettingsAsync(
  request: UpdateCompanySettingsRequest,
): Promise<CompanySettings> {
  return apiRequest<CompanySettings>('/Settings/company', {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export function getSettingsRoleNamesAsync(): Promise<string[]> {
  return apiRequest<string[]>('/Users/roles');
}

export function getSettingsDepartmentNamesAsync(): Promise<string[]> {
  return apiRequest<string[]>('/Users/departments');
}
