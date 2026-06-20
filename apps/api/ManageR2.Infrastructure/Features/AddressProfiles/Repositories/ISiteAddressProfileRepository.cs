using ManageR2.Domain.Features.Geo.Entities;

namespace ManageR2.Infrastructure.Features.AddressProfiles.Repositories;

public interface ISiteAddressProfileRepository
{
    Task<AddressProfile?> GetBySiteIdAsync(int siteId);
    Task<SiteWithAddressProfileRecord> SaveSiteWithAddressProfileAsync(SiteWithAddressProfileRecord request);
}

public class SiteWithAddressProfileRecord
{
    public int? SiteId { get; set; }
    public int CustomerId { get; set; }
    public string SiteName { get; set; } = string.Empty;
    public string? AddressLine { get; set; }
    public string? City { get; set; }
    public bool IsPrimary { get; set; }
    public string? Notes { get; set; }
    public bool HasAddressProfile { get; set; }
    public AddressProfile? Profile { get; set; }
    public SiteOperationalRecord? Site { get; set; }
}

public class SiteOperationalRecord
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
