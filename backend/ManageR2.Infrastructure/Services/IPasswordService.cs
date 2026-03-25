namespace ManageR2.Infrastructure.Services;

public interface IPasswordService
{
    void CreatePasswordHash(string password, out string hashBase64, out string saltBase64);
    bool VerifyPassword(string password, string storedHashBase64, string storedSaltBase64);
}