using ManageR2.Api.Features.AddressProfiles.DTOs;
using ManageR2.Api.Features.Geo.DTOs;
using ManageR2.Domain.Features.Geo;
using ManageR2.Domain.Features.Geo.Entities;
using ManageR2.Infrastructure.Features.AddressProfiles.Repositories;
using ManageR2.Infrastructure.Features.Geo.Models;

namespace ManageR2.Api.Features.AddressProfiles;

internal static class AddressProfileMapping
{
    public static AddressProfileDto ToDto(AddressProfile profile)
    {
        return new AddressProfileDto
        {
            ProfileId = profile.ProfileId,
            InputAddress = profile.InputAddress,
            FormattedAddress = profile.FormattedAddress,
            ValidationProvider = profile.ValidationProvider,
            ValidationStatus = profile.ValidationStatus,
            ValidationVerdict = profile.ValidationVerdict,
            ValidationScore = profile.ValidationScore,
            ExternalPlaceRef = profile.ExternalPlaceRef,
            Street = profile.Street,
            HouseNumber = profile.HouseNumber,
            City = profile.City,
            Postcode = profile.Postcode,
            StateOrRegion = profile.StateOrRegion,
            Country = profile.Country,
            ZoneId = profile.ZoneId,
            Latitude = profile.Latitude,
            Longitude = profile.Longitude,
            ValidatedAt = profile.ValidatedAt,
            CreatedAt = profile.CreatedAt,
            UpdatedAt = profile.UpdatedAt
        };
    }

    public static AddressProfile ToEntity(UpsertAddressProfileRequestDto dto)
    {
        return new AddressProfile
        {
            InputAddress = dto.InputAddress.Trim(),
            FormattedAddress = dto.FormattedAddress?.Trim(),
            ValidationProvider = dto.ValidationProvider?.Trim(),
            ValidationStatus = dto.ValidationStatus.Trim(),
            ValidationVerdict = dto.ValidationVerdict?.Trim(),
            ValidationScore = dto.ValidationScore,
            ExternalPlaceRef = dto.ExternalPlaceRef?.Trim(),
            Street = dto.Street?.Trim(),
            HouseNumber = dto.HouseNumber?.Trim(),
            City = dto.City?.Trim(),
            Postcode = dto.Postcode?.Trim(),
            StateOrRegion = dto.StateOrRegion?.Trim(),
            Country = dto.Country?.Trim(),
            ZoneId = dto.ZoneId,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            ValidatedAt = dto.ValidatedAt
        };
    }

    public static AddressProfile ToEntityFromValidation(ValidatedAddressResponseDto dto, string inputAddress)
    {
        return new AddressProfile
        {
            InputAddress = inputAddress.Trim(),
            FormattedAddress = dto.FormattedAddress,
            ValidationProvider = dto.IsValid ? AddressValidationConstants.Providers.Geoapify : null,
            ValidationStatus = dto.IsValid
                ? AddressValidationConstants.Statuses.Validated
                : AddressValidationConstants.Statuses.Invalid,
            ValidationVerdict = dto.IsValid
                ? AddressValidationConstants.Verdicts.Valid
                : AddressValidationConstants.Verdicts.Incomplete,
            ValidationScore = dto.ValidationScore,
            ExternalPlaceRef = dto.PlaceId,
            Street = dto.Street,
            HouseNumber = dto.HouseNumber,
            City = dto.City,
            Postcode = dto.Postcode,
            Country = dto.Country,
            Latitude = (decimal)dto.Latitude,
            Longitude = (decimal)dto.Longitude,
            ValidatedAt = dto.IsValid ? DateTime.UtcNow : null
        };
    }

    public static GeoAutocompleteSuggestionDto ToSuggestionDto(AddressSuggestionModel model)
    {
        return new GeoAutocompleteSuggestionDto
        {
            FormattedAddress = model.FormattedAddress,
            City = model.City,
            Country = model.Country,
            Postcode = model.Postcode,
            PlaceId = model.PlaceId,
            Latitude = model.Latitude,
            Longitude = model.Longitude
        };
    }

    public static ValidatedAddressResponseDto ToValidationDto(ValidatedAddressModel model)
    {
        return new ValidatedAddressResponseDto
        {
            IsValid = model.IsValid,
            FormattedAddress = model.FormattedAddress,
            City = model.City,
            Street = model.Street,
            HouseNumber = model.HouseNumber,
            Country = model.Country,
            Postcode = model.Postcode,
            PlaceId = model.PlaceId,
            Latitude = model.Latitude,
            Longitude = model.Longitude,
            ValidationScore = model.ValidationScore,
            ValidationMessage = model.ValidationMessage
        };
    }

    public static SiteWithAddressProfileResponseDto ToSiteResponse(SiteWithAddressProfileRecord record)
    {
        return new SiteWithAddressProfileResponseDto
        {
            SiteId = record.SiteId ?? record.Site?.SiteId ?? 0,
            CustomerId = record.CustomerId,
            SiteName = record.SiteName,
            AddressLine = record.AddressLine,
            City = record.City,
            IsPrimary = record.IsPrimary,
            Notes = record.Notes,
            CreatedAt = record.Site?.CreatedAt ?? DateTime.UtcNow,
            UpdatedAt = record.Site?.UpdatedAt,
            AddressProfile = record.Profile is null ? null : ToDto(record.Profile)
        };
    }
}
