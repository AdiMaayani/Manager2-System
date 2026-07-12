using System.Data.Common;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.DAL.Providers;
using ManageR2.Infrastructure.Interfaces;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace ManageR2.Infrastructure.Features.Customers.Repositories;

// PostgreSQL implementation of the customer contract (migration target). Reproduces the behavior of
// sp_GetCustomers / sp_GetCustomerById / sp_CreateCustomer / sp_UpdateCustomer / sp_DeactivateCustomer
// as parameterized SQL (service-refactor strategy) against the translated "Customers" table:
//   - Trims required fields; trims-then-nulls optional fields (NULLIF(btrim(x),'')).
//   - Stamps CreatedAt/UpdatedAt with UTC (matching SYSUTCDATETIME()).
//   - Orders GetAll by CustomerId DESC.
//   - Maps FK/CHECK violations (SQLSTATE 23503/23514) to the same domain messages as SQL Server's 547.
public sealed class PostgresCustomerRepository : ICustomerRepository
{
    private readonly PostgresConnectionFactory _connectionFactory;
    private readonly ILogger<PostgresCustomerRepository> _logger;

    public PostgresCustomerRepository(
        PostgresConnectionFactory connectionFactory,
        ILogger<PostgresCustomerRepository> logger)
    {
        _connectionFactory = connectionFactory;
        _logger = logger;
    }

    private const string CustomerColumns =
        """
        "CustomerId", "CustomerName", "CustomerType", "PrimaryPhone", "PrimaryEmail",
        "City", "Region", "Address", "Status", "Notes", "IsActive", "CreatedAt",
        "CreatedByUserId", "UpdatedAt", "UpdatedByUserId"
        """;

    public async Task<IEnumerable<Customer>> GetAllAsync()
    {
        var customers = new List<Customer>();

        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText = $"""
                SELECT {CustomerColumns}
                FROM "Customers"
                ORDER BY "CustomerId" DESC
                """;

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                customers.Add(MapCustomer(reader));
            }

