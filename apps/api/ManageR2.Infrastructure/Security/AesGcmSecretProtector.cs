using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace ManageR2.Infrastructure.Security;

// AES-256-GCM authenticated encryption for vault secrets. The 256-bit key is supplied via configuration
// (CustomerSystemsVault:EncryptionKey) as a base64 string and is never hardcoded. The stored format is
// base64(nonce[12] || tag[16] || ciphertext). GCM provides both confidentiality and tamper detection.
public sealed class AesGcmSecretProtector : ISecretProtector
{
    private const string KeyConfigurationPath = "CustomerSystemsVault:EncryptionKey";
    private const int NonceSizeBytes = 12;
    private const int TagSizeBytes = 16;
    private const int RequiredKeySizeBytes = 32; // AES-256

    private readonly byte[] _key;

    public AesGcmSecretProtector(IConfiguration configuration)
    {
        var configuredKey = configuration[KeyConfigurationPath];

        if (string.IsNullOrWhiteSpace(configuredKey) || configuredKey.StartsWith("__SET_WITH_", StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                $"Customer Systems Vault encryption key is not configured. Set '{KeyConfigurationPath}' to a " +
                "base64-encoded 32-byte (256-bit) key via user-secrets or environment variables. " +
                "Generate one with: [Convert]::ToBase64String((1..32 | % {Get-Random -Max 256}))");
        }

        byte[] keyBytes;
        try
        {
            keyBytes = Convert.FromBase64String(configuredKey);
        }
        catch (FormatException ex)
        {
            throw new InvalidOperationException(
                $"Customer Systems Vault encryption key '{KeyConfigurationPath}' is not valid base64.", ex);
        }

        if (keyBytes.Length != RequiredKeySizeBytes)
        {
            throw new InvalidOperationException(
                $"Customer Systems Vault encryption key '{KeyConfigurationPath}' must decode to exactly " +
                $"{RequiredKeySizeBytes} bytes (AES-256); got {keyBytes.Length}.");
        }

        _key = keyBytes;
    }

    public string Protect(string plaintext)
    {
        ArgumentNullException.ThrowIfNull(plaintext);

        var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
        var nonce = RandomNumberGenerator.GetBytes(NonceSizeBytes);
        var ciphertext = new byte[plaintextBytes.Length];
        var tag = new byte[TagSizeBytes];

        using (var aes = new AesGcm(_key, TagSizeBytes))
        {
            aes.Encrypt(nonce, plaintextBytes, ciphertext, tag);
        }

        var combined = new byte[NonceSizeBytes + TagSizeBytes + ciphertext.Length];
        Buffer.BlockCopy(nonce, 0, combined, 0, NonceSizeBytes);
        Buffer.BlockCopy(tag, 0, combined, NonceSizeBytes, TagSizeBytes);
        Buffer.BlockCopy(ciphertext, 0, combined, NonceSizeBytes + TagSizeBytes, ciphertext.Length);

        return Convert.ToBase64String(combined);
    }

    public string Unprotect(string protectedValue)
    {
        if (string.IsNullOrWhiteSpace(protectedValue))
        {
            throw new ArgumentException("Protected value is required.", nameof(protectedValue));
        }

        var combined = Convert.FromBase64String(protectedValue);
        if (combined.Length < NonceSizeBytes + TagSizeBytes)
        {
            throw new CryptographicException("Protected value is malformed.");
        }

        var nonce = new byte[NonceSizeBytes];
        var tag = new byte[TagSizeBytes];
        var ciphertext = new byte[combined.Length - NonceSizeBytes - TagSizeBytes];

        Buffer.BlockCopy(combined, 0, nonce, 0, NonceSizeBytes);
        Buffer.BlockCopy(combined, NonceSizeBytes, tag, 0, TagSizeBytes);
        Buffer.BlockCopy(combined, NonceSizeBytes + TagSizeBytes, ciphertext, 0, ciphertext.Length);

        var plaintextBytes = new byte[ciphertext.Length];
        using (var aes = new AesGcm(_key, TagSizeBytes))
        {
            aes.Decrypt(nonce, ciphertext, tag, plaintextBytes);
        }

        return Encoding.UTF8.GetString(plaintextBytes);
    }

    public string CreateMaskedPreview(string plaintext)
    {
        // Dots only — never reveals characters. Length is clamped so the exact secret length is not exposed.
        if (string.IsNullOrEmpty(plaintext))
        {
            return string.Empty;
        }

        var dotCount = Math.Clamp(plaintext.Length, 4, 8);
        return new string('\u2022', dotCount);
    }
}
