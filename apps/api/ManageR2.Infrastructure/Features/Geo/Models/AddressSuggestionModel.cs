namespace ManageR2.Infrastructure.Features.Geo.Models;

public class AddressSuggestionModel
{
	public string FormattedAddress { get; set; } = string.Empty;

	public string? City { get; set; }

	public string? Country { get; set; }

	public string? Postcode { get; set; }

	public string? PlaceId { get; set; }

	public double Latitude { get; set; }

	public double Longitude { get; set; }
}