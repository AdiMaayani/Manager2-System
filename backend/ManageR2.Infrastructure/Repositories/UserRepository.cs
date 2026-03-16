using System.Data;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Repositories;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace ManageR2.Infrastructure.Repositories;

public class UserRepository : IUserRepository
{
    private readonly string _connectionString;

    public UserRepository(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("DefaultConnection connection string was not found.");
    }

    public async Task<IEnumerable<User>> GetUsersAsync()
    {
        var users = new List<User>();

        await using var connection = new SqlConnection(_connectionString);
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

    public async Task<User?> GetUserByIdAsync(int userId)
    {
        await using var connection = new SqlConnection(_connectionString);
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

    public Task<int> CreateUserAsync(User user)
    {
        throw new NotImplementedException();
    }

    public Task<bool> UpdateUserAsync(User user)
    {
        throw new NotImplementedException();
    }

    public Task<bool> DeleteUserAsync(int userId)
    {
        throw new NotImplementedException();
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