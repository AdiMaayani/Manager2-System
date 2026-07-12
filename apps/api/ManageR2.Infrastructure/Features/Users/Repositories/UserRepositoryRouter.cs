using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.DAL.Providers;
using ManageR2.Infrastructure.Repositories;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Features.Users.Repositories;

// Dual-run router for the users/identity domain (Wave 2, high risk). See CompanySettingsRepositoryRouter
// for the pattern. Reads are shadow-compared; writes are dual-written best-effort. With default flags the
// router delegates purely to the SQL Server repository.
public sealed class UserRepositoryRouter : IUserRepository
{
    private readonly UserRepository _sqlServer;
    private readonly PostgresUserRepository _postgres;
    private readonly IProviderConnectionResolver _resolver;
    private readonly IProviderDriftRecorder _driftRecorder;
    private readonly IPayloadParityComparer _parityComparer;
    private readonly ILogger<UserRepositoryRouter> _logger;

    public UserRepositoryRouter(
        UserRepository sqlServer,
        PostgresUserRepository postgres,
        IProviderConnectionResolver resolver,
        IProviderDriftRecorder driftRecorder,
        IPayloadParityComparer parityComparer,
        ILogger<UserRepositoryRouter> logger)
    {
        _sqlServer = sqlServer;
        _postgres = postgres;
        _resolver = resolver;
        _driftRecorder = driftRecorder;
        _parityComparer = parityComparer;
        _logger = logger;
    }

    private IUserRepository Primary =>
        _resolver.Options.Primary == DatabaseProvider.Postgres ? _postgres : _sqlServer;

    public async Task<IEnumerable<User>> GetUsersAsync()
    {
        var result = await Primary.GetUsersAsync();

        if (_resolver.ShadowRead is not null)
        {
            var materialized = result as ICollection<User> ?? result.ToList();
            result = materialized;
            await ShadowCompareAsync("Users.GetUsers", materialized, () => _postgres.GetUsersAsync());
        }

        return result;
    }

    public async Task<User?> GetUserByIdAsync(int userId)
    {
        var result = await Primary.GetUserByIdAsync(userId);

        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("Users.GetUserById", result, () => _postgres.GetUserByIdAsync(userId));
        }

        return result;
    }

    public async Task<User?> GetUserByEmailAsync(string email)
    {
        var result = await Primary.GetUserByEmailAsync(email);

        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("Users.GetUserByEmail", result, () => _postgres.GetUserByEmailAsync(email));
        }

        return result;
    }

    public async Task<int> CreateUserAsync(User user)
    {
        var result = await Primary.CreateUserAsync(user);

        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Users.CreateUser", () => _postgres.CreateUserAsync(user));
        }

        return result;
    }

    public async Task<bool> UpdateUserAsync(User user)
    {
        var result = await Primary.UpdateUserAsync(user);

        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Users.UpdateUser", () => _postgres.UpdateUserAsync(user));
        }

        return result;
    }

    public async Task<bool> DeleteUserAsync(int userId)
    {
        var result = await Primary.DeleteUserAsync(userId);

        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Users.DeleteUser", () => _postgres.DeleteUserAsync(userId));
        }

        return result;
    }

    public async Task<List<string>> GetUserRolesAsync(int userId)
    {
        var result = await Primary.GetUserRolesAsync(userId);

        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("Users.GetUserRoles", result, () => _postgres.GetUserRolesAsync(userId));
        }

        return result;
    }

    public async Task<List<string>> GetUserDepartmentsAsync(int userId)
    {
        var result = await Primary.GetUserDepartmentsAsync(userId);

        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("Users.GetUserDepartments", result, () => _postgres.GetUserDepartmentsAsync(userId));
        }

        return result;
    }

    public async Task UpdateLastLoginAtAsync(int userId)
    {
        await Primary.UpdateLastLoginAtAsync(userId);

        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Users.UpdateLastLoginAt", () => _postgres.UpdateLastLoginAtAsync(userId));
        }
    }

    public async Task SetUserRolesAsync(int userId, List<string> roles)
    {
        await Primary.SetUserRolesAsync(userId, roles);

        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Users.SetUserRoles", () => _postgres.SetUserRolesAsync(userId, roles));
        }
    }

    public async Task SetUserDepartmentsAsync(int userId, List<string> departments)
    {
        await Primary.SetUserDepartmentsAsync(userId, departments);

        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Users.SetUserDepartments", () => _postgres.SetUserDepartmentsAsync(userId, departments));
        }
    }

    public async Task<bool> RestoreUserAsync(int userId, List<string> roles, List<string> departments)
    {
        var result = await Primary.RestoreUserAsync(userId, roles, departments);

        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Users.RestoreUser", () => _postgres.RestoreUserAsync(userId, roles, departments));
        }

        return result;
    }

    public async Task<List<string>> GetAllRoleNamesAsync()
    {
        var result = await Primary.GetAllRoleNamesAsync();

        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("Users.GetAllRoleNames", result, () => _postgres.GetAllRoleNamesAsync());
        }

        return result;
    }

    public async Task<List<string>> GetAllDepartmentNamesAsync()
    {
        var result = await Primary.GetAllDepartmentNamesAsync();

        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("Users.GetAllDepartmentNames", result, () => _postgres.GetAllDepartmentNamesAsync());
        }

        return result;
    }

    public async Task<DateTime?> GetLockoutEndUtcAsync(int userId)
    {
        var result = await Primary.GetLockoutEndUtcAsync(userId);

        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("Users.GetLockoutEndUtc", result, () => _postgres.GetLockoutEndUtcAsync(userId));
        }

        return result;
    }

    public async Task RegisterFailedLoginAsync(int userId)
    {
        await Primary.RegisterFailedLoginAsync(userId);

        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Users.RegisterFailedLogin", () => _postgres.RegisterFailedLoginAsync(userId));
        }
    }

    public async Task ClearFailedLoginAsync(int userId)
    {
        await Primary.ClearFailedLoginAsync(userId);

        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Users.ClearFailedLogin", () => _postgres.ClearFailedLoginAsync(userId));
        }
    }

    private async Task ShadowCompareAsync<T>(string operation, T primaryResult, Func<Task<T>> shadowRead)
    {
        try
        {
            _driftRecorder.RecordShadowCompared(operation);
            var shadowResult = await shadowRead();
            var comparison = _parityComparer.Compare(primaryResult, shadowResult);
            if (!comparison.IsMatch)
            {
                _driftRecorder.RecordDriftDetected(operation, comparison.DiffSummary ?? "unspecified");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Shadow read failed for {Operation}.", operation);
        }
    }

    private async Task DualWriteAsync(string operation, Func<Task> dualWrite)
    {
        try
        {
            _driftRecorder.RecordDualWriteAttempted(operation);
            await dualWrite();
        }
        catch (Exception ex)
        {
            _driftRecorder.RecordDualWriteFailed(operation, ex);
        }
    }
}
