using System.Net;
using System.Text;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.Features.Geo.Clients;
using ManageR2.Infrastructure.Features.Geo.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace ManageR2.UnitTests;

public class GeoapifyClientTests
{
    [Fact]
    public async Task AutocompleteAsync_ThrowsProviderUnavailable_WhenApiKeyMissing()
    {
        var httpClient = new HttpClient { BaseAddress = new Uri("https://api.geoapify.com/") };
        var configuration = new ConfigurationBuilder().Build();
        var client = new GeoapifyClient(
            httpClient,
            configuration,
            NullLogger<GeoapifyClient>.Instance);

        var exception = await Assert.ThrowsAsync<GeoProviderUnavailableException>(() =>
            client.AutocompleteAsync("Tel Aviv", CancellationToken.None));

        Assert.Contains("not configured", exception.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("test-key", exception.Message);
    }

    [Fact]
    public async Task ValidateAddressAsync_ReturnsValidMatch_WhenProviderReturnsFeature()
    {
        const string apiKey = "secret-test-key";
        var responseJson = """
            {
              "features": [
                {
                  "properties": {
                    "formatted": "Herzl 1, Tel Aviv, Israel",
                    "city": "Tel Aviv",
                    "street": "Herzl",
                    "housenumber": "1",
                    "country": "Israel",
                    "postcode": "12345",
                    "place_id": "place-123",
                    "lat": 32.08,
                    "lon": 34.78
                  }
                }
              ]
            }
            """;

        var client = CreateClient(apiKey, _ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(responseJson, Encoding.UTF8, "application/json")
        });

        var result = await client.ValidateAddressAsync("Herzl 1 Tel Aviv", CancellationToken.None);

        Assert.True(result.IsValid);
        Assert.Equal("place-123", result.PlaceId);
        Assert.Equal(100, result.ValidationScore);
        Assert.Equal("Herzl 1, Tel Aviv, Israel", result.FormattedAddress);
    }

    [Fact]
    public async Task ValidateAddressAsync_ReturnsInvalid_WhenProviderReturnsNoFeatures()
    {
        const string apiKey = "secret-test-key";
        var client = CreateClient(apiKey, _ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{\"features\":[]}", Encoding.UTF8, "application/json")
        });

        var result = await client.ValidateAddressAsync("Unknown place", CancellationToken.None);

