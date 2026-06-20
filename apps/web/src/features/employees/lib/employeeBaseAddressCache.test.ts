import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddressValidationStatuses } from '@features/geo/types';
import {
  employeeBaseAddressQueryKey,
  formatPartialAddressSaveErrorMessage,
  setEmployeeBaseAddressCache,
  upsertEmployeeBaseAddressWithCacheAsync,
} from './employeeBaseAddressCache';

vi.mock('@features/geo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@features/geo')>();
  return {
    ...actual,
    upsertEmployeeBaseAddressAsync: vi.fn(),
  };
});

import { upsertEmployeeBaseAddressAsync } from '@features/geo';

const savedProfile = {
  inputAddress: 'Herzl 1, Tel Aviv',
  formattedAddress: 'Herzl 1, Tel Aviv, Israel',
  validationStatus: AddressValidationStatuses.Validated,
  validationProvider: 'Geoapify',
  validationVerdict: 'Valid',
  externalPlaceRef: 'place-1',
  latitude: 32.1,
  longitude: 34.8,
  validatedAt: '2026-06-20T10:00:00Z',
};

describe('employeeBaseAddressCache', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.mocked(upsertEmployeeBaseAddressAsync).mockReset();
  });

  it('uses a stable employee base-address query key', () => {
    expect(employeeBaseAddressQueryKey(42)).toEqual(['employees', 42, 'base-address']);
  });

  it('writes the saved profile into the React Query cache after upsert', async () => {
    vi.mocked(upsertEmployeeBaseAddressAsync).mockResolvedValue(savedProfile);

    const result = await upsertEmployeeBaseAddressWithCacheAsync(queryClient, 42, {
      inputAddress: savedProfile.inputAddress,
      validationStatus: AddressValidationStatuses.Validated,
      formattedAddress: savedProfile.formattedAddress,
      validationProvider: savedProfile.validationProvider,
      validationVerdict: savedProfile.validationVerdict,
      externalPlaceRef: savedProfile.externalPlaceRef,
      latitude: savedProfile.latitude,
      longitude: savedProfile.longitude,
      validatedAt: savedProfile.validatedAt,
    });

    expect(result).toEqual(savedProfile);
    expect(queryClient.getQueryData(employeeBaseAddressQueryKey(42))).toEqual(savedProfile);
  });

  it('lets review mode read the saved address immediately from cache', () => {
    setEmployeeBaseAddressCache(queryClient, 7, savedProfile);

    expect(queryClient.getQueryData(employeeBaseAddressQueryKey(7))).toEqual(savedProfile);
  });

  it('formats partial address save errors for retry messaging', () => {
    expect(formatPartialAddressSaveErrorMessage(new Error('Geo provider unavailable'))).toBe(
      'Geo provider unavailable',
    );
    expect(formatPartialAddressSaveErrorMessage('unexpected')).toBe('שמירת כתובת הבסיס נכשלה');
  });

  it('does not mutate employee list cache when only the address profile is saved', async () => {
    queryClient.setQueryData(['employees'], [{ employeeId: 42, fullName: 'Ada' }]);
    vi.mocked(upsertEmployeeBaseAddressAsync).mockResolvedValue(savedProfile);

    await upsertEmployeeBaseAddressWithCacheAsync(queryClient, 42, {
      inputAddress: savedProfile.inputAddress,
      validationStatus: AddressValidationStatuses.Validated,
    });

    expect(queryClient.getQueryData(['employees'])).toEqual([{ employeeId: 42, fullName: 'Ada' }]);
    expect(queryClient.getQueryData(employeeBaseAddressQueryKey(42))).toEqual(savedProfile);
  });

  it('does not write cache when address upsert fails', async () => {
    queryClient.setQueryData(employeeBaseAddressQueryKey(42), null);
    vi.mocked(upsertEmployeeBaseAddressAsync).mockRejectedValue(new Error('Geo provider unavailable'));

    await expect(
      upsertEmployeeBaseAddressWithCacheAsync(queryClient, 42, {
        inputAddress: 'Herzl 1',
        validationStatus: AddressValidationStatuses.Validated,
      }),
    ).rejects.toThrow('Geo provider unavailable');

    expect(queryClient.getQueryData(employeeBaseAddressQueryKey(42))).toBeNull();
  });
});

describe('employee address save orchestration', () => {
  it('retry path updates cache without requiring another employee upsert call', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.mocked(upsertEmployeeBaseAddressAsync).mockReset();
    vi.mocked(upsertEmployeeBaseAddressAsync).mockResolvedValue(savedProfile);

    await upsertEmployeeBaseAddressWithCacheAsync(queryClient, 99, {
      inputAddress: savedProfile.inputAddress,
      validationStatus: AddressValidationStatuses.Validated,
      formattedAddress: savedProfile.formattedAddress,
      validationProvider: savedProfile.validationProvider,
      validationVerdict: savedProfile.validationVerdict,
      externalPlaceRef: savedProfile.externalPlaceRef,
      latitude: savedProfile.latitude,
      longitude: savedProfile.longitude,
      validatedAt: savedProfile.validatedAt,
    });

    expect(upsertEmployeeBaseAddressAsync).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(employeeBaseAddressQueryKey(99))).toEqual(savedProfile);
  });
});
