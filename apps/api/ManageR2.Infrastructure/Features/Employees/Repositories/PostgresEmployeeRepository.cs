using System.Data.Common;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.DAL.Providers;
using ManageR2.Infrastructure.Repositories;
using Npgsql;

namespace ManageR2.Infrastructure.Features.Employees.Repositories;

// PostgreSQL implementation of the employee contract (migration target). Reproduces sp_GetEmployees /
// sp_GetEmployeeById / sp_CreateEmployee / sp_UpdateEmployee / sp_SetEmployeeActiveStatus /
// sp_Employees_GetDistinctPrimaryRoles against the translated "Employees" table.
// Fidelity notes: values are stored as-is (no trim), CreatedAt uses server local time (SYSDATETIME),
// GetAll orders by FullName ASC, and the distinct-roles projection trims and filters active rows.
public sealed class PostgresEmployeeRepository : IEmployeeRepository
{
    private readonly PostgresConnectionFactory _connectionFactory;

    public PostgresEmployeeRepository(PostgresConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    private const string EmployeeColumns =
        """
        "EmployeeId", "FullName", "PrimaryRole", "Phone", "Email",
        "DailyCapacityHours", "IsAssignable", "IsActive", "CreatedAt"
        """;

    public async Task<List<Employee>> GetAllAsync()
    {
        var employees = new List<Employee>();

        await using var connection = _connectionFactory.CreateConnection();
        await using var command = connection.CreateCommand();
        command.CommandText = $"""
            SELECT {EmployeeColumns}
            FROM "Employees"
            ORDER BY "FullName" ASC
            """;

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
        await using var connection = _connectionFactory.CreateConnection();
        await using var command = connection.CreateCommand();
        command.CommandText = $"""
            SELECT {EmployeeColumns}
            FROM "Employees"
            WHERE "EmployeeId" = @EmployeeId
            """;
        AddParameter(command, "@EmployeeId", employeeId);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        return await reader.ReadAsync() ? MapEmployee(reader) : null;
    }

    public async Task<int> CreateAsync(Employee employee)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            INSERT INTO "Employees"
                ("FullName", "PrimaryRole", "Phone", "Email", "DailyCapacityHours",
                 "IsAssignable", "IsActive", "CreatedAt")
            VALUES
                (@FullName::text, @PrimaryRole::text, @Phone::text, @Email::text,
                 @DailyCapacityHours::numeric, @IsAssignable::boolean, @IsActive::boolean, localtimestamp)
            RETURNING "EmployeeId"
            """;
        AddEditableEmployeeParameters(command, employee);

        await connection.OpenAsync();
        var result = await command.ExecuteScalarAsync();
        return result is null or DBNull ? 0 : Convert.ToInt32(result);
    }

    public async Task<bool> UpdateAsync(Employee employee)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            UPDATE "Employees" SET
                "FullName"           = @FullName::text,
                "PrimaryRole"        = @PrimaryRole::text,
                "Phone"              = @Phone::text,
                "Email"              = @Email::text,
                "DailyCapacityHours" = @DailyCapacityHours::numeric,
                "IsAssignable"       = @IsAssignable::boolean,
                "IsActive"           = @IsActive::boolean
            WHERE "EmployeeId" = @EmployeeId::int
            """;
        AddParameter(command, "@EmployeeId", employee.EmployeeId);
        AddEditableEmployeeParameters(command, employee);

        await connection.OpenAsync();
        var rowsAffected = await command.ExecuteNonQueryAsync();
        return rowsAffected > 0;
    }

    public async Task<bool> SetActiveStatusAsync(int employeeId, bool isActive)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            UPDATE "Employees" SET "IsActive" = @IsActive::boolean
            WHERE "EmployeeId" = @EmployeeId::int
            """;
        AddParameter(command, "@EmployeeId", employeeId);
        AddParameter(command, "@IsActive", isActive);

        await connection.OpenAsync();
        var rowsAffected = await command.ExecuteNonQueryAsync();
        return rowsAffected > 0;
    }

    public async Task<List<string>> GetDistinctPrimaryRolesAsync()
    {
        var roles = new List<string>();

        await using var connection = _connectionFactory.CreateConnection();
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT DISTINCT btrim("PrimaryRole") AS "PrimaryRole"
            FROM "Employees"
            WHERE "IsActive" = true
              AND btrim(COALESCE("PrimaryRole", '')) <> ''
            ORDER BY "PrimaryRole"
            """;

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var role = reader.IsDBNull(0) ? null : reader.GetString(0);
            if (!string.IsNullOrWhiteSpace(role))
            {
                roles.Add(role.Trim());
            }
        }

        return roles;
    }

    private static void AddEditableEmployeeParameters(DbCommand command, Employee employee)
    {
        AddParameter(command, "@FullName", employee.FullName);
        AddParameter(command, "@PrimaryRole", employee.PrimaryRole);
        AddParameter(command, "@Phone", (object?)employee.Phone ?? DBNull.Value);
        AddParameter(command, "@Email", (object?)employee.Email ?? DBNull.Value);
        AddParameter(command, "@DailyCapacityHours", (object?)employee.DailyCapacityHours ?? DBNull.Value);
        AddParameter(command, "@IsAssignable", employee.IsAssignable);
        AddParameter(command, "@IsActive", employee.IsActive);
    }

    private static void AddParameter(DbCommand command, string name, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }

    private static Employee MapEmployee(DbDataReader reader)
    {
        return new Employee
        {
            EmployeeId = GetInt(reader, "EmployeeId"),
            FullName = GetString(reader, "FullName") ?? string.Empty,
            PrimaryRole = GetString(reader, "PrimaryRole") ?? string.Empty,
            Phone = GetString(reader, "Phone"),
            Email = GetString(reader, "Email"),
            DailyCapacityHours = GetNullableDecimal(reader, "DailyCapacityHours"),
            IsAssignable = GetBool(reader, "IsAssignable"),
            IsActive = GetBool(reader, "IsActive"),
            CreatedAt = GetDateTime(reader, "CreatedAt") ?? DateTime.MinValue
        };
    }

    private static string? GetString(DbDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
    }

    private static int GetInt(DbDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? 0 : reader.GetInt32(ordinal);
    }

    private static decimal? GetNullableDecimal(DbDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? null : reader.GetDecimal(ordinal);
    }

    private static bool GetBool(DbDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        return !reader.IsDBNull(ordinal) && reader.GetBoolean(ordinal);
    }

    private static DateTime? GetDateTime(DbDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? null : reader.GetDateTime(ordinal);
    }
}
