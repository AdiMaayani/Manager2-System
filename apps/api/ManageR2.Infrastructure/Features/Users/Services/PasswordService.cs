using System.Security.Cryptography;

namespace ManageR2.Infrastructure.Services;

// PBKDF2-SHA256 password hashing used by UsersController before persistence; verification uses constant-time compare.
public class PasswordService : IPasswordService
{
    // Generates random salt + derived key for storage as base64 strings on the User entity.
    public void CreatePasswordHash(string password, out string hashBase64, out string saltBase64)
    {
        byte[] salt = RandomNumberGenerator.GetBytes(16);

        const int iterations = 100_000;
        using var pbkdf2 = new Rfc2898DeriveBytes(password, salt, iterations, HashAlgorithmName.SHA256);

        byte[] hash = pbkdf2.GetBytes(32);

        hashBase64 = Convert.ToBase64String(hash);
        saltBase64 = Convert.ToBase64String(salt);
    }

    // Re-derives hash from candidate password and compares to stored hash without early exit (timing attack mitigation).
    public bool VerifyPassword(string password, string storedHashBase64, string storedSaltBase64)
    {
        byte[] salt = Convert.FromBase64String(storedSaltBase64);
        byte[] storedHash = Convert.FromBase64String(storedHashBase64);

        const int iterations = 100_000;
        using var pbkdf2 = new Rfc2898DeriveBytes(password, salt, iterations, HashAlgorithmName.SHA256);
        byte[] computedHash = pbkdf2.GetBytes(32);

        return CryptographicOperations.FixedTimeEquals(storedHash, computedHash);
    }
}
