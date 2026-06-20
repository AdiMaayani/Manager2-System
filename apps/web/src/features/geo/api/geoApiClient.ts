import { apiRequest, ApiError } from '@api/client';
import type {
  AddressProfile,
  GeoAutocompleteSuggestion,
  SaveSiteWithAddressProfileRequest,
  SiteWithAddressProfileResponse,
  UpsertAddressProfileRequest,
  ValidatedAddressResponse,
} from '../types';

export function autocompleteAddressAsync(
  text: string,
  signal?: AbortSignal,
): Promise<GeoAutocompleteSuggestion[]> {
  const params = new URLSearchParams({ text });
  return apiRequest<GeoAutocompleteSuggestion[]>(`/Geo/autocomplete?${params.toString()}`, { signal });
}

export function validateAddressAsync(
  text: string,
  signal?: AbortSignal,
): Promise<ValidatedAddressResponse> {
  const params = new URLSearchParams({ text });
  return apiRequest<ValidatedAddressResponse>(`/Geo/validate?${params.toString()}`, { signal });
}

export function getEmployeeBaseAddressAsync(employeeId: number): Promise<AddressProfile> {
  return apiRequest<AddressProfile>(`/employees/${employeeId}/base-address`);
}

export async function getEmployeeBaseAddressOptionalAsync(
  employeeId: number,
): Promise<AddressProfile | null> {
  try {
    return await getEmployeeBaseAddressAsync(employeeId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export function upsertEmployeeBaseAddressAsync(
  employeeId: number,
  request: UpsertAddressProfileRequest,
): Promise<AddressProfile> {
  return apiRequest<AddressProfile>(`/employees/${employeeId}/base-address`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export function getSiteAddressProfileAsync(siteId: number): Promise<AddressProfile> {
  return apiRequest<AddressProfile>(`/sites/${siteId}/address-profile`);
}

export async function getSiteAddressProfileOptionalAsync(
  siteId: number,
): Promise<AddressProfile | null> {
  try {
    return await getSiteAddressProfileAsync(siteId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export function createSiteWithAddressProfileAsync(
  request: SaveSiteWithAddressProfileRequest,
): Promise<SiteWithAddressProfileResponse> {
  return apiRequest<SiteWithAddressProfileResponse>('/sites/with-address-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export function updateSiteWithAddressProfileAsync(
  siteId: number,
  request: SaveSiteWithAddressProfileRequest,
): Promise<SiteWithAddressProfileResponse> {
  return apiRequest<SiteWithAddressProfileResponse>(`/sites/${siteId}/with-address-profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}
