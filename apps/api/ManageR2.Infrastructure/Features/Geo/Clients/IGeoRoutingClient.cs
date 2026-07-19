using ManageR2.Infrastructure.Features.Geo.Models;

namespace ManageR2.Infrastructure.Features.Geo.Clients;

/// <summary>
/// Provider boundary for point-to-point routing. Tests replace this interface and
/// never contact Geoapify.
/// </summary>
public interface IGeoRoutingClient
{
    Task<GeoRouteResultModel?> GetDrivingRouteAsync(
        GeoCoordinateModel origin,
        GeoCoordinateModel destination,
        CancellationToken cancellationToken);
}
