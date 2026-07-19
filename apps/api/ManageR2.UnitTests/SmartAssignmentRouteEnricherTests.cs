using ManageR2.Infrastructure.Features.Geo.Clients;
using ManageR2.Infrastructure.Features.Geo.Models;
using ManageR2.Infrastructure.Features.Geo.Services;
using ManageR2.Infrastructure.Models.SmartAssignment;
using ManageR2.Infrastructure.Services.SmartAssignment;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace ManageR2.UnitTests;

public class SmartAssignmentRouteEnricherTests
{
    private static readonly DateTime TaskStart = new(2026, 7, 21, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task EnrichAsync_UsesEmployeeHomeAddress_EvenWhenOperationalOriginsExist()
    {
        var input = CreateInput();
        input.PlannedStops.AddRange([
            Stop(TaskStart.AddHours(-3), 32.01m, 34.71m, siteId: 10),
            Stop(TaskStart.AddHours(-1), 32.02m, 34.72m, siteId: 11)
        ]);
        input.LocationEvents.Add(Location(TaskStart.AddMinutes(-10), 32.03m, 34.73m));
        input.EmployeeBaseAddresses.Add(Home(32.04m, 34.74m));
        GeoCoordinateModel? capturedOrigin = null;
        var routing = new Mock<IGeoRoutingService>();
        routing
            .Setup(item => item.GetDrivingRouteAsync(
                It.IsAny<GeoCoordinateModel>(),
                It.IsAny<GeoCoordinateModel>(),
                It.IsAny<CancellationToken>()))
            .Callback<GeoCoordinateModel, GeoCoordinateModel, CancellationToken>((origin, _, _) =>
                capturedOrigin = origin)
            .ReturnsAsync(new GeoRouteResultModel(8123d, 901d, "Geoapify"));
        var enricher = CreateEnricher(routing.Object);

        await enricher.EnrichAsync(input, CancellationToken.None);

        Assert.Equal(new GeoCoordinateModel(32.04m, 34.74m), capturedOrigin);
        Assert.Equal(
            SmartAssignmentRouteOriginTypes.HomeBase,
            input.ResolvedRouteOriginTypes[1]);
        Assert.Equal("Home", input.ResolvedRouteOriginAddresses[1]);
        var route = Assert.Single(input.RouteEstimates);
        Assert.Equal(16, route.EstimatedTravelMinutes);
        Assert.Equal(8.12m, route.EstimatedDistanceKm);
        Assert.Equal("Geoapify", route.RoutingProvider);
        Assert.Equal(new DateTime(2026, 7, 21, 9, 0, 0, DateTimeKind.Utc), route.CalculatedAt);
    }

    [Fact]
    public async Task EnrichAsync_IgnoresPlannedStopWithoutCoordinates_AndUsesHomeAddress()
    {
        var input = CreateInput();
        input.PlannedStops.AddRange([
            Stop(TaskStart.AddHours(-2), 32.01m, 34.71m, siteId: 10),
            Stop(TaskStart.AddHours(-1), null, null, siteId: 11)
        ]);
        input.LocationEvents.Add(Location(TaskStart.AddMinutes(-10), 32.03m, 34.73m));
        input.EmployeeBaseAddresses.Add(Home(32.04m, 34.74m));
        var routing = new Mock<IGeoRoutingService>();
        var enricher = CreateEnricher(routing.Object);

        await enricher.EnrichAsync(input, CancellationToken.None);

        Assert.Equal(SmartAssignmentRouteOriginTypes.HomeBase, input.ResolvedRouteOriginTypes[1]);
        Assert.Empty(input.RouteEstimates);
        routing.Verify(item => item.GetDrivingRouteAsync(
            new GeoCoordinateModel(32.04m, 34.74m),
            It.IsAny<GeoCoordinateModel>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task EnrichAsync_IgnoresManualOverride_AndUsesHomeAddress()
    {
        var input = CreateInput();
        input.Task!.HasManualOriginOverride = true;
        input.Task.ManualOriginLatitude = null;
        input.Task.ManualOriginLongitude = null;
        input.PlannedStops.Add(Stop(TaskStart.AddHours(-1), 32.02m, 34.72m, siteId: 11));
        input.LocationEvents.Add(Location(TaskStart.AddMinutes(-10), 32.03m, 34.73m));
        input.EmployeeBaseAddresses.Add(Home(32.04m, 34.74m));
        var routing = new Mock<IGeoRoutingService>();
        var enricher = CreateEnricher(routing.Object);

        await enricher.EnrichAsync(input, CancellationToken.None);

        Assert.Equal(SmartAssignmentRouteOriginTypes.HomeBase, input.ResolvedRouteOriginTypes[1]);
        Assert.Empty(input.RouteEstimates);
        routing.Verify(item => item.GetDrivingRouteAsync(
            new GeoCoordinateModel(32.04m, 34.74m),
            It.IsAny<GeoCoordinateModel>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task EnrichAsync_IgnoresLatestLocation_AndUsesHomeAddress()
    {
        var input = CreateInput();
        input.LocationEvents.AddRange([
            Location(TaskStart.AddHours(-2), 32.01m, 34.71m),
            Location(TaskStart.AddMinutes(-20), 32.03m, 34.73m)
        ]);
        input.EmployeeBaseAddresses.Add(Home(32.04m, 34.74m));
        GeoCoordinateModel? capturedOrigin = null;
        var routing = new Mock<IGeoRoutingService>();
        routing
            .Setup(item => item.GetDrivingRouteAsync(
                It.IsAny<GeoCoordinateModel>(),
                It.IsAny<GeoCoordinateModel>(),
                It.IsAny<CancellationToken>()))
            .Callback<GeoCoordinateModel, GeoCoordinateModel, CancellationToken>((origin, _, _) =>
                capturedOrigin = origin)
            .ReturnsAsync(new GeoRouteResultModel(1000d, 300d, "Geoapify"));
        var enricher = CreateEnricher(routing.Object);

        await enricher.EnrichAsync(input, CancellationToken.None);

        Assert.Equal(new GeoCoordinateModel(32.04m, 34.74m), capturedOrigin);
        Assert.Equal(
            SmartAssignmentRouteOriginTypes.HomeBase,
            input.ResolvedRouteOriginTypes[1]);
    }

    [Fact]
    public async Task EnrichAsync_IgnoresLocationWithoutCoordinates_AndUsesHomeAddress()
    {
        var input = CreateInput();
        input.LocationEvents.AddRange([
            Location(TaskStart.AddHours(-2), 32.01m, 34.71m),
            Location(TaskStart.AddMinutes(-20), null, null)
        ]);
        input.EmployeeBaseAddresses.Add(Home(32.04m, 34.74m));
        var routing = new Mock<IGeoRoutingService>();
        var enricher = CreateEnricher(routing.Object);

        await enricher.EnrichAsync(input, CancellationToken.None);

        Assert.Equal(SmartAssignmentRouteOriginTypes.HomeBase, input.ResolvedRouteOriginTypes[1]);
        Assert.Empty(input.RouteEstimates);
        routing.Verify(item => item.GetDrivingRouteAsync(
            new GeoCoordinateModel(32.04m, 34.74m),
            It.IsAny<GeoCoordinateModel>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task EnrichAsync_UsesHomeBase_WhenNoPriorOperationalOriginExists()
    {
        var input = CreateInput();
        input.EmployeeBaseAddresses.Add(Home(32.04m, 34.74m));
        GeoCoordinateModel? capturedOrigin = null;
        var routing = new Mock<IGeoRoutingService>();
        routing
            .Setup(item => item.GetDrivingRouteAsync(
                It.IsAny<GeoCoordinateModel>(),
                It.IsAny<GeoCoordinateModel>(),
                It.IsAny<CancellationToken>()))
            .Callback<GeoCoordinateModel, GeoCoordinateModel, CancellationToken>((origin, _, _) =>
                capturedOrigin = origin)
            .ReturnsAsync(new GeoRouteResultModel(1000d, 300d, "Geoapify"));
        var enricher = CreateEnricher(routing.Object);

        await enricher.EnrichAsync(input, CancellationToken.None);

        Assert.Equal(new GeoCoordinateModel(32.04m, 34.74m), capturedOrigin);
        Assert.Equal(
            SmartAssignmentRouteOriginTypes.HomeBase,
            input.ResolvedRouteOriginTypes[1]);
    }

    [Fact]
    public async Task EnrichAsync_MissingSiteAddress_DoesNotCallProviderAndRemovesCachedRoute()
    {
        var input = CreateInput();
        input.SiteAddress = null;
        input.EmployeeBaseAddresses.Add(Home(32.04m, 34.74m));
        input.RouteEstimates.Add(new RouteEstimateModel
        {
            EmployeeId = 1,
            TargetSiteId = 50,
            OriginType = SmartAssignmentRouteOriginTypes.HomeBase,
            EstimatedTravelMinutes = 12,
            EstimatedDistanceKm = 7m,
            RoutingProvider = "Geoapify"
        });
        var routing = new Mock<IGeoRoutingService>();
        var enricher = CreateEnricher(routing.Object);

        await enricher.EnrichAsync(input, CancellationToken.None);

        Assert.Empty(input.RouteEstimates);
        Assert.Equal(SmartAssignmentRouteOriginTypes.HomeBase, input.ResolvedRouteOriginTypes[1]);
        routing.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task EnrichAsync_MismatchedSiteAddress_DoesNotCallProvider()
    {
        var input = CreateInput();
        input.SiteAddress!.SiteId = 51;
        input.EmployeeBaseAddresses.Add(Home(32.04m, 34.74m));
        var routing = new Mock<IGeoRoutingService>();
        var enricher = CreateEnricher(routing.Object);

        await enricher.EnrichAsync(input, CancellationToken.None);

        Assert.Empty(input.RouteEstimates);
        routing.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task EnrichAsync_MissingEmployeeHomeCoordinates_DoesNotReuseCachedRoute()
    {
        var input = CreateInput();
        input.EmployeeBaseAddresses.Add(Home(null, null));
        input.RouteEstimates.Add(new RouteEstimateModel
        {
            EmployeeId = 1,
            TargetSiteId = 50,
            OriginType = SmartAssignmentRouteOriginTypes.HomeBase,
            EstimatedTravelMinutes = 12,
            EstimatedDistanceKm = 7m,
            RoutingProvider = "Geoapify"
        });
        var routing = new Mock<IGeoRoutingService>();
        var enricher = CreateEnricher(routing.Object);

        await enricher.EnrichAsync(input, CancellationToken.None);

        Assert.Empty(input.RouteEstimates);
        routing.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task EnrichAsync_RemovesNonGeoapifyExactRoute_WhenProviderCannotReplaceIt()
    {
        var input = CreateInput();
        input.EmployeeBaseAddresses.Add(Home(32.04m, 34.74m));
        input.RouteEstimates.Add(new RouteEstimateModel
        {
            EmployeeId = 1,
            TargetSiteId = 50,
            OriginType = SmartAssignmentRouteOriginTypes.HomeBase,
            EstimatedTravelMinutes = 5,
            EstimatedDistanceKm = 2m,
            RoutingProvider = null
        });
        var routing = new Mock<IGeoRoutingService>();
        routing
            .Setup(item => item.GetDrivingRouteAsync(
                It.IsAny<GeoCoordinateModel>(),
                It.IsAny<GeoCoordinateModel>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((GeoRouteResultModel?)null);
        var enricher = CreateEnricher(routing.Object);

        await enricher.EnrichAsync(input, CancellationToken.None);

        Assert.Empty(input.RouteEstimates);
        routing.Verify(item => item.GetDrivingRouteAsync(
            It.IsAny<GeoCoordinateModel>(),
            It.IsAny<GeoCoordinateModel>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task EnrichAsync_ReusesExistingGeoapifyExactRoute()
    {
        var input = CreateInput();
        input.EmployeeBaseAddresses.Add(Home(32.04m, 34.74m));
        input.RouteEstimates.Add(new RouteEstimateModel
        {
            EmployeeId = 1,
            TargetSiteId = 50,
            OriginType = SmartAssignmentRouteOriginTypes.HomeBase,
            EstimatedTravelMinutes = 12,
            EstimatedDistanceKm = 7m,
            RoutingProvider = "Geoapify"
        });
        var routing = new Mock<IGeoRoutingService>();
        var enricher = CreateEnricher(routing.Object);

        await enricher.EnrichAsync(input, CancellationToken.None);

        Assert.Single(input.RouteEstimates);
        routing.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task EnrichAsync_DoesNotUseGeoapifyRouteFromWrongOrigin()
    {
        var input = CreateInput();
        input.EmployeeBaseAddresses.Add(Home(32.04m, 34.74m));
        input.RouteEstimates.Add(new RouteEstimateModel
        {
            EmployeeId = 1,
            TargetSiteId = 50,
            OriginType = SmartAssignmentRouteOriginTypes.PlannedStop,
            EstimatedTravelMinutes = 3,
            EstimatedDistanceKm = 1m,
            RoutingProvider = "Geoapify"
        });
        var routing = new Mock<IGeoRoutingService>();
        routing
            .Setup(item => item.GetDrivingRouteAsync(
                It.IsAny<GeoCoordinateModel>(),
                It.IsAny<GeoCoordinateModel>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GeoRouteResultModel(6000d, 1200d, "Geoapify"));
        var enricher = CreateEnricher(routing.Object);

        await enricher.EnrichAsync(input, CancellationToken.None);

        Assert.Equal(2, input.RouteEstimates.Count);
        Assert.Contains(input.RouteEstimates, route =>
            route.OriginType == SmartAssignmentRouteOriginTypes.HomeBase &&
            route.EstimatedTravelMinutes == 20);
        routing.Verify(item => item.GetDrivingRouteAsync(
            It.IsAny<GeoCoordinateModel>(),
            It.IsAny<GeoCoordinateModel>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task EnrichAsync_DeduplicatesIdenticalCoordinatesAcrossEmployees()
    {
        var input = CreateInput();
        input.Employees.Add(new EmployeeCandidateModel
        {
            EmployeeId = 2,
            IsActive = true,
            IsAssignable = true
        });
        input.EmployeeBaseAddresses.Add(Home(32.04m, 34.74m));
        input.EmployeeBaseAddresses.Add(new EmployeeBaseAddressModel
        {
            EmployeeId = 2,
            FormattedAddress = "Same home",
            Latitude = 32.04m,
            Longitude = 34.74m
        });
        var client = new Mock<IGeoRoutingClient>();
        client
            .Setup(item => item.GetDrivingRouteAsync(
                It.IsAny<GeoCoordinateModel>(),
                It.IsAny<GeoCoordinateModel>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GeoRouteResultModel(6000d, 1200d, "Geoapify"));
        using var routing = new GeoRoutingService(
            client.Object,
            new InMemoryGeoRouteLookupCache(),
            NullLogger<GeoRoutingService>.Instance);
        var enricher = CreateEnricher(routing);

        await enricher.EnrichAsync(input, CancellationToken.None);

        Assert.Equal(2, input.RouteEstimates.Count);
        client.Verify(item => item.GetDrivingRouteAsync(
            It.IsAny<GeoCoordinateModel>(),
            It.IsAny<GeoCoordinateModel>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    private static SmartAssignmentRouteEnricher CreateEnricher(IGeoRoutingService routingService) =>
        new(
            new SmartAssignmentRouteOriginResolver(),
            routingService,
            new FixedTimeProvider(new DateTimeOffset(2026, 7, 21, 9, 0, 0, TimeSpan.Zero)));

    private static TaskRecommendationInputModel CreateInput() =>
        new()
        {
            Task = new TaskCoreDataModel
            {
                WorkItemId = 100,
                PlannedStart = TaskStart,
                PlannedEnd = TaskStart.AddHours(2),
                SiteId = 50
            },
            SiteAddress = new SiteAddressModel
            {
                SiteId = 50,
                FormattedAddress = "Task site",
                Latitude = 31.77m,
                Longitude = 35.21m
            },
            Employees =
            {
                new EmployeeCandidateModel
                {
                    EmployeeId = 1,
                    IsActive = true,
                    IsAssignable = true
                }
            }
        };

    private static EmployeePlannedStopModel Stop(
        DateTime end,
        decimal? latitude,
        decimal? longitude,
        int siteId) =>
        new()
        {
            EmployeeId = 1,
            SiteId = siteId,
            PlannedStartAt = end.AddHours(-1),
            PlannedEndAt = end,
            FormattedAddress = $"Stop {siteId}",
            Latitude = latitude,
            Longitude = longitude
        };

    private static EmployeeLocationEventModel Location(
        DateTime eventTime,
        decimal? latitude,
        decimal? longitude) =>
        new()
        {
            EmployeeId = 1,
            SiteId = 20,
            EventTime = eventTime,
            FormattedAddress = "Location",
            Latitude = latitude,
            Longitude = longitude
        };

    private static EmployeeBaseAddressModel Home(decimal? latitude, decimal? longitude) =>
        new()
        {
            EmployeeId = 1,
            FormattedAddress = "Home",
            Latitude = latitude,
            Longitude = longitude
        };

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
