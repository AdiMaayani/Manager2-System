using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.Features.Geo.Clients;
using ManageR2.Infrastructure.Features.Geo.Models;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Features.Geo.Services;

public interface IGeoRoutingService
{
    Task<GeoRouteResultModel?> GetDrivingRouteAsync(
        GeoCoordinateModel origin,
        GeoCoordinateModel destination,
        CancellationToken cancellationToken);
}

/// <summary>
/// Cached, bounded-concurrency and failure-tolerant routing facade. Provider failures
/// intentionally become a missing route so Smart Assignment retains its established
/// MissingRouteScore behavior.
/// </summary>
public sealed class GeoRoutingService : IGeoRoutingService, IDisposable
{
    private const string DrivingMode = "drive";
    private readonly IGeoRoutingClient _client;
    private readonly IGeoRouteLookupCache _cache;
    private readonly ILogger<GeoRoutingService> _logger;
    private readonly SemaphoreSlim _providerConcurrency = new(4, 4);

    public GeoRoutingService(
        IGeoRoutingClient client,
        IGeoRouteLookupCache cache,
        ILogger<GeoRoutingService> logger)
    {
        _client = client;
        _cache = cache;
        _logger = logger;
    }

    public Task<GeoRouteResultModel?> GetDrivingRouteAsync(
        GeoCoordinateModel origin,
        GeoCoordinateModel destination,
        CancellationToken cancellationToken)
    {
        if (!origin.IsValid || !destination.IsValid)
        {
            return Task.FromResult<GeoRouteResultModel?>(null);
        }

        var key = new GeoRouteCacheKey(origin, destination, DrivingMode);
        return _cache.GetOrCreateAsync(
            key,
            token => LookupProviderAsync(origin, destination, token),
            cancellationToken);
    }

    private async Task<GeoRouteResultModel?> LookupProviderAsync(
        GeoCoordinateModel origin,
        GeoCoordinateModel destination,
        CancellationToken cancellationToken)
    {
        await _providerConcurrency.WaitAsync(cancellationToken);
        try
        {
            var route = await _client.GetDrivingRouteAsync(origin, destination, cancellationToken);
            if (route is null)
            {
                return null;
            }

            if (!route.IsValid)
            {
                _logger.LogWarning("Geo routing provider returned invalid distance or duration values");
                return null;
            }

            return route;
        }
        catch (GeoProviderUnavailableException ex)
        {
            _logger.LogWarning(
                "Geo routing provider is unavailable ({FailureType}); recommendation will use missing-route fallback",
                ex.GetType().Name);
            return null;
        }
        finally
        {
            _providerConcurrency.Release();
        }
    }

    public void Dispose() => _providerConcurrency.Dispose();
}
