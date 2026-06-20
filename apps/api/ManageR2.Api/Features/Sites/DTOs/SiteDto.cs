namespace ManageR2.Api.DTOs;

// API contract for SitesController; mirrors Site entity without audit columns the client does not edit.
public class SiteDto
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
}
