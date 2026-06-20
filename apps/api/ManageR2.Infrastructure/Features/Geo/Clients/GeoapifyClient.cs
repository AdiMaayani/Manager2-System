using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using ManageR2.Infrastructure.Features.Geo.Models;

namespace ManageR2.Infrastructure.Features.Geo.Clients;

public class GeoapifyClient
{
	private readonly HttpClient _httpClient;
	private readonly string _apiKey;

	public GeoapifyClient(HttpClient httpClient, IConfiguration configuration)
	{
		_httpClient = httpClient;
		_apiKey = configuration["Geoapify:ApiKey"]
			?? throw new InvalidOperationException("Geoapify API key is missing.");
	}

	public async Task<List<AddressSuggestionModel>> AutocompleteAsync(string text)
	{
		if (string.IsNullOrWhiteSpace(text))
			return new List<AddressSuggestionModel>();

		var url =
			$"https://api.geoapify.com/v1/geocode/autocomplete?text={Uri.EscapeDataString(text)}&filter=countrycode:il&limit=5&apiKey={_apiKey}";

		var response = await _httpClient.GetFromJsonAsync<GeoapifyResponse>(url);

		return response?.Features?
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
			?? new List<AddressSuggestionModel>();
	}

	public async Task<ValidatedAddressModel> ValidateAddressAsync(string text)
	{
		if (string.IsNullOrWhiteSpace(text))
			return Invalid("לא הוזנה כתובת.");

		var url =
			$"https://api.geoapify.com/v1/geocode/search?text={Uri.EscapeDataString(text)}&filter=countrycode:il&limit=5&apiKey={_apiKey}";

		var response = await _httpClient.GetFromJsonAsync<GeoapifyResponse>(url);
		var features = response?.Features ?? new List<GeoapifyFeature>();

		if (features.Count == 0)
			return Invalid("לא נמצאה כתובת מתאימה.");

		var userTypedHouseNumber = ContainsDigit(text);

		var bestMatch = features
			.OrderByDescending(f => ScoreFeature(f.Properties, userTypedHouseNumber))
			.First();

		return BuildValidatedAddress(bestMatch.Properties, userTypedHouseNumber);
	}

	private static ValidatedAddressModel BuildValidatedAddress(
		GeoapifyProperties p,
		bool userTypedHouseNumber)
	{
		var score = ScoreFeature(p, userTypedHouseNumber);
		var messages = new List<string>();

		if (string.IsNullOrWhiteSpace(p.City))
			messages.Add("לא זוהתה עיר.");

		if (string.IsNullOrWhiteSpace(p.Street))
			messages.Add("לא זוהה רחוב.");

		if (userTypedHouseNumber && string.IsNullOrWhiteSpace(p.HouseNumber))
			messages.Add("הוזן מספר בית, אך Geoapify לא זיהה מספר בית תקני.");

		return new ValidatedAddressModel
		{
			IsValid = score >= 70,
			FormattedAddress = p.Formatted ?? string.Empty,
			City = p.City,
			Street = p.Street,
			HouseNumber = p.HouseNumber,
			Country = p.Country,
			Postcode = p.Postcode,
			PlaceId = p.PlaceId,
			Latitude = p.Lat,
			Longitude = p.Lon,
			ValidationScore = score,
			ValidationMessage = messages.Count == 0
				? "הכתובת אומתה בהצלחה."
				: string.Join(" ", messages)
		};
	}

	private static int ScoreFeature(GeoapifyProperties p, bool userTypedHouseNumber)
	{
		var score = 100;

		if (string.IsNullOrWhiteSpace(p.City))
			score -= 20;

		if (string.IsNullOrWhiteSpace(p.Street))
			score -= 30;

		if (userTypedHouseNumber && string.IsNullOrWhiteSpace(p.HouseNumber))
			score -= 40;

		return Math.Clamp(score, 0, 100);
	}

	private static bool ContainsDigit(string value)
	{
		return value.Any(char.IsDigit);
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