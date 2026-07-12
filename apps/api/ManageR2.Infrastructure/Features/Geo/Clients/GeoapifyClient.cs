using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using ManageR2.Domain.Exceptions;
using ManageR2.Domain.Features.Geo;
using ManageR2.Infrastructure.Features.Geo.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Features.Geo.Clients;

public class GeoapifyClient
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;
    private readonly ILogger<GeoapifyClient> _logger;

    public GeoapifyClient(HttpClient httpClient, IConfiguration configuration, ILogger<GeoapifyClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _apiKey = configuration["Geoapify:ApiKey"]?.Trim() ?? string.Empty;
    }

    public async Task<List<AddressSuggestionModel>> AutocompleteAsync(string text, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(text) || text.Trim().Length < AddressValidationConstants.MinAutocompleteLength)
        {
            return [];
        }
        EnsureConfigured();

        var encodedText = Uri.EscapeDataString(text.Trim());
        var path = $"v1/geocode/autocomplete?text={encodedText}&filter=countrycode:il&lang=he&limit=5&apiKey={_apiKey}";

        var response = await SendGeoapifyRequestAsync(path, "autocomplete", cancellationToken);
        var payload = await response.Content.ReadFromJsonAsync<GeoapifyResponse>(cancellationToken: cancellationToken);

        return payload?.Features?
            .Select(feature => new AddressSuggestionModel
            {
                FormattedAddress = feature.Properties.Formatted ?? string.Empty,
                City = feature.Properties.City,
                Country = feature.Properties.Country,
                Postcode = feature.Properties.Postcode,
                PlaceId = feature.Properties.PlaceId,
                Latitude = feature.Properties.Lat,
                Longitude = feature.Properties.Lon
            })
            .ToList()
            ?? [];
    }

    public async Task<ValidatedAddressModel> ValidateAddressAsync(string text, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return Invalid("לא הוזנה כתובת.");
        }
        EnsureConfigured();

        var encodedText = Uri.EscapeDataString(text.Trim());
        var path = $"v1/geocode/search?text={encodedText}&filter=countrycode:il&lang=he&limit=5&apiKey={_apiKey}";

        var response = await SendGeoapifyRequestAsync(path, "validate", cancellationToken);
        var payload = await response.Content.ReadFromJsonAsync<GeoapifyResponse>(cancellationToken: cancellationToken);
        var features = payload?.Features ?? [];

        if (features.Count == 0)
        {
            return Invalid("לא נמצאה כתובת מתאימה.");
        }

        var userTypedHouseNumber = ContainsDigit(text);
        var bestMatch = features
            .OrderByDescending(feature => ScoreFeature(feature.Properties, userTypedHouseNumber))
            .First();

        return BuildValidatedAddress(bestMatch.Properties, userTypedHouseNumber);
    }

    private async Task<HttpResponseMessage> SendGeoapifyRequestAsync(
        string relativePath,
        string operation,
        CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, relativePath);
            var response = await _httpClient.SendAsync(request, cancellationToken);
            stopwatch.Stop();

            _logger.LogInformation(
                "Geoapify {Operation} completed in {ElapsedMs}ms with status {StatusCode}",
                operation,
                stopwatch.ElapsedMilliseconds,
                (int)response.StatusCode);

            if (response.StatusCode == HttpStatusCode.TooManyRequests)
            {
                throw new GeoProviderUnavailableException("Geoapify rate limit reached.");
            }

            if (!response.IsSuccessStatusCode)
            {
                throw new GeoProviderUnavailableException($"Geoapify returned status {(int)response.StatusCode}.");
            }

            return response;
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            stopwatch.Stop();
            _logger.LogWarning(ex, "Geoapify {Operation} timed out after {ElapsedMs}ms", operation, stopwatch.ElapsedMilliseconds);
            throw new GeoProviderUnavailableException("Geoapify request timed out.", ex);
        }
        catch (HttpRequestException ex)
        {
            stopwatch.Stop();
            _logger.LogWarning(ex, "Geoapify {Operation} failed after {ElapsedMs}ms", operation, stopwatch.ElapsedMilliseconds);
            throw new GeoProviderUnavailableException("Geoapify is unavailable.", ex);
        }
    }

    private static ValidatedAddressModel BuildValidatedAddress(GeoapifyProperties properties, bool userTypedHouseNumber)
    {
        var score = ScoreFeature(properties, userTypedHouseNumber);
        var messages = new List<string>();

        if (string.IsNullOrWhiteSpace(properties.City))
        {
            messages.Add("לא זוהתה עיר.");
        }

        if (string.IsNullOrWhiteSpace(properties.Street))
        {
            messages.Add("לא זוהה רחוב.");
        }

        if (userTypedHouseNumber && string.IsNullOrWhiteSpace(properties.HouseNumber))
        {
            messages.Add("הוזן מספר בית, אך Geoapify לא זיהה מספר בית תקני.");
        }

        return new ValidatedAddressModel
        {
            IsValid = score >= AddressValidationConstants.MinValidatedScore,
            FormattedAddress = properties.Formatted ?? string.Empty,
            City = properties.City,
            Street = properties.Street,
            HouseNumber = properties.HouseNumber,
            Country = properties.Country,
            Postcode = properties.Postcode,
            PlaceId = properties.PlaceId,
            Latitude = properties.Lat,
            Longitude = properties.Lon,
            ValidationScore = score,
            ValidationMessage = messages.Count == 0
                ? "הכתובת אומתה בהצלחה."
                : string.Join(" ", messages)
        };
    }

    private static int ScoreFeature(GeoapifyProperties properties, bool userTypedHouseNumber)
    {
        var score = 100;

        if (string.IsNullOrWhiteSpace(properties.City))
        {
            score -= 20;
        }

        if (string.IsNullOrWhiteSpace(properties.Street))
        {
            score -= 30;
        }

        if (userTypedHouseNumber && string.IsNullOrWhiteSpace(properties.HouseNumber))
        {
            score -= 40;
        }

        return Math.Clamp(score, 0, 100);
    }

    private static bool ContainsDigit(string value) => value.Any(char.IsDigit);

    private void EnsureConfigured()
    {
        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            _logger.LogWarning("Geoapify request skipped because the provider is not configured");
            throw new GeoProviderUnavailableException("Address autocomplete is not configured.");
        }
    }

    private static ValidatedAddressModel Invalid(string message)
    {
        return new ValidatedAddressModel
        {
            IsValid = false,
            ValidationScore = 0,
            ValidationMessage = message
        };
    }

    private class GeoapifyResponse
    {
        [JsonPropertyName("features")]
        public List<GeoapifyFeature>? Features { get; set; }
    }

    private class GeoapifyFeature
    {
        [JsonPropertyName("properties")]
        public GeoapifyProperties Properties { get; set; } = new();
    }

    private class GeoapifyProperties
    {
        [JsonPropertyName("formatted")]
        public string? Formatted { get; set; }

        [JsonPropertyName("city")]
        public string? City { get; set; }

        [JsonPropertyName("street")]
        public string? Street { get; set; }

        [JsonPropertyName("housenumber")]
        public string? HouseNumber { get; set; }

        [JsonPropertyName("country")]
        public string? Country { get; set; }

        [JsonPropertyName("postcode")]
        public string? Postcode { get; set; }

        [JsonPropertyName("place_id")]
        public string? PlaceId { get; set; }

        [JsonPropertyName("lat")]
        public double Lat { get; set; }

        [JsonPropertyName("lon")]
        public double Lon { get; set; }
    }
}
