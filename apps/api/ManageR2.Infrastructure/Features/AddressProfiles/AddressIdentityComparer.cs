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

        return !string.Equals(
            NormalizeFormattedAddress(previous.FormattedAddress),
            NormalizeFormattedAddress(next.FormattedAddress),
            StringComparison.Ordinal);
    }

    public static bool HasAnyStableIdentity(AddressProfile profile)
    {
        return !string.IsNullOrWhiteSpace(profile.ExternalPlaceRef)
            || profile.Latitude.HasValue
            || !string.IsNullOrWhiteSpace(profile.FormattedAddress);
    }

    private static decimal RoundCoordinate(decimal? value)
    {
        return value.HasValue ? Math.Round(value.Value, 6) : 0m;
    }

    private static string NormalizeFormattedAddress(string? formattedAddress)
    {
        return (formattedAddress ?? string.Empty).Trim().ToLowerInvariant();
    }
}
