using ManageR2.Domain.Features.Geo;
using ManageR2.Infrastructure.Features.Geo.Models;
using ManageR2.Infrastructure.Features.Geo.Services;
using ManageR2.Infrastructure.Models.SmartAssignment;

namespace ManageR2.Infrastructure.Services.SmartAssignment;

public sealed record SmartAssignmentResolvedOrigin(
    string OriginType,
    GeoCoordinateModel? Coordinate,
    string? FormattedAddress);

public interface ISmartAssignmentRouteOriginResolver
{
    SmartAssignmentResolvedOrigin Resolve(
        TaskRecommendationInputModel input,
        int employeeId);
}

/// <summary>
/// Resolves Smart Assignment travel exclusively from the employee's persisted home/base
/// address. Operational locations and manual overrides are deliberately ignored because
/// recommendation travel is defined as employee address to task-site address.
/// </summary>
public sealed class SmartAssignmentRouteOriginResolver : ISmartAssignmentRouteOriginResolver
{
    public SmartAssignmentResolvedOrigin Resolve(
        TaskRecommendationInputModel input,
        int employeeId)
    {
        ArgumentNullException.ThrowIfNull(input);

        var homeBase = input.EmployeeBaseAddresses
            .Where(item => item.EmployeeId == employeeId)
            .OrderByDescending(item => item.ZoneId.HasValue)
            .ThenBy(item => item.ZoneId)
            .ThenBy(item => item.FormattedAddress, StringComparer.OrdinalIgnoreCase)
            .ThenBy(item => item.Latitude)
            .ThenBy(item => item.Longitude)
            .FirstOrDefault();

        return new SmartAssignmentResolvedOrigin(
            SmartAssignmentRouteOriginTypes.HomeBase,
            homeBase is null
                ? null
                : TryCoordinate(homeBase.Latitude, homeBase.Longitude),
            GetDisplayAddress(homeBase?.FormattedAddress, homeBase?.City));
    }

    private static GeoCoordinateModel? TryCoordinate(decimal? latitude, decimal? longitude) =>
        GeoCoordinateModel.TryCreate(latitude, longitude, out var coordinate)
            ? coordinate
            : null;

    private static string? GetDisplayAddress(string? formattedAddress, string? city)
    {
        var normalizedAddress = formattedAddress?.Trim();
        if (!string.IsNullOrWhiteSpace(normalizedAddress))
        {
            return normalizedAddress;
        }

        var normalizedCity = city?.Trim();
        return string.IsNullOrWhiteSpace(normalizedCity) ? null : normalizedCity;
    }
}

public interface ISmartAssignmentRouteEnricher
{
    Task EnrichAsync(
        TaskRecommendationInputModel input,
        CancellationToken cancellationToken);
}

/// <summary>
/// Adds only missing exact-origin route estimates. Existing current Geoapify estimates
/// win; provider results remain in-memory and are converted into the model's established
/// kilometer/minute units before the pure scoring engine runs.
/// </summary>
public sealed class SmartAssignmentRouteEnricher : ISmartAssignmentRouteEnricher
{
    private readonly ISmartAssignmentRouteOriginResolver _originResolver;
    private readonly IGeoRoutingService _routingService;
    private readonly TimeProvider _timeProvider;

