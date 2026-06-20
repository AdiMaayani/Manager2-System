using System.Net;
using System.Text;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.Features.Geo.Clients;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace ManageR2.UnitTests;

public class GeoapifyClientTests
{
    [Fact]
    public void Constructor_Throws_WhenApiKeyMissing()
    {
        var httpClient = new HttpClient { BaseAddress = new Uri("https://api.geoapify.com/") };
        var configuration = new ConfigurationBuilder().Build();

        var exception = Assert.Throws<InvalidOperationException>(() =>
            new GeoapifyClient(httpClient, configuration, NullLogger<GeoapifyClient>.Instance));

        Assert.Contains("API key", exception.Message, StringComparison.OrdinalIgnoreCase);
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

    private static GeoapifyClient CreateClient(string apiKey, Func<HttpRequestMessage, HttpResponseMessage> responder)
    {
        var handler = new StubHttpMessageHandler(responder);
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
}
