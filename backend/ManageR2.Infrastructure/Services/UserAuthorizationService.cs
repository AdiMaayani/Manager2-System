using ManageR2.Infrastructure.Repositories;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Services;

// Fine-grained user visibility: complements role-based [Authorize] by comparing departments from IUserRepository.
public class UserAuthorizationService : IUserAuthorizationService
{
    private readonly IUserRepository _userRepository;
    private readonly ILogger<UserAuthorizationService> _logger;

    public UserAuthorizationService(IUserRepository userRepository, ILogger<UserAuthorizationService> logger)
    {
        _userRepository = userRepository;
        _logger = logger;
    }

    // Admin/self always allowed; managers/leaders require overlapping department names with the target user.
    public async Task<bool> CanViewUserAsync(int currentUserId, List<string> currentRoles, int targetUserId)
    {
        _logger.LogInformation(
            "CanViewUserAsync started for CurrentUserId={CurrentUserId}, TargetUserId={TargetUserId}.",
            currentUserId,
            targetUserId);

        if (currentRoles.Any(role => role == "Admin"))
        {
            _logger.LogInformation(
                "CanViewUserAsync allowed because CurrentUserId={CurrentUserId} is Admin.",
                currentUserId);

            return true;
        }

        if (currentUserId == targetUserId)
        {
            _logger.LogInformation(
                "CanViewUserAsync allowed because CurrentUserId={CurrentUserId} is requesting himself.",
                currentUserId);

            return true;
        }

        var isDepartmentManager = currentRoles.Any(role => role == "DepartmentManager");
        var isTeamLeader = currentRoles.Any(role => role == "TeamLeader");

        if (!isDepartmentManager && !isTeamLeader)
        {
            _logger.LogWarning(
                "CanViewUserAsync denied because CurrentUserId={CurrentUserId} has no role that allows access.",
                currentUserId);

            return false;
        }

        var currentUserDepartments = await _userRepository.GetUserDepartmentsAsync(currentUserId);
        var targetUserDepartments = await _userRepository.GetUserDepartmentsAsync(targetUserId);

        var hasSharedDepartment = currentUserDepartments
            .Intersect(targetUserDepartments, StringComparer.OrdinalIgnoreCase)
            .Any();

        if (hasSharedDepartment)
        {
            _logger.LogInformation(
                "CanViewUserAsync allowed because CurrentUserId={CurrentUserId} and TargetUserId={TargetUserId} share a department.",
                currentUserId,
                targetUserId);

            return true;
        }

        _logger.LogWarning(
            "CanViewUserAsync denied because CurrentUserId={CurrentUserId} and TargetUserId={TargetUserId} do not share a department.",
            currentUserId,
            targetUserId);

        return false;
    }
}