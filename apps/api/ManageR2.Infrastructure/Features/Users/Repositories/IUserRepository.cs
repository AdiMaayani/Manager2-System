using ManageR2.Domain.Entities;

namespace ManageR2.Infrastructure.Repositories;

// Identity persistence contract: user rows, roles, departments, login timestamp (UserRepository + stored procedures).
public interface IUserRepository
{
    Task<IEnumerable<User>> GetUsersAsync();
    Task<User?> GetUserByIdAsync(int userId);
    Task<User?> GetUserByEmailAsync(string email);
    Task<int> CreateUserAsync(User user);
    Task<bool> UpdateUserAsync(User user);
    Task<bool> DeleteUserAsync(int userId);
    Task<List<string>> GetUserRolesAsync(int userId);
    Task<List<string>> GetUserDepartmentsAsync(int userId);
    Task UpdateLastLoginAtAsync(int userId);

    Task SetUserRolesAsync(int userId, List<string> roles);
    Task SetUserDepartmentsAsync(int userId, List<string> departments);

    // Restores a soft-deleted user in one transaction (sp_RestoreUser): reactivates the user and
    // synchronizes roles/departments to exactly the admin-selected sets (>=1 role required).
    Task<bool> RestoreUserAsync(int userId, List<string> roles, List<string> departments);

    Task<List<string>> GetAllRoleNamesAsync();
    Task<List<string>> GetAllDepartmentNamesAsync();

    // Login lockout (defense-in-depth alongside rate limiting). Implementations are best-effort:
    // if the lockout schema/procedures are not yet deployed they must not break the login flow.
    Task<DateTime?> GetLockoutEndUtcAsync(int userId);
    Task RegisterFailedLoginAsync(int userId);
    Task ClearFailedLoginAsync(int userId);
}
