using System.Data;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.DAL;
using Microsoft.Data.SqlClient;

namespace ManageR2.Infrastructure.Repositories;

public class UserRepository : IUserRepository
{
    private readonly DBServices _dbServices;

    public UserRepository(DBServices dbServices)
    {
        _dbServices = dbServices;
    }

    public async Task<IEnumerable<User>> GetUsersAsync()
    {
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

            return users;
        }
        catch (SqlException ex)
        {
            throw new UserValidationException("Failed to retrieve users from the database.", ex);
        }
    }

    public async Task<User?> GetUserByIdAsync(int userId)
    {
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
                return MapUser(reader);
            }

            return null;
        }
        catch (SqlException ex)
        {
            throw new UserValidationException("Failed to retrieve the requested user from the database.", ex);
        }
    }

    public async Task<int> CreateUserAsync(User user)
    {
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
            command.Parameters.AddWithValue("@IsActive", user.IsActive);

            await connection.OpenAsync();

            var result = await command.ExecuteScalarAsync();

            return result != null && result != DBNull.Value
                ? Convert.ToInt32(result)
                : 0;
        }
        catch (SqlException ex) when (ex.Number == 2627 || ex.Number == 2601)
        {
            throw new UserValidationException("A user with this email already exists.", ex);
        }
        catch (SqlException ex) when (ex.Number == 547)
        {
            throw new UserValidationException("The specified EmployeeId does not exist.", ex);
        }
        catch (SqlException ex)
        {
            throw new UserValidationException("Failed to create the user.", ex);
        }
    }

    public async Task<bool> UpdateUserAsync(User user)
    {
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
            command.Parameters.AddWithValue("@IsActive", user.IsActive);

            await connection.OpenAsync();

            var result = await command.ExecuteScalarAsync();
            var rowsAffected = result != null && result != DBNull.Value
                ? Convert.ToInt32(result)
                : 0;

            return rowsAffected > 0;
        }
        catch (SqlException ex) when (ex.Number == 2627 || ex.Number == 2601)
        {
            throw new UserValidationException("A user with this email already exists.", ex);
        }
        catch (SqlException ex) when (ex.Number == 547)
        {
            throw new UserValidationException("The specified EmployeeId does not exist.", ex);
        }
        catch (SqlException ex)
        {
            throw new UserValidationException("Failed to update the user.", ex);
        }
    }

    public async Task<bool> DeleteUserAsync(int userId)
    {
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

            return rowsAffected > 0;
        }
        catch (SqlException ex) when (ex.Number == 547)
        {
            throw new UserValidationException("The user cannot be deleted because it is referenced by other records.", ex);
        }
        catch (SqlException ex)
        {
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
            IsActive = reader["IsActive"] != DBNull.Value && Convert.ToBoolean(reader["IsActive"]),
            LastLoginAt = reader["LastLoginAt"] != DBNull.Value ? Convert.ToDateTime(reader["LastLoginAt"]) : null,
            CreatedAt = reader["CreatedAt"] != DBNull.Value ? Convert.ToDateTime(reader["CreatedAt"]) : DateTime.MinValue
        };
    }
}