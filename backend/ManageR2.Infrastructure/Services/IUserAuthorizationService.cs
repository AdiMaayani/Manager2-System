namespace ManageR2.Infrastructure.Services;

public interface IUserAuthorizationService
{
    Task<bool> CanViewUserAsync(int currentUserId, List<string> currentRoles, int targetUserId);
}