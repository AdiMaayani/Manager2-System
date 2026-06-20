export const AddressValidationStatuses = {
  Typed: 'Typed',
  Validated: 'Validated',
  Invalid: 'Invalid',
  Stale: 'Stale',
} as const;

export type AddressValidationStatus =
  (typeof AddressValidationStatuses)[keyof typeof AddressValidationStatuses];

export interface GeoAutocompleteSuggestion {
  formattedAddress: string;
  city?: string | null;
  country?: string | null;
  postcode?: string | null;
  placeId?: string | null;
  latitude: number;
  longitude: number;
}

export interface ValidatedAddressResponse {
  isValid: boolean;
  formattedAddress: string;
  city?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  country?: string | null;
  postcode?: string | null;
  placeId?: string | null;
  latitude: number;
  longitude: number;
  validationScore: number;
  validationMessage?: string | null;
}

export interface AddressProfile {
  profileId?: number | null;
  inputAddress: string;
  formattedAddress?: string | null;
  validationProvider?: string | null;
  validationStatus?: AddressValidationStatus | null;
  validationVerdict?: string | null;
  validationScore?: number | null;
  externalPlaceRef?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  city?: string | null;
  postcode?: string | null;
  stateOrRegion?: string | null;
  country?: string | null;
  zoneId?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  validatedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface UpsertAddressProfileRequest {
  inputAddress: string;
  formattedAddress?: string;
  validationProvider?: string;
  validationStatus: AddressValidationStatus;
  validationVerdict?: string;
  validationScore?: number;
  externalPlaceRef?: string;
  street?: string;
  houseNumber?: string;
  city?: string;
  postcode?: string;
  stateOrRegion?: string;
  country?: string;
  zoneId?: number;
  latitude?: number;
  longitude?: number;
  validatedAt?: string;
}

export interface SiteWithAddressProfileResponse {
  siteId: number;
  customerId: number;
  siteName: string;
  addressLine?: string | null;
  city?: string | null;
  isPrimary: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  addressProfile?: AddressProfile | null;
}

export interface SaveSiteWithAddressProfileRequest {
  siteId?: number;
  customerId: number;
  siteName: string;
  isPrimary: boolean;
  notes?: string;
  addressProfile?: UpsertAddressProfileRequest;
}

export interface ValidatedAddressFieldState {
  inputAddress: string;
  validationStatus: AddressValidationStatus | null;
  formattedAddress?: string | null;
  validationProvider?: string | null;
  validationVerdict?: string | null;
  validationScore?: number | null;
  externalPlaceRef?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  city?: string | null;
  postcode?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  validatedAt?: string | null;
}

export const MIN_AUTOCOMPLETE_LENGTH = 3;
export const AUTOCOMPLETE_DEBOUNCE_MS = 300;
