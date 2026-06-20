import { describe, expect, it } from 'vitest';
import {
  applyValidatedResponse,
  buildAddressProfilePayload,
  clearValidationState,
  hasValidatedSelection,
  mapAddressProfileToFieldState,
  normalizeAddressInput,
} from '../lib/addressProfileState';
import { AddressValidationStatuses } from '../types';

describe('addressProfileState', () => {
  it('normalizeAddressInput trims whitespace', () => {
    expect(normalizeAddressInput('  hello  ')).toBe('hello');
  });

  it('hasValidatedSelection is true only for validated status with formatted address', () => {
    expect(hasValidatedSelection({
      inputAddress: 'abc',
      validationStatus: AddressValidationStatuses.Validated,
      formattedAddress: 'Formatted',
    })).toBe(true);

    expect(hasValidatedSelection({
      inputAddress: 'abc',
      validationStatus: AddressValidationStatuses.Typed,
      formattedAddress: 'Formatted',
    })).toBe(false);
  });

  it('buildAddressProfilePayload maps validated selection', () => {
    const payload = buildAddressProfilePayload({
      inputAddress: 'Herzl 1, Tel Aviv',
      validationStatus: AddressValidationStatuses.Validated,
      formattedAddress: 'Herzl 1, Tel Aviv, Israel',
      validationProvider: 'Geoapify',
      validationVerdict: 'Valid',
      validationScore: 95,
      externalPlaceRef: 'place-1',
      street: 'Herzl',
      houseNumber: '1',
      city: 'Tel Aviv',
      latitude: 32.1,
      longitude: 34.8,
      validatedAt: '2026-06-20T10:00:00Z',
    });

    expect(payload?.validationStatus).toBe(AddressValidationStatuses.Validated);
    expect(payload?.externalPlaceRef).toBe('place-1');
    expect(payload?.latitude).toBe(32.1);
  });

  it('buildAddressProfilePayload returns null for empty input', () => {
    expect(buildAddressProfilePayload({ inputAddress: '   ', validationStatus: null })).toBeNull();
  });

  it('clearValidationState resets validation when user edits text', () => {
    const previous = {
      inputAddress: 'Validated address',
      validationStatus: AddressValidationStatuses.Validated,
      formattedAddress: 'Validated address, Israel',
      externalPlaceRef: 'place-1',
    };

    const next = clearValidationState(previous, 'Edited address');

    expect(next.inputAddress).toBe('Edited address');
    expect(next.validationStatus).toBeNull();
    expect(next.formattedAddress).toBeNull();
    expect(next.externalPlaceRef).toBeNull();
  });

  it('mapAddressProfileToFieldState hydrates persisted employee/site profile', () => {
    const state = mapAddressProfileToFieldState({
      inputAddress: 'Herzl 1',
      formattedAddress: 'Herzl 1, Tel Aviv',
      validationStatus: AddressValidationStatuses.Validated,
      validationProvider: 'Geoapify',
      externalPlaceRef: 'place-1',
      city: 'Tel Aviv',
      latitude: 32.1,
      longitude: 34.8,
    });

    expect(state.inputAddress).toBe('Herzl 1');
    expect(state.validationStatus).toBe(AddressValidationStatuses.Validated);
    expect(state.city).toBe('Tel Aviv');
  });

  it('applyValidatedResponse maps provider success to validated field state', () => {
    const state = applyValidatedResponse('Herzl 1', {
      isValid: true,
      formattedAddress: 'Herzl 1, Tel Aviv, Israel',
      placeId: 'place-1',
      latitude: 32.1,
      longitude: 34.8,
      validationScore: 95,
    });

    expect(state.validationStatus).toBe(AddressValidationStatuses.Validated);
    expect(state.externalPlaceRef).toBe('place-1');
  });
});

describe('validated address warnings', () => {
  it('treats missing validation status as unvalidated site profile', () => {
    expect(hasValidatedSelection({ inputAddress: 'Site address', validationStatus: null })).toBe(false);
  });

  it('treats stale site profile as not validated for travel warnings', () => {
    expect(hasValidatedSelection({
      inputAddress: 'Old address',
      validationStatus: AddressValidationStatuses.Stale,
      formattedAddress: 'Old address',
    })).toBe(false);
  });
});
