using ManageR2.Domain.Entities;

namespace ManageR2.Infrastructure.Interfaces;

// DI abstraction for the Customer Systems Vault. Implementation uses dbo.sp_CustomerSystems* /
// dbo.sp_CustomerSystemSecrets* stored procedures only. Secret values are passed as already-encrypted
// strings; this layer never encrypts/decrypts.
public interface ICustomerSystemRepository
{
    Task<IEnumerable<CustomerSystem>> GetSystemsAsync(int customerId, bool includeInactive);

    Task<CustomerSystem?> GetSystemByIdAsync(int customerSystemId);

    Task<int> CreateSystemAsync(CustomerSystem system);

    Task<bool> UpdateSystemAsync(CustomerSystem system);

    Task<bool> DeactivateSystemAsync(int customerSystemId);

    Task<IEnumerable<CustomerSystemSecret>> GetSecretsMetadataAsync(int customerSystemId);

    Task<int> CreateSecretAsync(CustomerSystemSecret secret);

    // When replaceSecretValue is false, the stored EncryptedSecretValue/MaskedPreview are preserved
    // (metadata-only edit) and no plaintext-derived material needs to be supplied.
    Task<bool> UpdateSecretAsync(CustomerSystemSecret secret, bool replaceSecretValue);

    Task<bool> DeactivateSecretAsync(int secretId);

    // Reveal read path only: returns the secret including its EncryptedSecretValue.
    Task<CustomerSystemSecret?> GetSecretForRevealAsync(int customerSystemId, int secretId);

    Task LogSecretAccessAsync(
        int secretId,
        int customerSystemId,
        int accessedByUserId,
        string? accessReason,
        string action,
        string? clientIp);
}
