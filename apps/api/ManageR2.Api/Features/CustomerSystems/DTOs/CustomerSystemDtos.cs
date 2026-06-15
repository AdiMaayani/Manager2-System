namespace ManageR2.Api.Features.CustomerSystems.DTOs;

// Non-secret system metadata returned by list/detail endpoints.
public class CustomerSystemResponseDto
{
    public int CustomerSystemId { get; set; }
    public int CustomerId { get; set; }
    public int? SiteId { get; set; }
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

public class CreateCustomerSystemRequestDto
{
    public int CustomerId { get; set; }
    public int? SiteId { get; set; }
    public string SystemType { get; set; } = string.Empty;
    public string SystemName { get; set; } = string.Empty;
    public string? Vendor { get; set; }
    public string? Model { get; set; }
    public string? Host { get; set; }
    public int? Port { get; set; }
    public string? Url { get; set; }
    public string? LocationDescription { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
}

public class UpdateCustomerSystemRequestDto
{
    public int? SiteId { get; set; }
    public string SystemType { get; set; } = string.Empty;
    public string SystemName { get; set; } = string.Empty;
    public string? Vendor { get; set; }
    public string? Model { get; set; }
    public string? Host { get; set; }
    public int? Port { get; set; }
    public string? Url { get; set; }
    public string? LocationDescription { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
}

// Secret metadata only — never includes the encrypted blob or any plaintext.
public class CustomerSystemSecretMetadataDto
{
    public int SecretId { get; set; }
    public int CustomerSystemId { get; set; }
    public string SecretType { get; set; } = string.Empty;
    public string? Username { get; set; }
    public string? MaskedPreview { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
}

// Plaintext SecretValue is accepted only over the request body (HTTPS) and is encrypted server-side
// before storage. It is never persisted or returned in plaintext outside the reveal endpoint.
public class CreateCustomerSystemSecretRequestDto
{
    public string SecretType { get; set; } = string.Empty;
    public string? Username { get; set; }
    public string SecretValue { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
}

public class UpdateCustomerSystemSecretRequestDto
{
    public string SecretType { get; set; } = string.Empty;
    public string? Username { get; set; }
    // Optional: when null/empty the existing encrypted secret is preserved (metadata-only edit).
    public string? SecretValue { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
}

public class RevealSecretRequestDto
{
    public string? AccessReason { get; set; }
}

public class RevealSecretResponseDto
{
    public int SecretId { get; set; }
    public int CustomerSystemId { get; set; }
    public string SecretType { get; set; } = string.Empty;
    public string? Username { get; set; }
    public string SecretValue { get; set; } = string.Empty;
    public DateTime RevealedAtUtc { get; set; }
}
