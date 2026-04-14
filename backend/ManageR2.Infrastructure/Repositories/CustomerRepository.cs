using System.Data;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.DAL;
using ManageR2.Infrastructure.Interfaces;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Repositories;

public class CustomerRepository : ICustomerRepository
{
    private readonly DBServices _dbServices;
    private readonly ILogger<CustomerRepository> _logger;

    public CustomerRepository(DBServices dbServices, ILogger<CustomerRepository> logger)
    {
        _dbServices = dbServices;
        _logger = logger;
    }

    public async Task<IEnumerable<Customer>> GetAllAsync()
    {
        _logger.LogInformation("GetAllAsync started for Customers.");

        var customers = new List<Customer>();

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_GetCustomers", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                customers.Add(MapCustomer(reader));
            }

            _logger.LogInformation("GetAllAsync succeeded for Customers. Returned {Count} records.", customers.Count);

            return customers;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "GetAllAsync failed with SQL error for Customers.");
            throw new UserValidationException("Failed to retrieve customers from the database.", ex);
        }
    }

    public async Task<Customer?> GetByIdAsync(int customerId)
    {
        _logger.LogInformation("GetByIdAsync started for CustomerId={CustomerId}.", customerId);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_GetCustomerById", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@CustomerId", customerId);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                var customer = MapCustomer(reader);

                _logger.LogInformation("GetByIdAsync succeeded for CustomerId={CustomerId}.", customerId);

                return customer;
            }

            _logger.LogWarning("GetByIdAsync returned no record for CustomerId={CustomerId}.", customerId);

            return null;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "GetByIdAsync failed with SQL error for CustomerId={CustomerId}.", customerId);
            throw new UserValidationException("Failed to retrieve the requested customer.", ex);
        }
    }

    public async Task<int> CreateAsync(Customer customer)
    {
        _logger.LogInformation(
            "CreateAsync started for CustomerName={CustomerName}, CustomerType={CustomerType}.",
            customer.CustomerName,
            customer.CustomerType);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_CreateCustomer", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@CustomerName", customer.CustomerName);
            command.Parameters.AddWithValue("@CustomerType", customer.CustomerType);
            command.Parameters.AddWithValue("@PrimaryPhone", (object?)customer.PrimaryPhone ?? DBNull.Value);
            command.Parameters.AddWithValue("@PrimaryEmail", (object?)customer.PrimaryEmail ?? DBNull.Value);
            command.Parameters.AddWithValue("@City", (object?)customer.City ?? DBNull.Value);
            command.Parameters.AddWithValue("@Region", (object?)customer.Region ?? DBNull.Value);
            command.Parameters.AddWithValue("@Address", (object?)customer.Address ?? DBNull.Value);
            command.Parameters.AddWithValue("@Status", (object?)customer.Status ?? DBNull.Value);
            command.Parameters.AddWithValue("@Notes", (object?)customer.Notes ?? DBNull.Value);
            command.Parameters.AddWithValue("@IsActive", customer.IsActive);
            command.Parameters.AddWithValue("@CreatedByUserId", customer.CreatedByUserId);

            await connection.OpenAsync();

            var result = await command.ExecuteScalarAsync();
            var newCustomerId = result != null && result != DBNull.Value
                ? Convert.ToInt32(result)
                : 0;

            _logger.LogInformation("CreateAsync succeeded. Created CustomerId={CustomerId}.", newCustomerId);

            return newCustomerId;
        }
        catch (SqlException ex) when (ex.Number == 547)
        {
            _logger.LogWarning(
                ex,
                "CreateAsync failed for CustomerName={CustomerName} because of FK or CHECK constraint.",
                customer.CustomerName);

            throw new UserValidationException("Failed to create customer because one or more referenced values are invalid.", ex);
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "CreateAsync failed with SQL error for CustomerName={CustomerName}.", customer.CustomerName);
            throw new UserValidationException("Failed to create customer.", ex);
        }
    }

    public async Task<bool> UpdateAsync(Customer customer)
    {
        _logger.LogInformation(
            "UpdateAsync started for CustomerId={CustomerId}, CustomerName={CustomerName}.",
            customer.CustomerId,
            customer.CustomerName);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_UpdateCustomer", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@CustomerId", customer.CustomerId);
            command.Parameters.AddWithValue("@CustomerName", customer.CustomerName);
            command.Parameters.AddWithValue("@CustomerType", customer.CustomerType);
            command.Parameters.AddWithValue("@PrimaryPhone", (object?)customer.PrimaryPhone ?? DBNull.Value);
            command.Parameters.AddWithValue("@PrimaryEmail", (object?)customer.PrimaryEmail ?? DBNull.Value);
            command.Parameters.AddWithValue("@City", (object?)customer.City ?? DBNull.Value);
            command.Parameters.AddWithValue("@Region", (object?)customer.Region ?? DBNull.Value);
            command.Parameters.AddWithValue("@Address", (object?)customer.Address ?? DBNull.Value);
            command.Parameters.AddWithValue("@Status", (object?)customer.Status ?? DBNull.Value);
            command.Parameters.AddWithValue("@Notes", (object?)customer.Notes ?? DBNull.Value);
            command.Parameters.AddWithValue("@IsActive", customer.IsActive);
            command.Parameters.AddWithValue("@UpdatedByUserId", (object?)customer.UpdatedByUserId ?? DBNull.Value);

            await connection.OpenAsync();

            var result = await command.ExecuteScalarAsync();
            var rowsAffected = result != null && result != DBNull.Value
                ? Convert.ToInt32(result)
                : 0;

            var updated = rowsAffected > 0;

            if (updated)
            {
                _logger.LogInformation("UpdateAsync succeeded for CustomerId={CustomerId}.", customer.CustomerId);
            }
            else
            {
                _logger.LogWarning("UpdateAsync affected 0 rows for CustomerId={CustomerId}.", customer.CustomerId);
            }

            return updated;
        }
        catch (SqlException ex) when (ex.Number == 547)
        {
            _logger.LogWarning(
                ex,
                "UpdateAsync failed for CustomerId={CustomerId} because of FK or CHECK constraint.",
                customer.CustomerId);

            throw new UserValidationException("Failed to update customer because one or more referenced values are invalid.", ex);
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "UpdateAsync failed with SQL error for CustomerId={CustomerId}.", customer.CustomerId);
            throw new UserValidationException("Failed to update customer.", ex);
        }
    }

    public async Task<bool> DeactivateAsync(int customerId, int updatedByUserId)
    {
        _logger.LogInformation(
            "DeactivateAsync started for CustomerId={CustomerId}, UpdatedByUserId={UpdatedByUserId}.",
            customerId,
            updatedByUserId);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_DeactivateCustomer", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@CustomerId", customerId);
            command.Parameters.AddWithValue("@UpdatedByUserId", updatedByUserId);

            await connection.OpenAsync();

            var result = await command.ExecuteScalarAsync();
            var rowsAffected = result != null && result != DBNull.Value
                ? Convert.ToInt32(result)
                : 0;

            var deactivated = rowsAffected > 0;

            if (deactivated)
            {
                _logger.LogInformation("DeactivateAsync succeeded for CustomerId={CustomerId}.", customerId);
            }
            else
            {
                _logger.LogWarning("DeactivateAsync affected 0 rows for CustomerId={CustomerId}.", customerId);
            }

            return deactivated;
        }
        catch (SqlException ex) when (ex.Number == 547)
        {
            _logger.LogWarning(
                ex,
                "DeactivateAsync failed for CustomerId={CustomerId} because of FK constraint.",
                customerId);

            throw new UserValidationException("The customer cannot be deactivated because it is referenced by other records.", ex);
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "DeactivateAsync failed with SQL error for CustomerId={CustomerId}.", customerId);
            throw new UserValidationException("Failed to deactivate customer.", ex);
        }
    }

    private static Customer MapCustomer(SqlDataReader reader)
    {
        return new Customer
        {
            CustomerId = GetIntValue(reader, "CustomerId"),
            CustomerName = GetStringValue(reader, "CustomerName") ?? string.Empty,
            CustomerType = GetStringValue(reader, "CustomerType") ?? string.Empty,
            PrimaryPhone = GetStringValue(reader, "PrimaryPhone"),
            PrimaryEmail = GetStringValue(reader, "PrimaryEmail"),
            City = GetStringValue(reader, "City"),
            Region = GetStringValue(reader, "Region"),
            Address = GetStringValue(reader, "Address"),
            Status = GetStringValue(reader, "Status"),
            Notes = GetStringValue(reader, "Notes"),
            IsActive = GetBoolValue(reader, "IsActive"),
            CreatedAt = GetDateTimeValue(reader, "CreatedAt") ?? DateTime.MinValue,
            CreatedByUserId = GetIntValue(reader, "CreatedByUserId"),
            UpdatedAt = GetDateTimeValue(reader, "UpdatedAt"),
            UpdatedByUserId = GetNullableIntValue(reader, "UpdatedByUserId")
        };
    }

    private static bool HasColumn(SqlDataReader reader, string columnName)
    {
        for (int i = 0; i < reader.FieldCount; i++)
        {
            if (string.Equals(reader.GetName(i), columnName, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    private static string? GetStringValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return null;
        }

        return reader[columnName]?.ToString();
    }

    private static int GetIntValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return 0;
        }

        return Convert.ToInt32(reader[columnName]);
    }

    private static int? GetNullableIntValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return null;
        }

        return Convert.ToInt32(reader[columnName]);
    }

    private static bool GetBoolValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return false;
        }

        return Convert.ToBoolean(reader[columnName]);
    }

    private static DateTime? GetDateTimeValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return null;
        }

        return Convert.ToDateTime(reader[columnName]);
    }
}