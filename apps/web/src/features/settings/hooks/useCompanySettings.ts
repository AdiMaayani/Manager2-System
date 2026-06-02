import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCompanySettingsAsync,
  updateCompanySettingsAsync,
} from '../api/settingsApiClient';
import type { CompanySettings, UpdateCompanySettingsRequest } from '../types';

const COMPANY_SETTINGS_QUERY_KEY = ['settings', 'company'];

export function useCompanySettings() {
  return useQuery({
    queryKey: COMPANY_SETTINGS_QUERY_KEY,
    queryFn: getCompanySettingsAsync,
  });
}

export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: UpdateCompanySettingsRequest) =>
      updateCompanySettingsAsync(request),
    onSuccess: (companySettings: CompanySettings) => {
      queryClient.setQueryData(COMPANY_SETTINGS_QUERY_KEY, companySettings);
    },
  });
}
