namespace ManageR2.Infrastructure.Services;

// Optional authorization rules beyond ASP.NET Core role attributes (implemented by UserAuthorizationService).
public interface IUserAuthorizationService
{
    Task<bool> CanViewUserAsync(int currentUserId, List<string> currentRoles, int targetUserId);
}