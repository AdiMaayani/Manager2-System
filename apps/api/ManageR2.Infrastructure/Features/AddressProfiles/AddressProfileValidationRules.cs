using ManageR2.Domain.Exceptions;
using ManageR2.Domain.Features.Geo;
using ManageR2.Domain.Features.Geo.Entities;

namespace ManageR2.Infrastructure.Features.AddressProfiles;

public static class AddressProfileValidationRules
{
    public static void ValidatePersistedProfile(AddressProfile profile)
    {
        if (string.IsNullOrWhiteSpace(profile.InputAddress))
        {
            throw new UserValidationException("Input address is required.");
        }

        if (string.IsNullOrWhiteSpace(profile.ValidationStatus)
            || !AddressValidationConstants.PersistedStatuses.Contains(profile.ValidationStatus))
        {
            throw new UserValidationException("Validation status is not allowed for persistence.");
        }

        if (profile.ValidationStatus == AddressValidationConstants.Statuses.Validated)
        {
            EnsureValidatedProof(profile);
            return;
        }

        if (profile.ValidationStatus == AddressValidationConstants.Statuses.Invalid
            && string.IsNullOrWhiteSpace(profile.ValidationVerdict))
        {
            throw new UserValidationException("Invalid profiles require a validation verdict.");
        }
    }

    public static void EnsureValidatedProof(AddressProfile profile)
    {
        if (!string.Equals(profile.ValidationProvider, AddressValidationConstants.Providers.Geoapify, StringComparison.Ordinal))
        {
            throw new UserValidationException("Validated profiles must use the Geoapify provider.");
        }

        if (string.IsNullOrWhiteSpace(profile.ExternalPlaceRef))
        {
            throw new UserValidationException("Validated profiles require an external place reference.");
        }

        if (!profile.Latitude.HasValue || !profile.Longitude.HasValue)
        {
            throw new UserValidationException("Validated profiles require coordinates.");
        }

        if (!profile.ValidationScore.HasValue
            || profile.ValidationScore.Value < AddressValidationConstants.MinValidatedScore)
        {
            throw new UserValidationException("Validated profiles require a sufficient validation score.");
        }

        if (string.IsNullOrWhiteSpace(profile.FormattedAddress))
        {
            throw new UserValidationException("Validated profiles require a formatted address.");
        }

        profile.ValidationVerdict = AddressValidationConstants.Verdicts.Valid;
        profile.ValidatedAt ??= DateTime.UtcNow;
    }

    public static AddressProfile ApplyStaleIfTextChanged(AddressProfile? existing, AddressProfile incoming)
    {
        if (existing is null)
        {
            return incoming;
        }

        if (string.Equals(existing.ValidationStatus, AddressValidationConstants.Statuses.Validated, StringComparison.Ordinal)
            && !string.Equals(NormalizeText(existing.InputAddress), NormalizeText(incoming.InputAddress), StringComparison.Ordinal))
        {
            incoming.ValidationStatus = AddressValidationConstants.Statuses.Stale;
            incoming.ValidatedAt = null;
        }

        return incoming;
    }

    private static string NormalizeText(string? value) => (value ?? string.Empty).Trim();
}
