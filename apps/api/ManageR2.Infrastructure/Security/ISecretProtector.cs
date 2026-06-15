namespace ManageR2.Infrastructure.Security;

// Application-layer encryption for Customer Systems Vault secrets. Implementations encrypt plaintext
// before it reaches the database and decrypt only for the explicit, audited reveal flow.
public interface ISecretProtector
{
    // Encrypts plaintext and returns an opaque, storable string (no plaintext leakage).
    string Protect(string plaintext);

    // Decrypts a value previously produced by Protect. Throws if the value was tampered with.
    string Unprotect(string protectedValue);

    // Builds a non-sensitive masked preview (e.g. dots) safe to store and display without revealing the secret.
    string CreateMaskedPreview(string plaintext);
}
