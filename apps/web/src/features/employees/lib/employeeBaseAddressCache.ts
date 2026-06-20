import type { QueryClient } from '@tanstack/react-query';
import {
  getEmployeeBaseAddressOptionalAsync,
  upsertEmployeeBaseAddressAsync,
  type UpsertAddressProfileRequest,
} from '@features/geo';
import type { AddressProfile } from '@features/geo/types';

export function employeeBaseAddressQueryKey(employeeId: number) {
  return ['employees', employeeId, 'base-address'] as const;
}

export function setEmployeeBaseAddressCache(
  queryClient: QueryClient,
  employeeId: number,
  profile: AddressProfile,
) {
  queryClient.setQueryData(employeeBaseAddressQueryKey(employeeId), profile);
}

export async function upsertEmployeeBaseAddressWithCacheAsync(
  queryClient: QueryClient,
  employeeId: number,
  payload: UpsertAddressProfileRequest,
): Promise<AddressProfile> {
  const savedProfile = await upsertEmployeeBaseAddressAsync(employeeId, payload);
  setEmployeeBaseAddressCache(queryClient, employeeId, savedProfile);
  return savedProfile;
}

export async function refetchEmployeeBaseAddressCacheAsync(
  queryClient: QueryClient,
  employeeId: number,
): Promise<AddressProfile | null> {
  await queryClient.invalidateQueries({ queryKey: employeeBaseAddressQueryKey(employeeId) });
  return queryClient.fetchQuery({
    queryKey: employeeBaseAddressQueryKey(employeeId),
    queryFn: () => getEmployeeBaseAddressOptionalAsync(employeeId),
  });
}

export function formatPartialAddressSaveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'שמירת כתובת הבסיס נכשלה';
}
