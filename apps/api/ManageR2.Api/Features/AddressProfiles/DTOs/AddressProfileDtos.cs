namespace ManageR2.Api.Features.AddressProfiles.DTOs;

public class AddressProfileDto
{
    public int? ProfileId { get; set; }
    public string InputAddress { get; set; } = string.Empty;
    public string? FormattedAddress { get; set; }
    public string? ValidationProvider { get; set; }
    public string? ValidationStatus { get; set; }
    public string? ValidationVerdict { get; set; }
    public decimal? ValidationScore { get; set; }
    public string? ExternalPlaceRef { get; set; }
    public string? Street { get; set; }
    public string? HouseNumber { get; set; }
    public string? City { get; set; }
    public string? Postcode { get; set; }
    public string? StateOrRegion { get; set; }
    public string? Country { get; set; }
    public int? ZoneId { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public DateTime? ValidatedAt { get; set; }
    public DateTime? CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class UpsertAddressProfileRequestDto
{
    public string InputAddress { get; set; } = string.Empty;
    public string? FormattedAddress { get; set; }
    public string? ValidationProvider { get; set; }
    public string ValidationStatus { get; set; } = string.Empty;
    public string? ValidationVerdict { get; set; }
    public decimal? ValidationScore { get; set; }
    public string? ExternalPlaceRef { get; set; }
    public string? Street { get; set; }
    public string? HouseNumber { get; set; }
    public string? City { get; set; }
    public string? Postcode { get; set; }
    public string? StateOrRegion { get; set; }
    public string? Country { get; set; }
    public int? ZoneId { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public DateTime? ValidatedAt { get; set; }
}

public class SaveSiteWithAddressProfileRequestDto
{
    public int? SiteId { get; set; }
    public int CustomerId { get; set; }
    public string SiteName { get; set; } = string.Empty;
    public bool IsPrimary { get; set; }
    public string? Notes { get; set; }
    public UpsertAddressProfileRequestDto? AddressProfile { get; set; }
}

public class SiteWithAddressProfileResponseDto
{
    public int SiteId { get; set; }
    public int CustomerId { get; set; }
    public string SiteName { get; set; } = string.Empty;
    public string? AddressLine { get; set; }
    public string? City { get; set; }
    public bool IsPrimary { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public AddressProfileDto? AddressProfile { get; set; }
}
