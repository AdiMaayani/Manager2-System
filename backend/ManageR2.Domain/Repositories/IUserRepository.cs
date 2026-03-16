using ManageR2.Domain.Entities;

namespace ManageR2.Domain.Repositories
{
    public interface IUserRepository
    {
        Task<IEnumerable<User>> GetUsersAsync();

        Task<User?> GetUserByIdAsync(int userId);

        Task<int> CreateUserAsync(User user);

        Task<bool> UpdateUserAsync(User user);

        Task<bool> DeleteUserAsync(int userId);
    }
}