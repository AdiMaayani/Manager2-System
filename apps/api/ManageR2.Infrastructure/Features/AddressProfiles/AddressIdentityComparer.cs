using ManageR2.Domain.Features.Geo.Entities;

namespace ManageR2.Infrastructure.Features.AddressProfiles;

public static class AddressIdentityComparer
{
    public static bool HasStableIdentityChanged(AddressProfile? previous, AddressProfile next)
    {
        if (previous is null)
        {
            return HasAnyStableIdentity(next);
        }

        if (!string.IsNullOrWhiteSpace(previous.ExternalPlaceRef)
            && !string.IsNullOrWhiteSpace(next.ExternalPlaceRef)
            && !string.Equals(previous.ExternalPlaceRef, next.ExternalPlaceRef, StringComparison.Ordinal))
        {
            return true;
        }

        if (previous.Latitude.HasValue && previous.Longitude.HasValue
            && next.Latitude.HasValue && next.Longitude.HasValue)
        {
            return RoundCoordinate(previous.Latitude) != RoundCoordinate(next.Latitude)
                || RoundCoordinate(previous.Longitude) != RoundCoordinate(next.Longitude);
        }

        var previousNormalized = BuildNormalizedKey(previous.FormattedAddress, previous.City, previous.Postcode);
        var nextNormalized = BuildNormalizedKey(next.FormattedAddress, next.City, next.Postcode);
        return !string.Equals(previousNormalized, nextNormalized, StringComparison.Ordinal);
    }

    private static bool HasAnyStableIdentity(AddressProfile profile)
    {
        return !string.IsNullOrWhiteSpace(profile.ExternalPlaceRef)
            || profile.Latitude.HasValue
            || !string.IsNullOrWhiteSpace(profile.FormattedAddress);
    }

    private static decimal RoundCoordinate(decimal? value)
    {
        return value.HasValue ? Math.Round(value.Value, 6) : 0m;
    }

    private static string BuildNormalizedKey(string? formattedAddress, string? city, string? postcode)
    {
        return string.Join("|",
            (formattedAddress ?? string.Empty).Trim().ToLowerInvariant(),
            (city ?? string.Empty).Trim().ToLowerInvariant(),
            (postcode ?? string.Empty).Trim().ToLowerInvariant());
    }
}
