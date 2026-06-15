namespace ManageR2.Domain.Entities;

// A stored secret for a customer system. EncryptedSecretValue is only populated on the reveal read path
// and must never be serialized to clients; metadata reads leave it empty.
public class CustomerSystemSecret
{
    public int SecretId { get; set; }

    public int CustomerSystemId { get; set; }

    public string SecretType { get; set; } = string.Empty;

    public string? Username { get; set; }

    // Encrypted blob produced by ISecretProtector. Server-side only.
    public string EncryptedSecretValue { get; set; } = string.Empty;

    public string? MaskedPreview { get; set; }

    public string? Notes { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime? UpdatedAtUtc { get; set; }
}
