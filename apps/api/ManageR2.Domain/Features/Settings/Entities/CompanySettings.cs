namespace ManageR2.Domain.Entities;

// Single-row organization profile shown on the Settings page; never stores secrets or environment configuration.
public class CompanySettings
{
    public string CompanyName { get; set; } = string.Empty;

    public string? LegalName { get; set; }

    public string? RegistrationNumber { get; set; }

    public string? Email { get; set; }

    public string? Phone { get; set; }

    public string? Address { get; set; }

    public string? Website { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int? UpdatedByUserId { get; set; }
}
