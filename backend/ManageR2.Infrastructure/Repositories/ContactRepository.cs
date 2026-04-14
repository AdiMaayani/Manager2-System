using System.Data;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.DAL;
using ManageR2.Infrastructure.Interfaces;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Repositories;

public class ContactRepository : IContactRepository
{
    private readonly DBServices _dbServices;
    private readonly ILogger<ContactRepository> _logger;

    public ContactRepository(DBServices dbServices, ILogger<ContactRepository> logger)
    {
        _dbServices = dbServices;
        _logger = logger;
    }

    public async Task<IEnumerable<Contact>> GetAllAsync()
    {
        _logger.LogInformation("GetAllAsync started for Contacts.");

        var contacts = new List<Contact>();

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_GetContacts", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                contacts.Add(MapContact(reader));
            }

            _logger.LogInformation("GetAllAsync succeeded for Contacts. Returned {Count} records.", contacts.Count);

            return contacts;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "GetAllAsync failed with SQL error for Contacts.");
            throw new UserValidationException("Failed to retrieve contacts from the database.", ex);
        }
    }

    public async Task<Contact?> GetByIdAsync(int contactId)
    {
        _logger.LogInformation("GetByIdAsync started for ContactId={ContactId}.", contactId);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_GetContactById", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@ContactId", contactId);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                var contact = MapContact(reader);

                _logger.LogInformation("GetByIdAsync succeeded for ContactId={ContactId}.", contactId);

                return contact;
            }

            _logger.LogWarning("GetByIdAsync returned no record for ContactId={ContactId}.", contactId);

            return null;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "GetByIdAsync failed with SQL error for ContactId={ContactId}.", contactId);
            throw new UserValidationException("Failed to retrieve the requested contact.", ex);
        }
    }

    public async Task<IEnumerable<Contact>> GetByCustomerIdAsync(int customerId)
    {
        _logger.LogInformation("GetByCustomerIdAsync started for CustomerId={CustomerId}.", customerId);

        var contacts = new List<Contact>();

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_GetContactsByCustomerId", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@CustomerId", customerId);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                contacts.Add(MapContact(reader));
            }

            _logger.LogInformation(
                "GetByCustomerIdAsync succeeded for CustomerId={CustomerId}. Returned {Count} records.",
                customerId,
                contacts.Count);

            return contacts;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "GetByCustomerIdAsync failed with SQL error for CustomerId={CustomerId}.", customerId);
            throw new UserValidationException("Failed to retrieve contacts for the requested customer.", ex);
        }
    }

    public async Task<int> CreateAsync(Contact contact)
    {
        _logger.LogInformation(
            "CreateAsync started for FullName={FullName}, ContactCategory={ContactCategory}.",
            contact.FullName,
            contact.ContactCategory);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_CreateContact", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@FullName", contact.FullName);
            command.Parameters.AddWithValue("@JobTitle", (object?)contact.JobTitle ?? DBNull.Value);
            command.Parameters.AddWithValue("@ContactCategory", contact.ContactCategory);
            command.Parameters.AddWithValue("@CustomerId", (object?)contact.CustomerId ?? DBNull.Value);
            command.Parameters.AddWithValue("@CompanyName", (object?)contact.CompanyName ?? DBNull.Value);
            command.Parameters.AddWithValue("@Phone", (object?)contact.Phone ?? DBNull.Value);
            command.Parameters.AddWithValue("@SecondaryPhone", (object?)contact.SecondaryPhone ?? DBNull.Value);
            command.Parameters.AddWithValue("@Email", (object?)contact.Email ?? DBNull.Value);
            command.Parameters.AddWithValue("@PreferredChannel", (object?)contact.PreferredChannel ?? DBNull.Value);
            command.Parameters.AddWithValue("@City", (object?)contact.City ?? DBNull.Value);
            command.Parameters.AddWithValue("@Address", (object?)contact.Address ?? DBNull.Value);
            command.Parameters.AddWithValue("@Status", (object?)contact.Status ?? DBNull.Value);
            command.Parameters.AddWithValue("@Notes", (object?)contact.Notes ?? DBNull.Value);
            command.Parameters.AddWithValue("@IsActive", contact.IsActive);
            command.Parameters.AddWithValue("@CreatedByUserId", contact.CreatedByUserId);

            await connection.OpenAsync();

            var result = await command.ExecuteScalarAsync();
            var newContactId = result != null && result != DBNull.Value
                ? Convert.ToInt32(result)
                : 0;

            _logger.LogInformation("CreateAsync succeeded. Created ContactId={ContactId}.", newContactId);

            return newContactId;
        }
        catch (SqlException ex) when (ex.Number == 547)
        {
            _logger.LogWarning(
                ex,
                "CreateAsync failed for FullName={FullName} because of FK or CHECK constraint.",
                contact.FullName);

            throw new UserValidationException("Failed to create contact because one or more referenced values are invalid.", ex);
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "CreateAsync failed with SQL error for FullName={FullName}.", contact.FullName);
            throw new UserValidationException("Failed to create contact.", ex);
        }
    }

    public async Task<bool> UpdateAsync(Contact contact)
    {
        _logger.LogInformation(
            "UpdateAsync started for ContactId={ContactId}, FullName={FullName}.",
            contact.ContactId,
            contact.FullName);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_UpdateContact", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@ContactId", contact.ContactId);
            command.Parameters.AddWithValue("@FullName", contact.FullName);
            command.Parameters.AddWithValue("@JobTitle", (object?)contact.JobTitle ?? DBNull.Value);
            command.Parameters.AddWithValue("@ContactCategory", contact.ContactCategory);
            command.Parameters.AddWithValue("@CustomerId", (object?)contact.CustomerId ?? DBNull.Value);
            command.Parameters.AddWithValue("@CompanyName", (object?)contact.CompanyName ?? DBNull.Value);
            command.Parameters.AddWithValue("@Phone", (object?)contact.Phone ?? DBNull.Value);
            command.Parameters.AddWithValue("@SecondaryPhone", (object?)contact.SecondaryPhone ?? DBNull.Value);
            command.Parameters.AddWithValue("@Email", (object?)contact.Email ?? DBNull.Value);
            command.Parameters.AddWithValue("@PreferredChannel", (object?)contact.PreferredChannel ?? DBNull.Value);
            command.Parameters.AddWithValue("@City", (object?)contact.City ?? DBNull.Value);
            command.Parameters.AddWithValue("@Address", (object?)contact.Address ?? DBNull.Value);
            command.Parameters.AddWithValue("@Status", (object?)contact.Status ?? DBNull.Value);
            command.Parameters.AddWithValue("@Notes", (object?)contact.Notes ?? DBNull.Value);
            command.Parameters.AddWithValue("@IsActive", contact.IsActive);
            command.Parameters.AddWithValue("@UpdatedByUserId", (object?)contact.UpdatedByUserId ?? DBNull.Value);

            await connection.OpenAsync();

            var result = await command.ExecuteScalarAsync();
            var rowsAffected = result != null && result != DBNull.Value
                ? Convert.ToInt32(result)
                : 0;

            var updated = rowsAffected > 0;

            if (updated)
            {
                _logger.LogInformation("UpdateAsync succeeded for ContactId={ContactId}.", contact.ContactId);
            }
            else
            {
                _logger.LogWarning("UpdateAsync affected 0 rows for ContactId={ContactId}.", contact.ContactId);
            }

            return updated;
        }
        catch (SqlException ex) when (ex.Number == 547)
        {
            _logger.LogWarning(
                ex,
                "UpdateAsync failed for ContactId={ContactId} because of FK or CHECK constraint.",
                contact.ContactId);

            throw new UserValidationException("Failed to update contact because one or more referenced values are invalid.", ex);
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "UpdateAsync failed with SQL error for ContactId={ContactId}.", contact.ContactId);
            throw new UserValidationException("Failed to update contact.", ex);
        }
    }

    public async Task<bool> DeactivateAsync(int contactId, int updatedByUserId)
    {
        _logger.LogInformation(
            "DeactivateAsync started for ContactId={ContactId}, UpdatedByUserId={UpdatedByUserId}.",
            contactId,
            updatedByUserId);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_DeactivateContact", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@ContactId", contactId);
            command.Parameters.AddWithValue("@UpdatedByUserId", updatedByUserId);

            await connection.OpenAsync();

            var result = await command.ExecuteScalarAsync();
            var rowsAffected = result != null && result != DBNull.Value
                ? Convert.ToInt32(result)
                : 0;

            var deactivated = rowsAffected > 0;

            if (deactivated)
            {
                _logger.LogInformation("DeactivateAsync succeeded for ContactId={ContactId}.", contactId);
            }
            else
            {
                _logger.LogWarning("DeactivateAsync affected 0 rows for ContactId={ContactId}.", contactId);
            }

            return deactivated;
        }
        catch (SqlException ex) when (ex.Number == 547)
        {
            _logger.LogWarning(
                ex,
                "DeactivateAsync failed for ContactId={ContactId} because of FK constraint.",
                contactId);

            throw new UserValidationException("The contact cannot be deactivated because it is referenced by other records.", ex);
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "DeactivateAsync failed with SQL error for ContactId={ContactId}.", contactId);
            throw new UserValidationException("Failed to deactivate contact.", ex);
        }
    }

    private static Contact MapContact(SqlDataReader reader)
    {
        return new Contact
        {
            ContactId = GetIntValue(reader, "ContactId"),
            FullName = GetStringValue(reader, "FullName") ?? string.Empty,
            JobTitle = GetStringValue(reader, "JobTitle"),
            ContactCategory = GetStringValue(reader, "ContactCategory") ?? string.Empty,
            CustomerId = GetNullableIntValue(reader, "CustomerId"),
            CompanyName = GetStringValue(reader, "CompanyName"),
            Phone = GetStringValue(reader, "Phone"),
            SecondaryPhone = GetStringValue(reader, "SecondaryPhone"),
            Email = GetStringValue(reader, "Email"),
            PreferredChannel = GetStringValue(reader, "PreferredChannel"),
            City = GetStringValue(reader, "City"),
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