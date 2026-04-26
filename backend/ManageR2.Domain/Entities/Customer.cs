namespace ManageR2.Domain.Entities;

// CRM account root: Sites and Contacts reference CustomerId; WorkItems carry customer context for billing.
public class Customer
{
    public int CustomerId { get; set; }

    public string CustomerName { get; set; } = string.Empty;

    public string CustomerType { get; set; } = string.Empty;

    public string? PrimaryPhone { get; set; }

    public string? PrimaryEmail { get; set; }

    public string? City { get; set; }

    public string? Region { get; set; }

    public string? Address { get; set; }

    public string? Status { get; set; }

    public string? Notes { get; set; }

    public bool IsActive { get; set; }

    // Audit columns used by repositories; CustomerDto hides these from typical API responses.
    public DateTime CreatedAt { get; set; }

    public int CreatedByUserId { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public int? UpdatedByUserId { get; set; }
}
