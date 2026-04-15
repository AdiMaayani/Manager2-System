using System.Data;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.DAL;
using Microsoft.Data.SqlClient;

namespace ManageR2.Infrastructure.Repositories;

public class EmployeeRepository : IEmployeeRepository
{
    private readonly DBServices _dbServices;

    public EmployeeRepository(DBServices dbServices)
    {
        _dbServices = dbServices;
    }

    public async Task<List<Employee>> GetAllAsync()
    {
        var employees = new List<Employee>();

        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand(
            @"SELECT
                  EmployeeId,
                  FullName,
                  PrimaryRole,
                  Phone,
                  Email,
                  IsActive,
                  CreatedAt
              FROM dbo.Employees
              ORDER BY FullName ASC",
            connection)
        {
            CommandType = CommandType.Text
        };

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            employees.Add(MapEmployee(reader));
        }

        return employees;
    }

    public async Task<Employee?> GetByIdAsync(int employeeId)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand(
            @"SELECT
                  EmployeeId,
                  FullName,
                  PrimaryRole,
                  Phone,
                  Email,
                  IsActive,
                  CreatedAt
              FROM dbo.Employees
              WHERE EmployeeId = @EmployeeId",
            connection)
        {
            CommandType = CommandType.Text
        };

        command.Parameters.AddWithValue("@EmployeeId", employeeId);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();

        if (await reader.ReadAsync())
        {
            return MapEmployee(reader);
        }

        return null;
    }

    private static Employee MapEmployee(SqlDataReader reader)
    {
        return new Employee
        {
            EmployeeId = reader["EmployeeId"] != DBNull.Value ? Convert.ToInt32(reader["EmployeeId"]) : 0,
            FullName = reader["FullName"]?.ToString() ?? string.Empty,
            PrimaryRole = reader["PrimaryRole"]?.ToString() ?? string.Empty,
            Phone = reader["Phone"] != DBNull.Value ? reader["Phone"]?.ToString() : null,
            Email = reader["Email"] != DBNull.Value ? reader["Email"]?.ToString() : null,
            IsActive = reader["IsActive"] != DBNull.Value && Convert.ToBoolean(reader["IsActive"]),
            CreatedAt = reader["CreatedAt"] != DBNull.Value ? Convert.ToDateTime(reader["CreatedAt"]) : DateTime.MinValue
        };
    }
}