namespace ManageR2.Domain.Entities;

// A sensitive customer system record (camera/alarm/server/control system, etc.). Secret credentials are
// stored separately in CustomerSystemSecret; this entity holds only non-secret operational metadata.
public class CustomerSystem
{
    public int CustomerSystemId { get; set; }

    public int CustomerId { get; set; }

    public int? SiteId { get; set; }

    // Read-only convenience for display (resolved via LEFT JOIN in the list/detail stored procedures).
    public string? SiteName { get; set; }

    public string SystemType { get; set; } = string.Empty;

    public string SystemName { get; set; } = string.Empty;

    public string? Vendor { get; set; }

    public string? Model { get; set; }

    public string? Host { get; set; }

    public int? Port { get; set; }

    public string? Url { get; set; }

    public string? LocationDescription { get; set; }

    public string? Notes { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime? UpdatedAtUtc { get; set; }
}