            return customers;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres GetAllAsync failed for Customers.");
            throw new UserValidationException("Failed to retrieve customers from the database.", ex);
        }
    }

    public async Task<Customer?> GetByIdAsync(int customerId)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText = $"""
                SELECT {CustomerColumns}
                FROM "Customers"
                WHERE "CustomerId" = @CustomerId
                """;
            AddParameter(command, "@CustomerId", customerId);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();
            return await reader.ReadAsync() ? MapCustomer(reader) : null;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres GetByIdAsync failed for CustomerId={CustomerId}.", customerId);
            throw new UserValidationException("Failed to retrieve the requested customer.", ex);
        }
    }

    public async Task<int> CreateAsync(Customer customer)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                INSERT INTO "Customers"
                    ("CustomerName", "CustomerType", "PrimaryPhone", "PrimaryEmail", "City",
                     "Region", "Address", "Status", "Notes", "IsActive", "CreatedAt",
                     "CreatedByUserId", "UpdatedAt", "UpdatedByUserId")
                VALUES
                    (btrim(@CustomerName::text), btrim(@CustomerType::text),
                     NULLIF(btrim(@PrimaryPhone::text), ''), NULLIF(btrim(@PrimaryEmail::text), ''),
                     NULLIF(btrim(@City::text), ''), NULLIF(btrim(@Region::text), ''),
                     NULLIF(btrim(@Address::text), ''), NULLIF(btrim(@Status::text), ''),
                     NULLIF(btrim(@Notes::text), ''), @IsActive::boolean, (now() at time zone 'utc'),
                     @CreatedByUserId::int, NULL, NULL)
                RETURNING "CustomerId"
                """;

            AddParameter(command, "@CustomerName", customer.CustomerName);
            AddParameter(command, "@CustomerType", customer.CustomerType);
            AddParameter(command, "@PrimaryPhone", (object?)customer.PrimaryPhone ?? DBNull.Value);
            AddParameter(command, "@PrimaryEmail", (object?)customer.PrimaryEmail ?? DBNull.Value);
            AddParameter(command, "@City", (object?)customer.City ?? DBNull.Value);
            AddParameter(command, "@Region", (object?)customer.Region ?? DBNull.Value);
            AddParameter(command, "@Address", (object?)customer.Address ?? DBNull.Value);
            AddParameter(command, "@Status", (object?)customer.Status ?? DBNull.Value);
            AddParameter(command, "@Notes", (object?)customer.Notes ?? DBNull.Value);
            AddParameter(command, "@IsActive", customer.IsActive);
            AddParameter(command, "@CreatedByUserId", customer.CreatedByUserId);

            await connection.OpenAsync();
            var result = await command.ExecuteScalarAsync();
            return result is null or DBNull ? 0 : Convert.ToInt32(result);
        }
        catch (PostgresException ex) when (ex.SqlState is "23503" or "23514")
        {
            _logger.LogWarning(ex, "Postgres CreateAsync failed for CustomerName={CustomerName} (FK/CHECK).", customer.CustomerName);
            throw new UserValidationException("Failed to create customer because one or more referenced values are invalid.", ex);
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres CreateAsync failed for CustomerName={CustomerName}.", customer.CustomerName);
            throw new UserValidationException("Failed to create customer.", ex);
        }
    }

    public async Task<bool> UpdateAsync(Customer customer)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                UPDATE "Customers" SET
                    "CustomerName"    = btrim(@CustomerName::text),
                    "CustomerType"    = btrim(@CustomerType::text),
                    "PrimaryPhone"    = NULLIF(btrim(@PrimaryPhone::text), ''),
                    "PrimaryEmail"    = NULLIF(btrim(@PrimaryEmail::text), ''),
                    "City"            = NULLIF(btrim(@City::text), ''),
                    "Region"          = NULLIF(btrim(@Region::text), ''),
                    "Address"         = NULLIF(btrim(@Address::text), ''),
                    "Status"          = NULLIF(btrim(@Status::text), ''),
                    "Notes"           = NULLIF(btrim(@Notes::text), ''),
                    "IsActive"        = @IsActive::boolean,
                    "UpdatedAt"       = (now() at time zone 'utc'),
                    "UpdatedByUserId" = @UpdatedByUserId::int
                WHERE "CustomerId" = @CustomerId::int
                """;

            AddParameter(command, "@CustomerId", customer.CustomerId);
            AddParameter(command, "@CustomerName", customer.CustomerName);
            AddParameter(command, "@CustomerType", customer.CustomerType);
            AddParameter(command, "@PrimaryPhone", (object?)customer.PrimaryPhone ?? DBNull.Value);
            AddParameter(command, "@PrimaryEmail", (object?)customer.PrimaryEmail ?? DBNull.Value);
            AddParameter(command, "@City", (object?)customer.City ?? DBNull.Value);
            AddParameter(command, "@Region", (object?)customer.Region ?? DBNull.Value);
            AddParameter(command, "@Address", (object?)customer.Address ?? DBNull.Value);
            AddParameter(command, "@Status", (object?)customer.Status ?? DBNull.Value);
            AddParameter(command, "@Notes", (object?)customer.Notes ?? DBNull.Value);
            AddParameter(command, "@IsActive", customer.IsActive);
            AddParameter(command, "@UpdatedByUserId", (object?)customer.UpdatedByUserId ?? DBNull.Value);

            await connection.OpenAsync();
            var rowsAffected = await command.ExecuteNonQueryAsync();
            return rowsAffected > 0;
        }
        catch (PostgresException ex) when (ex.SqlState is "23503" or "23514")
        {
            _logger.LogWarning(ex, "Postgres UpdateAsync failed for CustomerId={CustomerId} (FK/CHECK).", customer.CustomerId);
            throw new UserValidationException("Failed to update customer because one or more referenced values are invalid.", ex);
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres UpdateAsync failed for CustomerId={CustomerId}.", customer.CustomerId);
            throw new UserValidationException("Failed to update customer.", ex);
        }
    }

    public async Task<bool> DeactivateAsync(int customerId, int updatedByUserId)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                UPDATE "Customers" SET
                    "IsActive"        = false,
                    "UpdatedAt"       = (now() at time zone 'utc'),
                    "UpdatedByUserId" = @UpdatedByUserId::int
                WHERE "CustomerId" = @CustomerId::int
                  AND "IsActive" = true
                """;

            AddParameter(command, "@CustomerId", customerId);
            AddParameter(command, "@UpdatedByUserId", updatedByUserId);

            await connection.OpenAsync();
            var rowsAffected = await command.ExecuteNonQueryAsync();
            return rowsAffected > 0;
        }
        catch (PostgresException ex) when (ex.SqlState is "23503")
        {
            _logger.LogWarning(ex, "Postgres DeactivateAsync failed for CustomerId={CustomerId} (FK).", customerId);
            throw new UserValidationException("The customer cannot be deactivated because it is referenced by other records.", ex);
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres DeactivateAsync failed for CustomerId={CustomerId}.", customerId);
            throw new UserValidationException("Failed to deactivate customer.", ex);
        }
    }

    private static void AddParameter(DbCommand command, string name, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }

    private static Customer MapCustomer(DbDataReader reader)
    {
        return new Customer
        {
            CustomerId = GetInt(reader, "CustomerId"),
            CustomerName = GetString(reader, "CustomerName") ?? string.Empty,
            CustomerType = GetString(reader, "CustomerType") ?? string.Empty,
            PrimaryPhone = GetString(reader, "PrimaryPhone"),
            PrimaryEmail = GetString(reader, "PrimaryEmail"),
            City = GetString(reader, "City"),
            Region = GetString(reader, "Region"),
            Address = GetString(reader, "Address"),
            Status = GetString(reader, "Status"),
            Notes = GetString(reader, "Notes"),
            IsActive = GetBool(reader, "IsActive"),
            CreatedAt = GetDateTime(reader, "CreatedAt") ?? DateTime.MinValue,
            CreatedByUserId = GetInt(reader, "CreatedByUserId"),
            UpdatedAt = GetDateTime(reader, "UpdatedAt"),
            UpdatedByUserId = GetNullableInt(reader, "UpdatedByUserId")
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

    private static int? GetNullableInt(DbDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? null : reader.GetInt32(ordinal);
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
