import { apiRequest } from '@api/client';
import type {
  CompanySettings,
  SmartAssignmentPolicyPreviewRequest,
  SmartAssignmentPolicyPreviewResponse,
  SmartAssignmentPolicyProfile,
  SmartAssignmentProfileKey,
  UpdateCompanySettingsRequest,
  UpdateSmartAssignmentPolicyRequest,
} from '../types';

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

export function getSmartAssignmentPoliciesAsync(): Promise<SmartAssignmentPolicyProfile[]> {
  return apiRequest<SmartAssignmentPolicyProfile[]>('/Settings/smart-assignment');
}

export function updateSmartAssignmentPolicyAsync(
  profileKey: SmartAssignmentProfileKey,
  request: UpdateSmartAssignmentPolicyRequest,
): Promise<SmartAssignmentPolicyProfile> {
  return apiRequest<SmartAssignmentPolicyProfile>(
    `/Settings/smart-assignment/${encodeURIComponent(profileKey)}`,
    {
      method: 'PUT',
      body: JSON.stringify(request),
    },
  );
}

export function resetSmartAssignmentPolicyAsync(
  profileKey: SmartAssignmentProfileKey,
): Promise<SmartAssignmentPolicyProfile> {
  return apiRequest<SmartAssignmentPolicyProfile>(
    `/Settings/smart-assignment/${encodeURIComponent(profileKey)}/reset`,
    { method: 'POST' },
  );
}

export function previewSmartAssignmentPolicyAsync(
  request: SmartAssignmentPolicyPreviewRequest,
): Promise<SmartAssignmentPolicyPreviewResponse> {
  return apiRequest<SmartAssignmentPolicyPreviewResponse>('/Settings/smart-assignment/preview', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