        Assert.False(result.IsValid);
        Assert.Equal(0, result.ValidationScore);
    }

    [Fact]
    public async Task AutocompleteAsync_ThrowsProviderUnavailable_WhenProviderReturnsServerError()
    {
        const string apiKey = "secret-test-key";
        var client = CreateClient(apiKey, _ => new HttpResponseMessage(HttpStatusCode.BadGateway));

        var exception = await Assert.ThrowsAsync<GeoProviderUnavailableException>(() =>
            client.AutocompleteAsync("Tel Aviv", CancellationToken.None));

        Assert.DoesNotContain(apiKey, exception.Message);
        Assert.DoesNotContain("secret", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AutocompleteAsync_IncludesIsraelFilterAndHebrewLanguage()
    {
        const string apiKey = "secret-test-key";
        string? capturedPath = null;

        var client = CreateClient(apiKey, request =>
        {
            capturedPath = request.RequestUri?.PathAndQuery;
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"features\":[]}", Encoding.UTF8, "application/json")
            };
        });

        await client.AutocompleteAsync("Tel Aviv", CancellationToken.None);

        Assert.NotNull(capturedPath);
        Assert.Contains("filter=countrycode:il", capturedPath);
        Assert.Contains("lang=he", capturedPath);
        Assert.Contains("apiKey=", capturedPath);
    }

    [Fact]
    public async Task GetDrivingRouteAsync_ReturnsProviderMetersAndSeconds_WithLatLonWaypoints()
    {
        const string apiKey = "secret-test-key";
        string? capturedPath = null;
        var responseJson = """
            {
              "features": [
                {
                  "properties": {
                    "distance": 8123.4,
                    "time": 901.2
                  }
                }
              ]
            }
            """;
        var client = CreateClient(apiKey, request =>
        {
            capturedPath = request.RequestUri?.PathAndQuery;
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(responseJson, Encoding.UTF8, "application/json")
            };
        });

        var result = await client.GetDrivingRouteAsync(
            new GeoCoordinateModel(32.08m, 34.78m),
            new GeoCoordinateModel(31.77m, 35.21m),
            CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(8123.4d, result.DistanceMeters);
        Assert.Equal(901.2d, result.TravelTimeSeconds);
        Assert.Equal("Geoapify", result.Provider);
        var decodedPath = Uri.UnescapeDataString(Assert.IsType<string>(capturedPath));
        Assert.Contains("waypoints=32.08,34.78|31.77,35.21", decodedPath);
        Assert.Contains("mode=drive", decodedPath);
    }

    [Fact]
    public async Task GetDrivingRouteAsync_ReturnsNull_WhenProviderHasNoRouteFeature()
    {
        var client = CreateClient("secret-test-key", _ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{\"features\":[]}", Encoding.UTF8, "application/json")
        });

        var result = await client.GetDrivingRouteAsync(
            new GeoCoordinateModel(32.08m, 34.78m),
            new GeoCoordinateModel(31.77m, 35.21m),
            CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetDrivingRouteAsync_RejectsInvalidCoordinates_WithoutHttpCall()
    {
        var calls = 0;
        var client = CreateClient("secret-test-key", _ =>
        {
            calls++;
            return new HttpResponseMessage(HttpStatusCode.OK);
        });

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() =>
            client.GetDrivingRouteAsync(
                new GeoCoordinateModel(91m, 34.78m),
                new GeoCoordinateModel(31.77m, 35.21m),
                CancellationToken.None));

        Assert.Equal(0, calls);
    }

    [Fact]
    public async Task GetDrivingRouteAsync_RejectsInvalidProviderUnits()
    {
        var client = CreateClient("secret-test-key", _ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                "{\"features\":[{\"properties\":{\"distance\":1000,\"time\":-1}}]}",
                Encoding.UTF8,
                "application/json")
        });

        await Assert.ThrowsAsync<GeoProviderUnavailableException>(() =>
            client.GetDrivingRouteAsync(
                new GeoCoordinateModel(32.08m, 34.78m),
                new GeoCoordinateModel(31.77m, 35.21m),
                CancellationToken.None));
    }

    [Fact]
    public async Task GetDrivingRouteAsync_MapsRateLimitToProviderUnavailable()
    {
        const string apiKey = "secret-test-key";
        var client = CreateClient(apiKey, _ =>
            new HttpResponseMessage(HttpStatusCode.TooManyRequests));

        var exception = await Assert.ThrowsAsync<GeoProviderUnavailableException>(() =>
            client.GetDrivingRouteAsync(
                new GeoCoordinateModel(32.08m, 34.78m),
                new GeoCoordinateModel(31.77m, 35.21m),
                CancellationToken.None));

        Assert.Contains("rate limit", exception.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(apiKey, exception.Message);
    }

    [Fact]
    public async Task GetDrivingRouteAsync_MapsTimeoutToProviderUnavailable()
    {
        var client = CreateClient("secret-test-key", new TimeoutHttpMessageHandler());

        var exception = await Assert.ThrowsAsync<GeoProviderUnavailableException>(() =>
            client.GetDrivingRouteAsync(
                new GeoCoordinateModel(32.08m, 34.78m),
                new GeoCoordinateModel(31.77m, 35.21m),
                CancellationToken.None));

        Assert.Contains("timed out", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetDrivingRouteAsync_MapsMalformedJsonToProviderUnavailable()
    {
        var client = CreateClient("secret-test-key", _ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("not-json", Encoding.UTF8, "application/json")
        });

        var exception = await Assert.ThrowsAsync<GeoProviderUnavailableException>(() =>
            client.GetDrivingRouteAsync(
                new GeoCoordinateModel(32.08m, 34.78m),
                new GeoCoordinateModel(31.77m, 35.21m),
                CancellationToken.None));

        Assert.Contains("malformed", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    private static GeoapifyClient CreateClient(string apiKey, Func<HttpRequestMessage, HttpResponseMessage> responder)
    {
        return CreateClient(apiKey, new StubHttpMessageHandler(responder));
    }

    private static GeoapifyClient CreateClient(string apiKey, HttpMessageHandler handler)
    {
        var httpClient = new HttpClient(handler) { BaseAddress = new Uri("https://api.geoapify.com/") };
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Geoapify:ApiKey"] = apiKey })
            .Build();

        return new GeoapifyClient(httpClient, configuration, NullLogger<GeoapifyClient>.Instance);
    }

    private sealed class StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> responder)
        : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(responder(request));
        }
    }

    private sealed class TimeoutHttpMessageHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken) =>
            Task.FromException<HttpResponseMessage>(new TaskCanceledException("simulated timeout"));
    }
}
