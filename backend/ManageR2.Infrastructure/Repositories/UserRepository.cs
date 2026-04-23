using System.Data;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.DAL;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Repositories;

public class UserRepository : IUserRepository
{
    private readonly DBServices _dbServices;
    private readonly ILogger<UserRepository> _logger;

    public UserRepository(DBServices dbServices, ILogger<UserRepository> logger)
    {
        _dbServices = dbServices;
        _logger = logger;
    }

    public async Task<IEnumerable<User>> GetUsersAsync()
    {
        _logger.LogInformation("GetUsersAsync started.");

        var users = new List<User>();

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_GetUsers", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                users.Add(MapUser(reader));
            }

            _logger.LogInformation("GetUsersAsync succeeded. Returned {UsersCount} users.", users.Count);

            return users;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "GetUsersAsync failed with SQL error.");

            throw new UserValidationException("Failed to retrieve users from the database.", ex);
        }
    }

    public async Task<User?> GetUserByIdAsync(int userId)
    {
        _logger.LogInformation("GetUserByIdAsync started for UserId={UserId}.", userId);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_GetUserById", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@UserId", userId);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                var user = MapUser(reader);

                _logger.LogInformation("GetUserByIdAsync succeeded for UserId={UserId}.", userId);

                return user;
            }

            _logger.LogWarning("GetUserByIdAsync returned no user for UserId={UserId}.", userId);

            return null;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "GetUserByIdAsync failed with SQL error for UserId={UserId}.", userId);

            throw new UserValidationException("Failed to retrieve the requested user from the database.", ex);
        }
    }

    public async Task<User?> GetUserByEmailAsync(string email)
    {
        _logger.LogInformation("GetUserByEmailAsync started for Email={Email}.", email);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_GetUserByEmail", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@Email", email);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                var user = MapUser(reader);

                _logger.LogInformation("GetUserByEmailAsync succeeded for Email={Email}.", email);

                return user;
            }

            _logger.LogWarning("GetUserByEmailAsync returned no user for Email={Email}.", email);

            return null;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "GetUserByEmailAsync failed with SQL error for Email={Email}.", email);

            throw new UserValidationException("Failed to retrieve user by email.", ex);
        }
    }

    public async Task<int> CreateUserAsync(User user)
    {
        _logger.LogInformation(
            "CreateUserAsync started for Username={Username}, Email={Email}, EmployeeId={EmployeeId}.",
            user.Username,
            user.Email,
            user.EmployeeId);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_CreateUser", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@EmployeeId", user.EmployeeId);
            command.Parameters.AddWithValue("@Username", user.Username);
            command.Parameters.AddWithValue("@Email", user.Email);
            command.Parameters.AddWithValue("@PasswordHash", user.PasswordHash);
            command.Parameters.AddWithValue("@PasswordSalt", user.PasswordSalt);
            command.Parameters.AddWithValue("@IsActive", user.IsActive);
            command.Parameters.AddWithValue("@Phone", (object?)user.Phone ?? DBNull.Value);
            command.Parameters.AddWithValue("@Notes", (object?)user.Notes ?? DBNull.Value);

            await connection.OpenAsync();

            var result = await command.ExecuteScalarAsync();
            var newUserId = result != null && result != DBNull.Value
                ? Convert.ToInt32(result)
                : 0;

            _logger.LogInformation("CreateUserAsync succeeded. Created UserId={UserId}.", newUserId);

            return newUserId;
        }
        catch (SqlException ex) when (ex.Number == 2627 || ex.Number == 2601)
        {
            _logger.LogWarning(
                ex,
                "CreateUserAsync failed because Email={Email} already exists.",
                user.Email);

            throw new UserValidationException("A user with this email already exists.", ex);
        }
        catch (SqlException ex) when (ex.Number == 547)
        {
            _logger.LogWarning(
                ex,
                "CreateUserAsync failed because EmployeeId={EmployeeId} does not exist.",
                user.EmployeeId);

            throw new UserValidationException("The specified EmployeeId does not exist.", ex);
        }
        catch (SqlException ex)
        {
            _logger.LogError(
                ex,
                "CreateUserAsync failed with SQL error for Email={Email}, EmployeeId={EmployeeId}.",
                user.Email,
                user.EmployeeId);

            throw new UserValidationException("Failed to create the user.", ex);
        }
    }

    public async Task<bool> UpdateUserAsync(User user)
    {
        _logger.LogInformation(
            "UpdateUserAsync started for UserId={UserId}, Email={Email}, EmployeeId={EmployeeId}.",
            user.UserId,
            user.Email,
            user.EmployeeId);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_UpdateUser", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@UserId", user.UserId);
            command.Parameters.AddWithValue("@EmployeeId", user.EmployeeId);
            command.Parameters.AddWithValue("@Username", user.Username);
            command.Parameters.AddWithValue("@Email", user.Email);
            command.Parameters.AddWithValue("@PasswordHash", user.PasswordHash);
            command.Parameters.AddWithValue("@PasswordSalt", user.PasswordSalt);
            command.Parameters.AddWithValue("@IsActive", user.IsActive);
            command.Parameters.AddWithValue("@Phone", (object?)user.Phone ?? DBNull.Value);
            command.Parameters.AddWithValue("@Notes", (object?)user.Notes ?? DBNull.Value);

            await connection.OpenAsync();

            var result = await command.ExecuteScalarAsync();
            var rowsAffected = result != null && result != DBNull.Value
                ? Convert.ToInt32(result)
                : 0;

            var wasUpdated = rowsAffected > 0;

            if (wasUpdated)
            {
                _logger.LogInformation("UpdateUserAsync succeeded for UserId={UserId}.", user.UserId);
            }
            else
            {
                _logger.LogWarning("UpdateUserAsync affected 0 rows for UserId={UserId}.", user.UserId);
            }

            return wasUpdated;
        }
        catch (SqlException ex) when (ex.Number == 2627 || ex.Number == 2601)
        {
            _logger.LogWarning(
                ex,
                "UpdateUserAsync failed because Email={Email} already exists.",
                user.Email);

            throw new UserValidationException("A user with this email already exists.", ex);
        }
        catch (SqlException ex) when (ex.Number == 547)
        {
            _logger.LogWarning(
                ex,
                "UpdateUserAsync failed because EmployeeId={EmployeeId} does not exist.",
                user.EmployeeId);

            throw new UserValidationException("The specified EmployeeId does not exist.", ex);
        }
        catch (SqlException ex)
        {
            _logger.LogError(
                ex,
                "UpdateUserAsync failed with SQL error for UserId={UserId}.",
                user.UserId);

            throw new UserValidationException("Failed to update the user.", ex);
        }
    }

    public async Task<bool> DeleteUserAsync(int userId)
    {
        _logger.LogInformation("DeleteUserAsync started for UserId={UserId}.", userId);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_DeleteUser", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@UserId", userId);

            await connection.OpenAsync();

            var result = await command.ExecuteScalarAsync();
            var rowsAffected = result != null && result != DBNull.Value
                ? Convert.ToInt32(result)
                : 0;

            var wasDeleted = rowsAffected > 0;

            if (wasDeleted)
            {
                _logger.LogInformation("DeleteUserAsync succeeded for UserId={UserId}.", userId);
            }
            else
            {
                _logger.LogWarning("DeleteUserAsync affected 0 rows for UserId={UserId}.", userId);
            }

            return wasDeleted;
        }
        catch (SqlException ex) when (ex.Number == 547)
        {
            _logger.LogWarning(
                ex,
                "DeleteUserAsync failed because UserId={UserId} is referenced by other records.",
                userId);

            throw new UserValidationException("The user cannot be deleted because it is referenced by other records.", ex);
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "DeleteUserAsync failed with SQL error for UserId={UserId}.", userId);

            throw new UserValidationException("Failed to delete the user.", ex);
        }
    }

    public async Task<List<string>> GetUserRolesAsync(int userId)
    {
        _logger.LogInformation("GetUserRolesAsync started for UserId={UserId}.", userId);

        var roles = new List<string>();

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_GetUserRoles", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@UserId", userId);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                roles.Add(reader["RoleName"]?.ToString() ?? string.Empty);
            }

            _logger.LogInformation("GetUserRolesAsync succeeded for UserId={UserId}. Returned {RolesCount} roles.", userId, roles.Count);

            return roles;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "GetUserRolesAsync failed with SQL error for UserId={UserId}.", userId);

            throw new UserValidationException("Failed to retrieve user roles.", ex);
        }
    }

    public async Task<List<string>> GetUserDepartmentsAsync(int userId)
    {
        _logger.LogInformation("GetUserDepartmentsAsync started for UserId={UserId}.", userId);

        var departments = new List<string>();

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_GetUserDepartments", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@UserId", userId);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                departments.Add(reader["DepartmentName"]?.ToString() ?? string.Empty);
            }

            _logger.LogInformation("GetUserDepartmentsAsync succeeded for UserId={UserId}. Returned {DepartmentsCount} departments.", userId, departments.Count);

            return departments;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "GetUserDepartmentsAsync failed with SQL error for UserId={UserId}.", userId);

            throw new UserValidationException("Failed to retrieve user departments.", ex);
        }
    }

    public async Task UpdateLastLoginAtAsync(int userId)
    {
        _logger.LogInformation("UpdateLastLoginAtAsync started for UserId={UserId}.", userId);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_UpdateUserLastLogin", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@UserId", userId);

            await connection.OpenAsync();

            var result = await command.ExecuteScalarAsync();
            var rowsAffected = result != null && result != DBNull.Value
                ? Convert.ToInt32(result)
                : 0;

            if (rowsAffected > 0)
            {
                _logger.LogInformation("UpdateLastLoginAtAsync succeeded for UserId={UserId}.", userId);
            }
            else
            {
                _logger.LogWarning("UpdateLastLoginAtAsync affected 0 rows for UserId={UserId}.", userId);
            }
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "UpdateLastLoginAtAsync failed with SQL error for UserId={UserId}.", userId);

            throw new UserValidationException("Failed to update last login date for the user.", ex);
        }
    }

    public async Task SetUserRolesAsync(int userId, List<string> roles)
    {
        _logger.LogInformation("SetUserRolesAsync started for UserId={UserId}.", userId);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await connection.OpenAsync();

            await using (var deactivateCommand = new SqlCommand("dbo.sp_DeactivateUserRoles", connection))
            {
                deactivateCommand.CommandType = CommandType.StoredProcedure;
                deactivateCommand.Parameters.AddWithValue("@UserId", userId);

                await deactivateCommand.ExecuteNonQueryAsync();
            }

            if (roles == null || roles.Count == 0)
            {
                _logger.LogInformation("No roles provided for UserId={UserId}.", userId);
                return;
            }

            foreach (var roleName in roles)
            {
                if (string.IsNullOrWhiteSpace(roleName))
                {
                    continue;
                }

                await using var upsertCommand = new SqlCommand("dbo.sp_UpsertUserRole", connection)
                {
                    CommandType = CommandType.StoredProcedure
                };

                upsertCommand.Parameters.AddWithValue("@UserId", userId);
                upsertCommand.Parameters.AddWithValue("@RoleName", roleName.Trim());

                await upsertCommand.ExecuteNonQueryAsync();
            }

            _logger.LogInformation("SetUserRolesAsync completed for UserId={UserId}.", userId);
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "SetUserRolesAsync failed for UserId={UserId}.", userId);
            throw new UserValidationException("Failed to update user roles.", ex);
        }
    }

    public async Task SetUserDepartmentsAsync(int userId, List<string> departments)
    {
        _logger.LogInformation("SetUserDepartmentsAsync started for UserId={UserId}.", userId);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await connection.OpenAsync();

            await using (var deactivateCommand = new SqlCommand("dbo.sp_DeactivateUserDepartments", connection))
            {
                deactivateCommand.CommandType = CommandType.StoredProcedure;
                deactivateCommand.Parameters.AddWithValue("@UserId", userId);

                await deactivateCommand.ExecuteNonQueryAsync();
            }

            if (departments == null || departments.Count == 0)
            {
                _logger.LogInformation("No departments provided for UserId={UserId}.", userId);
                return;
            }

            foreach (var departmentName in departments)
            {
                if (string.IsNullOrWhiteSpace(departmentName))
                {
                    continue;
                }

                await using var upsertCommand = new SqlCommand("dbo.sp_UpsertUserDepartment", connection)
                {
                    CommandType = CommandType.StoredProcedure
                };

                upsertCommand.Parameters.AddWithValue("@UserId", userId);
                upsertCommand.Parameters.AddWithValue("@DepartmentName", departmentName.Trim());

                await upsertCommand.ExecuteNonQueryAsync();
            }

            _logger.LogInformation("SetUserDepartmentsAsync completed for UserId={UserId}.", userId);
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "SetUserDepartmentsAsync failed for UserId={UserId}.", userId);
            throw new UserValidationException("Failed to update user departments.", ex);
        }
    }

    public async Task<List<string>> GetAllRoleNamesAsync()
    {
        _logger.LogInformation("GetAllRoleNamesAsync started.");

        var roles = new List<string>();

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_GetAllRoleNames", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                roles.Add(reader["RoleName"]?.ToString() ?? string.Empty);
            }

            _logger.LogInformation("GetAllRoleNamesAsync succeeded. Returned {RolesCount} roles.", roles.Count);

            return roles;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "GetAllRoleNamesAsync failed with SQL error.");

            throw new UserValidationException("Failed to retrieve roles list.", ex);
        }
    }

    public async Task<List<string>> GetAllDepartmentNamesAsync()
    {
        _logger.LogInformation("GetAllDepartmentNamesAsync started.");

        var departments = new List<string>();

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_GetAllDepartmentNames", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                departments.Add(reader["DepartmentName"]?.ToString() ?? string.Empty);
            }

            _logger.LogInformation("GetAllDepartmentNamesAsync succeeded. Returned {DepartmentsCount} departments.", departments.Count);

            return departments;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "GetAllDepartmentNamesAsync failed with SQL error.");

            throw new UserValidationException("Failed to retrieve departments list.", ex);
        }
    }

    private static User MapUser(SqlDataReader reader)
    {
        return new User
        {
            UserId = reader["UserId"] != DBNull.Value ? Convert.ToInt32(reader["UserId"]) : 0,
            EmployeeId = reader["EmployeeId"] != DBNull.Value ? Convert.ToInt32(reader["EmployeeId"]) : 0,
            Username = reader["Username"]?.ToString() ?? string.Empty,
            Email = reader["Email"] != DBNull.Value ? reader["Email"]?.ToString() ?? string.Empty : string.Empty,
            PasswordHash = reader["PasswordHash"] != DBNull.Value ? reader["PasswordHash"]?.ToString() ?? string.Empty : string.Empty,
            PasswordSalt = reader["PasswordSalt"] != DBNull.Value ? reader["PasswordSalt"]?.ToString() ?? string.Empty : string.Empty,
            IsActive = reader["IsActive"] != DBNull.Value && Convert.ToBoolean(reader["IsActive"]),
            LastLoginAt = reader["LastLoginAt"] != DBNull.Value ? Convert.ToDateTime(reader["LastLoginAt"]) : null,
            CreatedAt = reader["CreatedAt"] != DBNull.Value ? Convert.ToDateTime(reader["CreatedAt"]) : DateTime.MinValue,
            Phone = reader["Phone"] != DBNull.Value ? reader["Phone"]?.ToString() : null,
            Notes = reader["Notes"] != DBNull.Value ? reader["Notes"]?.ToString() : null
        };
    }
}