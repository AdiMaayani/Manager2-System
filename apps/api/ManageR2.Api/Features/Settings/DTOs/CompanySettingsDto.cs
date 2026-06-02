namespace ManageR2.Api.DTOs;

// GET /Settings/company response; mirrors the persisted organization profile.
public class CompanySettingsResponseDto
{
    public string CompanyName { get; set; } = string.Empty;

    public string? LegalName { get; set; }

    public string? RegistrationNumber { get; set; }

    public string? Email { get; set; }

    public string? Phone { get; set; }

    public string? Address { get; set; }

    public string? Website { get; set; }

    public DateTime UpdatedAt { get; set; }
}

// PUT /Settings/company request; no secrets or environment configuration are accepted here.
public class UpdateCompanySettingsRequestDto
{
    public string CompanyName { get; set; } = string.Empty;

    public string? LegalName { get; set; }

    public string? RegistrationNumber { get; set; }

    public string? Email { get; set; }

    public string? Phone { get; set; }

    public string? Address { get; set; }

    public string? Website { get; set; }
}
