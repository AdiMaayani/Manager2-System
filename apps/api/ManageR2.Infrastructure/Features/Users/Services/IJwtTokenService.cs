using ManageR2.Domain.Entities;

namespace ManageR2.Infrastructure.Services;

// Token issuance contract used after successful login (JwtTokenService implementation).
public interface IJwtTokenService
{
    string GenerateToken(User user, List<string> roles);
}
