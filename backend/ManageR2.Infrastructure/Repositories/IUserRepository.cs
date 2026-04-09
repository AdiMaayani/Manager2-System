using ManageR2.Domain.Entities;

namespace ManageR2.Infrastructure.Repositories;

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

    Task<List<string>> GetAllRoleNamesAsync();
    Task<List<string>> GetAllDepartmentNamesAsync();
}