    public SmartAssignmentRouteEnricher(
        ISmartAssignmentRouteOriginResolver originResolver,
        IGeoRoutingService routingService,
        TimeProvider? timeProvider = null)
    {
        _originResolver = originResolver;
        _routingService = routingService;
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    public async Task EnrichAsync(
        TaskRecommendationInputModel input,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        cancellationToken.ThrowIfCancellationRequested();

        var targetSiteId = input.Task?.SiteId;
        var destination = default(GeoCoordinateModel);
        var hasDestination =
            targetSiteId is > 0 &&
            input.SiteAddress is not null &&
            input.SiteAddress.SiteId == targetSiteId &&
            GeoCoordinateModel.TryCreate(
                input.SiteAddress.Latitude,
                input.SiteAddress.Longitude,
                out destination);

        var plans = input.Employees
            .Select(employee => employee.EmployeeId)
            .Distinct()
            .OrderBy(employeeId => employeeId)
            .Select(employeeId => new CandidateRoutePlan(
                employeeId,
                _originResolver.Resolve(input, employeeId)))
            .ToList();

        foreach (var plan in plans)
        {
            input.ResolvedRouteOriginTypes[plan.EmployeeId] = plan.Origin.OriginType;
            input.ResolvedRouteOriginAddresses.Remove(plan.EmployeeId);
            if (!string.IsNullOrWhiteSpace(plan.Origin.FormattedAddress))
            {
                input.ResolvedRouteOriginAddresses[plan.EmployeeId] = plan.Origin.FormattedAddress;
            }
        }

        if (!hasDestination)
        {
            var candidateEmployeeIds = plans
                .Select(plan => plan.EmployeeId)
                .ToHashSet();
            input.RouteEstimates.RemoveAll(route =>
                candidateEmployeeIds.Contains(route.EmployeeId) &&
                (!targetSiteId.HasValue || route.TargetSiteId == targetSiteId.Value));
            return;
        }

        foreach (var plan in plans)
        {
            input.RouteEstimates.RemoveAll(route =>
                route.EmployeeId == plan.EmployeeId &&
                route.TargetSiteId == targetSiteId!.Value &&
                string.Equals(route.OriginType, plan.Origin.OriginType, StringComparison.OrdinalIgnoreCase) &&
                (!plan.Origin.Coordinate.HasValue ||
                 !string.Equals(
                     route.RoutingProvider,
                     AddressValidationConstants.Providers.Geoapify,
                     StringComparison.OrdinalIgnoreCase)));
        }

        var lookupTasks = plans.Select(plan =>
            TryCreateEstimateAsync(
                input,
                plan,
                targetSiteId!.Value,
                destination,
                cancellationToken));
        var estimates = await Task.WhenAll(lookupTasks);

        input.RouteEstimates.AddRange(estimates.OfType<RouteEstimateModel>());
    }

    private async Task<RouteEstimateModel?> TryCreateEstimateAsync(
        TaskRecommendationInputModel input,
        CandidateRoutePlan plan,
        int targetSiteId,
        GeoCoordinateModel destination,
        CancellationToken cancellationToken)
    {
        if (HasUsableExactRoute(input, plan.EmployeeId, targetSiteId, plan.Origin.OriginType) ||
            !plan.Origin.Coordinate.HasValue)
        {
            return null;
        }

        var providerRoute = await _routingService.GetDrivingRouteAsync(
            plan.Origin.Coordinate.Value,
            destination,
            cancellationToken);
        if (providerRoute is null ||
            !providerRoute.IsValid ||
            !string.Equals(
                providerRoute.Provider,
                AddressValidationConstants.Providers.Geoapify,
                StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var travelMinutes = ConvertToWholeMinutes(providerRoute.TravelTimeSeconds);
        var distanceKm = ConvertToKilometers(providerRoute.DistanceMeters);
        if (!travelMinutes.HasValue || !distanceKm.HasValue)
        {
            return null;
        }

        return new RouteEstimateModel
        {
            EmployeeId = plan.EmployeeId,
            TargetSiteId = targetSiteId,
            OriginType = plan.Origin.OriginType,
            EstimatedDistanceKm = distanceKm,
            EstimatedTravelMinutes = travelMinutes,
            RoutingProvider = providerRoute.Provider,
            CalculatedAt = _timeProvider.GetUtcNow().UtcDateTime
        };
    }

    private static bool HasUsableExactRoute(
        TaskRecommendationInputModel input,
        int employeeId,
        int targetSiteId,
        string originType) =>
        input.RouteEstimates.Any(route =>
            route.EmployeeId == employeeId &&
            route.TargetSiteId == targetSiteId &&
            string.Equals(route.OriginType, originType, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(
                route.RoutingProvider,
                AddressValidationConstants.Providers.Geoapify,
                StringComparison.OrdinalIgnoreCase) &&
            route.EstimatedTravelMinutes is >= 0);

    private static int? ConvertToWholeMinutes(double seconds)
    {
        if (!double.IsFinite(seconds) || seconds < 0d)
        {
            return null;
        }

        var minutes = Math.Ceiling(seconds / 60d);
        return minutes <= int.MaxValue ? (int)minutes : null;
    }

    private static decimal? ConvertToKilometers(double meters)
    {
        if (!double.IsFinite(meters) || meters < 0d || meters > (double)decimal.MaxValue)
        {
            return null;
        }

        return Math.Round(
            (decimal)meters / 1000m,
            2,
            MidpointRounding.AwayFromZero);
    }

    private sealed record CandidateRoutePlan(
        int EmployeeId,
        SmartAssignmentResolvedOrigin Origin);
}
