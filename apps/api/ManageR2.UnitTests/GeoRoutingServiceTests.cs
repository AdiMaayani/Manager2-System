using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.Features.Geo.Clients;
using ManageR2.Infrastructure.Features.Geo.Models;
using ManageR2.Infrastructure.Features.Geo.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace ManageR2.UnitTests;

public class GeoRoutingServiceTests
{
    private static readonly GeoCoordinateModel Origin = new(32.08m, 34.78m);
    private static readonly GeoCoordinateModel Destination = new(31.77m, 35.21m);

    [Fact]
    public async Task GetDrivingRouteAsync_DeduplicatesConcurrentIdenticalLookups()
    {
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var providerResult = new TaskCompletionSource<GeoRouteResultModel?>(
            TaskCreationOptions.RunContinuationsAsynchronously);
        var calls = 0;
        var client = new Mock<IGeoRoutingClient>();
        client
            .Setup(item => item.GetDrivingRouteAsync(
                Origin,
                Destination,
                It.IsAny<CancellationToken>()))
            .Returns((GeoCoordinateModel _, GeoCoordinateModel _, CancellationToken token) =>
            {
                Interlocked.Increment(ref calls);
                started.TrySetResult();
                return providerResult.Task.WaitAsync(token);
            });
        using var service = CreateService(client.Object);

        var first = service.GetDrivingRouteAsync(Origin, Destination, CancellationToken.None);
        await started.Task.WaitAsync(TimeSpan.FromSeconds(2));
        var second = service.GetDrivingRouteAsync(Origin, Destination, CancellationToken.None);
        providerResult.SetResult(new GeoRouteResultModel(8000d, 900d, "Geoapify"));

        var results = await Task.WhenAll(first, second);

        Assert.Equal(1, calls);
        Assert.All(results, result => Assert.Equal(900d, result?.TravelTimeSeconds));
    }

    [Fact]
    public async Task GetDrivingRouteAsync_NegativeCachesProviderFailure()
    {
        var client = new Mock<IGeoRoutingClient>();
        client
            .Setup(item => item.GetDrivingRouteAsync(
                Origin,
                Destination,
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(new GeoProviderUnavailableException("provider unavailable"));
        using var service = CreateService(client.Object);

        var first = await service.GetDrivingRouteAsync(Origin, Destination, CancellationToken.None);
        var second = await service.GetDrivingRouteAsync(Origin, Destination, CancellationToken.None);

        Assert.Null(first);
        Assert.Null(second);
        client.Verify(item => item.GetDrivingRouteAsync(
            Origin,
            Destination,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetDrivingRouteAsync_PropagatesCallerCancellation()
    {
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var client = new Mock<IGeoRoutingClient>();
        client
            .Setup(item => item.GetDrivingRouteAsync(
                Origin,
                Destination,
                It.IsAny<CancellationToken>()))
            .Returns(async (GeoCoordinateModel _, GeoCoordinateModel _, CancellationToken token) =>
            {
                started.TrySetResult();
                await Task.Delay(Timeout.InfiniteTimeSpan, token);
                return null;
            });
        using var service = CreateService(client.Object);
        using var cancellation = new CancellationTokenSource();

        var lookup = service.GetDrivingRouteAsync(Origin, Destination, cancellation.Token);
        await started.Task.WaitAsync(TimeSpan.FromSeconds(2));
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => lookup);
    }

    [Fact]
    public async Task GetDrivingRouteAsync_SkipsProviderForInvalidCoordinate()
    {
        var client = new Mock<IGeoRoutingClient>();
        using var service = CreateService(client.Object);

        var result = await service.GetDrivingRouteAsync(
            new GeoCoordinateModel(95m, 34m),
            Destination,
            CancellationToken.None);

        Assert.Null(result);
        client.VerifyNoOtherCalls();
    }

    private static GeoRoutingService CreateService(IGeoRoutingClient client) =>
        new(
            client,
            new InMemoryGeoRouteLookupCache(),
            NullLogger<GeoRoutingService>.Instance);
}
