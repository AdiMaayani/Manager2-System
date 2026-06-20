using ManageR2.Infrastructure.Features.Geo.Clients;
using ManageR2.Infrastructure.Features.Geo.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Moq.Protected;
using System.Net;

namespace ManageR2.UnitTests;

public class GeoServiceTests
{
    [Theory]
    [InlineData("")]
    [InlineData("  ")]
    [InlineData("ab")]
    public async Task AutocompleteAsync_ReturnsEmpty_WhenInputBelowMinimumLength(string text)
    {
        var handler = new Mock<HttpMessageHandler>();
        var httpClient = new HttpClient(handler.Object) { BaseAddress = new Uri("https://api.geoapify.com/") };
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Geoapify:ApiKey"] = "test-key" })
            .Build();
        var client = new GeoapifyClient(httpClient, configuration, NullLogger<GeoapifyClient>.Instance);
        var service = new GeoService(client);

        var results = await service.AutocompleteAsync(text, CancellationToken.None);

        Assert.Empty(results);
        handler.Protected().Verify(
            "SendAsync",
            Times.Never(),
            ItExpr.IsAny<HttpRequestMessage>(),
            ItExpr.IsAny<CancellationToken>());
    }

    [Theory]
    [InlineData("")]
    [InlineData("  ")]
    [InlineData("ab")]
    public async Task ValidateAddressAsync_ReturnsInvalid_WhenInputBelowMinimumLength(string text)
    {
        var handler = new Mock<HttpMessageHandler>();
        var httpClient = new HttpClient(handler.Object) { BaseAddress = new Uri("https://api.geoapify.com/") };
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Geoapify:ApiKey"] = "test-key" })
            .Build();
        var client = new GeoapifyClient(httpClient, configuration, NullLogger<GeoapifyClient>.Instance);
        var service = new GeoService(client);

        var result = await service.ValidateAddressAsync(text, CancellationToken.None);

        Assert.False(result.IsValid);
        Assert.Equal(0, result.ValidationScore);
        handler.Protected().Verify(
            "SendAsync",
            Times.Never(),
            ItExpr.IsAny<HttpRequestMessage>(),
            ItExpr.IsAny<CancellationToken>());
    }
}
