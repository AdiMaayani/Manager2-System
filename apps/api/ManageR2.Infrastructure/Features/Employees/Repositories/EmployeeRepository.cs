using System.Data;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.DAL;
using Microsoft.Data.SqlClient;

namespace ManageR2.Infrastructure.Repositories;

// Employee catalog persistence; all database access is through stored procedures.
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
        await using var command = new SqlCommand("dbo.sp_GetEmployees", connection)
        {
            CommandType = CommandType.StoredProcedure
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
        await using var command = new SqlCommand("dbo.sp_GetEmployeeById", connection)
        {
            CommandType = CommandType.StoredProcedure
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

    public async Task<int> CreateAsync(Employee employee)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_CreateEmployee", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        AddEditableEmployeeParameters(command, employee);

        await connection.OpenAsync();
        var result = await command.ExecuteScalarAsync();
        return result != null && result != DBNull.Value ? Convert.ToInt32(result) : 0;
    }

    public async Task<bool> UpdateAsync(Employee employee)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_UpdateEmployee", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        command.Parameters.AddWithValue("@EmployeeId", employee.EmployeeId);
        AddEditableEmployeeParameters(command, employee);

        await connection.OpenAsync();
        var result = await command.ExecuteScalarAsync();
        var rowsAffected = result != null && result != DBNull.Value ? Convert.ToInt32(result) : 0;

        return rowsAffected > 0;
    }

    public async Task<bool> SetActiveStatusAsync(int employeeId, bool isActive)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_SetEmployeeActiveStatus", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        command.Parameters.AddWithValue("@EmployeeId", employeeId);
        command.Parameters.AddWithValue("@IsActive", isActive);

        await connection.OpenAsync();
        var result = await command.ExecuteScalarAsync();
        var rowsAffected = result != null && result != DBNull.Value ? Convert.ToInt32(result) : 0;

        return rowsAffected > 0;
    }

    public async Task<List<string>> GetDistinctPrimaryRolesAsync()
    {
        var roles = new List<string>();

        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_Employees_GetDistinctPrimaryRoles", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var role = reader["PrimaryRole"]?.ToString();
            if (!string.IsNullOrWhiteSpace(role))
            {
                roles.Add(role.Trim());
            }
        }

        return roles;
    }

    private static void AddEditableEmployeeParameters(SqlCommand command, Employee employee)
    {
        command.Parameters.AddWithValue("@FullName", employee.FullName);
        command.Parameters.AddWithValue("@PrimaryRole", employee.PrimaryRole);
        command.Parameters.AddWithValue("@Phone", (object?)employee.Phone ?? DBNull.Value);
        command.Parameters.AddWithValue("@Email", (object?)employee.Email ?? DBNull.Value);
        command.Parameters.AddWithValue("@DailyCapacityHours", employee.DailyCapacityHours.HasValue ? employee.DailyCapacityHours.Value : DBNull.Value);
        command.Parameters.AddWithValue("@IsAssignable", employee.IsAssignable);
        command.Parameters.AddWithValue("@IsActive", employee.IsActive);
    }

    // Reader → Employee; keeps Infrastructure aligned with Employees table columns.
    private static Employee MapEmployee(SqlDataReader reader)
    {
        return new Employee
        {
            EmployeeId = reader["EmployeeId"] != DBNull.Value ? Convert.ToInt32(reader["EmployeeId"]) : 0,
            FullName = reader["FullName"]?.ToString() ?? string.Empty,
            PrimaryRole = reader["PrimaryRole"]?.ToString() ?? string.Empty,
            Phone = reader["Phone"] != DBNull.Value ? reader["Phone"]?.ToString() : null,
            Email = reader["Email"] != DBNull.Value ? reader["Email"]?.ToString() : null,
            DailyCapacityHours = reader["DailyCapacityHours"] != DBNull.Value ? Convert.ToDecimal(reader["DailyCapacityHours"]) : null,
            IsAssignable = reader["IsAssignable"] != DBNull.Value && Convert.ToBoolean(reader["IsAssignable"]),
            IsActive = reader["IsActive"] != DBNull.Value && Convert.ToBoolean(reader["IsActive"]),
            CreatedAt = reader["CreatedAt"] != DBNull.Value ? Convert.ToDateTime(reader["CreatedAt"]) : DateTime.MinValue
        };
    }
}
