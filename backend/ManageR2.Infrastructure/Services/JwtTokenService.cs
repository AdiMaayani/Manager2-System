using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ManageR2.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;

namespace ManageR2.Infrastructure.Services;

public class JwtTokenService : IJwtTokenService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<JwtTokenService> _logger;

    public JwtTokenService(IConfiguration configuration, ILogger<JwtTokenService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public string GenerateToken(User user, List<string> roles)
    {
        _logger.LogInformation("GenerateToken started for UserId={UserId}.", user.UserId);

        var key = _configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT key is missing.");
        var issuer = _configuration["Jwt:Issuer"] ?? throw new InvalidOperationException("JWT issuer is missing.");
        var audience = _configuration["Jwt:Audience"] ?? throw new InvalidOperationException("JWT audience is missing.");
        var expirationMinutesValue = _configuration["Jwt:ExpirationMinutes"] ?? throw new InvalidOperationException("JWT expiration is missing.");

        if (!int.TryParse(expirationMinutesValue, out var expirationMinutes))
        {
            throw new InvalidOperationException("JWT expiration value is invalid.");
        }

        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.UserId.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(JwtRegisteredClaimNames.UniqueName, user.Username),
            new Claim("userId", user.UserId.ToString()),
            new Claim("employeeId", user.EmployeeId.ToString())
        };

        foreach (var role in roles)
        {
            if (!string.IsNullOrWhiteSpace(role))
            {
                claims.Add(new Claim(ClaimTypes.Role, role));
            }
        }

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expirationMinutes),
            signingCredentials: credentials);

        var tokenValue = new JwtSecurityTokenHandler().WriteToken(token);

        _logger.LogInformation("GenerateToken succeeded for UserId={UserId}.", user.UserId);

        return tokenValue;
    }
}