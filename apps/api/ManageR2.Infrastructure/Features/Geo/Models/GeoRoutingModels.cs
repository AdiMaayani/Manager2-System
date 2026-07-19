namespace ManageR2.Infrastructure.Features.Geo.Models;

/// <summary>
/// A validated geographic point. Geoapify query waypoints use latitude/longitude,
/// while its matrix-style payloads use longitude/latitude; keeping named fields
/// prevents accidental coordinate reversal.
/// </summary>
public readonly record struct GeoCoordinateModel(decimal Latitude, decimal Longitude)
{
    public bool IsValid =>
        Latitude is >= -90m and <= 90m &&
        Longitude is >= -180m and <= 180m;

    public static bool TryCreate(
        decimal? latitude,
        decimal? longitude,
        out GeoCoordinateModel coordinate)
    {
        coordinate = default;
        if (!latitude.HasValue || !longitude.HasValue)
        {
            return false;
        }

        var candidate = new GeoCoordinateModel(latitude.Value, longitude.Value);
        if (!candidate.IsValid)
        {
            return false;
        }

        coordinate = candidate;
        return true;
    }
}

/// <summary>
/// Raw provider units are intentionally retained at this boundary. Smart Assignment
/// converts seconds to whole travel minutes and meters to kilometers only when it
/// creates its existing RouteEstimateModel.
/// </summary>
public sealed record GeoRouteResultModel(
    double DistanceMeters,
    double TravelTimeSeconds,
    string Provider)
{
    public bool IsValid =>
        double.IsFinite(DistanceMeters) &&
        double.IsFinite(TravelTimeSeconds) &&
        DistanceMeters >= 0d &&
        TravelTimeSeconds >= 0d;
}

public readonly record struct GeoRouteCacheKey(
    GeoCoordinateModel Origin,
    GeoCoordinateModel Destination,
    string Mode);
