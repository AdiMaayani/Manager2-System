using System.Data.Common;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.DAL.Providers;
using ManageR2.Infrastructure.Interfaces;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace ManageR2.Infrastructure.Features.Contacts.Repositories;

// PostgreSQL implementation of the contact contract (migration target). Reproduces sp_GetContacts /
// sp_GetContactById / sp_GetContactsByCustomerId / sp_CreateContact / sp_UpdateContact /
// sp_DeactivateContact as parameterized SQL against the translated "Contacts" table, preserving the
// trim/NULLIF rules, UTC stamping, DESC ordering, and FK/CHECK error semantics.
public sealed class PostgresContactRepository : IContactRepository
{
    private readonly PostgresConnectionFactory _connectionFactory;
    private readonly ILogger<PostgresContactRepository> _logger;

    public PostgresContactRepository(
        PostgresConnectionFactory connectionFactory,
        ILogger<PostgresContactRepository> logger)
    {
        _connectionFactory = connectionFactory;
        _logger = logger;
    }

    private const string ContactColumns =
        """
        "ContactId", "FullName", "JobTitle", "ContactCategory", "CustomerId", "CompanyName",
        "Phone", "SecondaryPhone", "Email", "PreferredChannel", "City", "Address", "Status",
        "Notes", "IsActive", "CreatedAt", "CreatedByUserId", "UpdatedAt", "UpdatedByUserId"
        """;

    public async Task<IEnumerable<Contact>> GetAllAsync()
    {
        var contacts = new List<Contact>();
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText = $"""
                SELECT {ContactColumns}
                FROM "Contacts"
                ORDER BY "ContactId" DESC
                """;

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                contacts.Add(MapContact(reader));
            }

