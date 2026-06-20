namespace ManageR2.Api.Features.Geo.DTOs;

public class ValidatedAddressResponseDto
{
    public bool IsValid { get; set; }
    public string FormattedAddress { get; set; } = string.Empty;
    public string? City { get; set; }
    public string? Street { get; set; }
    public string? HouseNumber { get; set; }
    public string? Country { get; set; }
    public string? Postcode { get; set; }
    public string? PlaceId { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public int ValidationScore { get; set; }
    public string? ValidationMessage { get; set; }
}
