using ManageR2.Domain.Entities;

namespace ManageR2.Infrastructure.Services;

public interface IJwtTokenService
{
    string GenerateToken(User user);
}