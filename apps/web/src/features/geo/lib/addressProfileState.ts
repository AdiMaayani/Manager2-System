import {
  AddressValidationStatuses,
  type UpsertAddressProfileRequest,
  type ValidatedAddressFieldState,
} from '../types';

export function normalizeAddressInput(value: string): string {
  return value.trim();
}

export function hasValidatedSelection(state: ValidatedAddressFieldState): boolean {
  return state.validationStatus === AddressValidationStatuses.Validated
    && Boolean(state.formattedAddress?.trim());
}

export function buildAddressProfilePayload(
  state: ValidatedAddressFieldState,
): UpsertAddressProfileRequest | null {
  const inputAddress = normalizeAddressInput(state.inputAddress);
  if (!inputAddress) {
    return null;
  }

  const validationStatus = state.validationStatus ?? AddressValidationStatuses.Typed;

  return {
    inputAddress,
    formattedAddress: state.formattedAddress ?? undefined,
    validationProvider: state.validationProvider ?? undefined,
    validationStatus,
    validationVerdict: state.validationVerdict ?? undefined,
    validationScore: state.validationScore ?? undefined,
    externalPlaceRef: state.externalPlaceRef ?? undefined,
    street: state.street ?? undefined,
    houseNumber: state.houseNumber ?? undefined,
    city: state.city ?? undefined,
    postcode: state.postcode ?? undefined,
    country: state.country ?? undefined,
    latitude: state.latitude ?? undefined,
    longitude: state.longitude ?? undefined,
    validatedAt: state.validatedAt ?? undefined,
  };
}

export function mapAddressProfileToFieldState(profile: {
  inputAddress: string;
  formattedAddress?: string | null;
  validationProvider?: string | null;
  validationStatus?: string | null;
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
}): ValidatedAddressFieldState {
  return {
    inputAddress: profile.inputAddress,
    formattedAddress: profile.formattedAddress,
    validationProvider: profile.validationProvider,
    validationStatus: (profile.validationStatus as ValidatedAddressFieldState['validationStatus']) ?? null,
    validationVerdict: profile.validationVerdict,
    validationScore: profile.validationScore,
    externalPlaceRef: profile.externalPlaceRef,
    street: profile.street,
    houseNumber: profile.houseNumber,
    city: profile.city,
    postcode: profile.postcode,
    country: profile.country,
    latitude: profile.latitude,
    longitude: profile.longitude,
    validatedAt: profile.validatedAt,
  };
}

export function clearValidationState(
  _state: ValidatedAddressFieldState,
  nextInput: string,
): ValidatedAddressFieldState {
  return {
    inputAddress: nextInput,
    validationStatus: null,
    formattedAddress: null,
    validationProvider: null,
    validationVerdict: null,
    validationScore: null,
    externalPlaceRef: null,
    street: null,
    houseNumber: null,
    city: null,
    postcode: null,
    country: null,
    latitude: null,
    longitude: null,
    validatedAt: null,
  };
}

export function applyValidatedResponse(
  inputAddress: string,
  response: {
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
  },
): ValidatedAddressFieldState {
  return {
    inputAddress,
    formattedAddress: response.formattedAddress,
    validationProvider: response.isValid ? 'Geoapify' : null,
    validationStatus: response.isValid
      ? AddressValidationStatuses.Validated
      : AddressValidationStatuses.Invalid,
    validationVerdict: response.isValid ? 'Valid' : 'Incomplete',
    validationScore: response.validationScore,
    externalPlaceRef: response.placeId,
    street: response.street,
    houseNumber: response.houseNumber,
    city: response.city,
    postcode: response.postcode,
    country: response.country,
    latitude: response.latitude,
    longitude: response.longitude,
    validatedAt: response.isValid ? new Date().toISOString() : null,
  };
}
