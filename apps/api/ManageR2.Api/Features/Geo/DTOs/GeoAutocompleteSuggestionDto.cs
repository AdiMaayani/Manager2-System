namespace ManageR2.Api.Features.Geo.DTOs;

public class GeoAutocompleteSuggestionDto
{
    public string FormattedAddress { get; set; } = string.Empty;
    public string? City { get; set; }
    public string? Country { get; set; }
    public string? Postcode { get; set; }
    public string? PlaceId { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
}
