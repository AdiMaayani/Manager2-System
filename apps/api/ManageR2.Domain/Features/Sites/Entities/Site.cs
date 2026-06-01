namespace ManageR2.Domain.Entities;

// Customer site/location; WorkItem.SiteId scopes operational work to a physical place under that customer.
public class Site
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