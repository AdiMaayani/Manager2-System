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
            CreatedAt = reader["CreatedAt"] != DBNull.Value ? Convert.ToDateTime(reader["CreatedAt"]) : DateTime.MinValue
        };
    }
}