            return contacts;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres GetAllAsync failed for Contacts.");
            throw new UserValidationException("Failed to retrieve contacts from the database.", ex);
        }
    }

    public async Task<Contact?> GetByIdAsync(int contactId)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText = $"""
                SELECT {ContactColumns}
                FROM "Contacts"
                WHERE "ContactId" = @ContactId
                """;
            AddParameter(command, "@ContactId", contactId);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();
            return await reader.ReadAsync() ? MapContact(reader) : null;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres GetByIdAsync failed for ContactId={ContactId}.", contactId);
            throw new UserValidationException("Failed to retrieve the requested contact.", ex);
        }
    }

    public async Task<IEnumerable<Contact>> GetByCustomerIdAsync(int customerId)
    {
        var contacts = new List<Contact>();
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText = $"""
                SELECT {ContactColumns}
                FROM "Contacts"
                WHERE "CustomerId" = @CustomerId
                ORDER BY "ContactId" DESC
                """;
            AddParameter(command, "@CustomerId", customerId);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                contacts.Add(MapContact(reader));
            }

            return contacts;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres GetByCustomerIdAsync failed for CustomerId={CustomerId}.", customerId);
            throw new UserValidationException("Failed to retrieve contacts for the requested customer.", ex);
        }
    }

    public async Task<int> CreateAsync(Contact contact)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                INSERT INTO "Contacts"
                    ("FullName", "JobTitle", "ContactCategory", "CustomerId", "CompanyName", "Phone",
                     "SecondaryPhone", "Email", "PreferredChannel", "City", "Address", "Status",
                     "Notes", "IsActive", "CreatedAt", "CreatedByUserId", "UpdatedAt", "UpdatedByUserId")
                VALUES
                    (btrim(@FullName::text), NULLIF(btrim(@JobTitle::text), ''), btrim(@ContactCategory::text),
                     @CustomerId::int, NULLIF(btrim(@CompanyName::text), ''), NULLIF(btrim(@Phone::text), ''),
                     NULLIF(btrim(@SecondaryPhone::text), ''), NULLIF(btrim(@Email::text), ''),
                     NULLIF(btrim(@PreferredChannel::text), ''), NULLIF(btrim(@City::text), ''),
                     NULLIF(btrim(@Address::text), ''), NULLIF(btrim(@Status::text), ''),
                     NULLIF(btrim(@Notes::text), ''), @IsActive::boolean, (now() at time zone 'utc'),
                     @CreatedByUserId::int, NULL, NULL)
                RETURNING "ContactId"
                """;

            AddParameter(command, "@FullName", contact.FullName);
            AddParameter(command, "@JobTitle", (object?)contact.JobTitle ?? DBNull.Value);
            AddParameter(command, "@ContactCategory", contact.ContactCategory);
            AddParameter(command, "@CustomerId", (object?)contact.CustomerId ?? DBNull.Value);
            AddParameter(command, "@CompanyName", (object?)contact.CompanyName ?? DBNull.Value);
            AddParameter(command, "@Phone", (object?)contact.Phone ?? DBNull.Value);
            AddParameter(command, "@SecondaryPhone", (object?)contact.SecondaryPhone ?? DBNull.Value);
            AddParameter(command, "@Email", (object?)contact.Email ?? DBNull.Value);
            AddParameter(command, "@PreferredChannel", (object?)contact.PreferredChannel ?? DBNull.Value);
            AddParameter(command, "@City", (object?)contact.City ?? DBNull.Value);
            AddParameter(command, "@Address", (object?)contact.Address ?? DBNull.Value);
            AddParameter(command, "@Status", (object?)contact.Status ?? DBNull.Value);
            AddParameter(command, "@Notes", (object?)contact.Notes ?? DBNull.Value);
            AddParameter(command, "@IsActive", contact.IsActive);
            AddParameter(command, "@CreatedByUserId", contact.CreatedByUserId);

            await connection.OpenAsync();
            var result = await command.ExecuteScalarAsync();
            return result is null or DBNull ? 0 : Convert.ToInt32(result);
        }
        catch (PostgresException ex) when (ex.SqlState is "23503" or "23514")
        {
            _logger.LogWarning(ex, "Postgres CreateAsync failed for FullName={FullName} (FK/CHECK).", contact.FullName);
            throw new UserValidationException("Failed to create contact because one or more referenced values are invalid.", ex);
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres CreateAsync failed for FullName={FullName}.", contact.FullName);
            throw new UserValidationException("Failed to create contact.", ex);
        }
    }

    public async Task<bool> UpdateAsync(Contact contact)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                UPDATE "Contacts" SET
                    "FullName"         = btrim(@FullName::text),
                    "JobTitle"         = NULLIF(btrim(@JobTitle::text), ''),
                    "ContactCategory"  = btrim(@ContactCategory::text),
                    "CustomerId"       = @CustomerId::int,
                    "CompanyName"      = NULLIF(btrim(@CompanyName::text), ''),
                    "Phone"            = NULLIF(btrim(@Phone::text), ''),
                    "SecondaryPhone"   = NULLIF(btrim(@SecondaryPhone::text), ''),
                    "Email"            = NULLIF(btrim(@Email::text), ''),
                    "PreferredChannel" = NULLIF(btrim(@PreferredChannel::text), ''),
                    "City"             = NULLIF(btrim(@City::text), ''),
                    "Address"          = NULLIF(btrim(@Address::text), ''),
                    "Status"           = NULLIF(btrim(@Status::text), ''),
                    "Notes"            = NULLIF(btrim(@Notes::text), ''),
                    "IsActive"         = @IsActive::boolean,
                    "UpdatedAt"        = (now() at time zone 'utc'),
                    "UpdatedByUserId"  = @UpdatedByUserId::int
                WHERE "ContactId" = @ContactId::int
                """;

            AddParameter(command, "@ContactId", contact.ContactId);
            AddParameter(command, "@FullName", contact.FullName);
            AddParameter(command, "@JobTitle", (object?)contact.JobTitle ?? DBNull.Value);
            AddParameter(command, "@ContactCategory", contact.ContactCategory);
            AddParameter(command, "@CustomerId", (object?)contact.CustomerId ?? DBNull.Value);
            AddParameter(command, "@CompanyName", (object?)contact.CompanyName ?? DBNull.Value);
            AddParameter(command, "@Phone", (object?)contact.Phone ?? DBNull.Value);
            AddParameter(command, "@SecondaryPhone", (object?)contact.SecondaryPhone ?? DBNull.Value);
            AddParameter(command, "@Email", (object?)contact.Email ?? DBNull.Value);
            AddParameter(command, "@PreferredChannel", (object?)contact.PreferredChannel ?? DBNull.Value);
            AddParameter(command, "@City", (object?)contact.City ?? DBNull.Value);
            AddParameter(command, "@Address", (object?)contact.Address ?? DBNull.Value);
            AddParameter(command, "@Status", (object?)contact.Status ?? DBNull.Value);
            AddParameter(command, "@Notes", (object?)contact.Notes ?? DBNull.Value);
            AddParameter(command, "@IsActive", contact.IsActive);
            AddParameter(command, "@UpdatedByUserId", (object?)contact.UpdatedByUserId ?? DBNull.Value);

            await connection.OpenAsync();
            var rowsAffected = await command.ExecuteNonQueryAsync();
            return rowsAffected > 0;
        }
        catch (PostgresException ex) when (ex.SqlState is "23503" or "23514")
        {
            _logger.LogWarning(ex, "Postgres UpdateAsync failed for ContactId={ContactId} (FK/CHECK).", contact.ContactId);
            throw new UserValidationException("Failed to update contact because one or more referenced values are invalid.", ex);
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres UpdateAsync failed for ContactId={ContactId}.", contact.ContactId);
            throw new UserValidationException("Failed to update contact.", ex);
        }
    }

    public async Task<bool> DeactivateAsync(int contactId, int updatedByUserId)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                UPDATE "Contacts" SET
                    "IsActive"        = false,
                    "UpdatedAt"       = (now() at time zone 'utc'),
                    "UpdatedByUserId" = @UpdatedByUserId::int
                WHERE "ContactId" = @ContactId::int
                  AND "IsActive" = true
                """;

            AddParameter(command, "@ContactId", contactId);
            AddParameter(command, "@UpdatedByUserId", updatedByUserId);

            await connection.OpenAsync();
            var rowsAffected = await command.ExecuteNonQueryAsync();
            return rowsAffected > 0;
        }
        catch (PostgresException ex) when (ex.SqlState is "23503")
        {
            _logger.LogWarning(ex, "Postgres DeactivateAsync failed for ContactId={ContactId} (FK).", contactId);
            throw new UserValidationException("The contact cannot be deactivated because it is referenced by other records.", ex);
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres DeactivateAsync failed for ContactId={ContactId}.", contactId);
            throw new UserValidationException("Failed to deactivate contact.", ex);
        }
    }

    private static void AddParameter(DbCommand command, string name, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }

    private static Contact MapContact(DbDataReader reader)
    {
        return new Contact
        {
            ContactId = GetInt(reader, "ContactId"),
            FullName = GetString(reader, "FullName") ?? string.Empty,
            JobTitle = GetString(reader, "JobTitle"),
            ContactCategory = GetString(reader, "ContactCategory") ?? string.Empty,
            CustomerId = GetNullableInt(reader, "CustomerId"),
            CompanyName = GetString(reader, "CompanyName"),
            Phone = GetString(reader, "Phone"),
            SecondaryPhone = GetString(reader, "SecondaryPhone"),
            Email = GetString(reader, "Email"),
            PreferredChannel = GetString(reader, "PreferredChannel"),
            City = GetString(reader, "City"),
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
