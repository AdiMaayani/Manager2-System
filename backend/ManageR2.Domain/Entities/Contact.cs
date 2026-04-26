namespace ManageR2.Domain.Entities;

// External contact person (customer-facing); optional CustomerId link—different from User (internal system operators).
public class Contact
{
    public int ContactId { get; set; }

    public string FullName { get; set; } = string.Empty;

    public string? JobTitle { get; set; }

    public string ContactCategory { get; set; } = string.Empty;

    public int? CustomerId { get; set; }

    public string? CompanyName { get; set; }

    public string? Phone { get; set; }

    public string? SecondaryPhone { get; set; }

    public string? Email { get; set; }

    public string? PreferredChannel { get; set; }

    public string? City { get; set; }

    public string? Address { get; set; }

    public string? Status { get; set; }

    public string? Notes { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public int CreatedByUserId { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public int? UpdatedByUserId { get; set; }
}
