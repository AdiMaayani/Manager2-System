using System.Data;
using System.Data.Common;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.DAL.Providers;
using ManageR2.Infrastructure.Repositories;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Features.Settings.Repositories;

// PostgreSQL implementation of the company-settings contract (migration target). Per the
// service-refactor strategy this uses plain parameterized SQL against the translated "CompanySettings"
// table instead of a stored procedure. It is the Wave-1 reference for how a migrated repository is shaped.
public sealed class PostgresCompanySettingsRepository : ICompanySettingsRepository
{
    private const int SingleRowId = 1;

    private readonly PostgresConnectionFactory _connectionFactory;
    private readonly ILogger<PostgresCompanySettingsRepository> _logger;

    public PostgresCompanySettingsRepository(
        PostgresConnectionFactory connectionFactory,
        ILogger<PostgresCompanySettingsRepository> logger)
    {
        _connectionFactory = connectionFactory;
        _logger = logger;
    }

    public async Task<CompanySettings?> GetCompanySettingsAsync()
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT "CompanyName", "LegalName", "RegistrationNumber", "Email", "Phone",
                       "Address", "Website", "UpdatedAt"
                FROM "CompanySettings"
                WHERE "CompanySettingsId" = @CompanySettingsId
                """;
            AddParameter(command, "@CompanySettingsId", SingleRowId);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                return MapCompanySettings(reader);
            }

            return null;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres GetCompanySettingsAsync failed.");
            throw new UserValidationException("Failed to retrieve company settings.", ex);
        }
    }

    public async Task<CompanySettings> UpsertCompanySettingsAsync(CompanySettings companySettings)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                INSERT INTO "CompanySettings"
                    ("CompanySettingsId", "CompanyName", "LegalName", "RegistrationNumber", "Email",
                     "Phone", "Address", "Website", "UpdatedAt", "UpdatedByUserId")
                VALUES
                    (@CompanySettingsId, @CompanyName, @LegalName, @RegistrationNumber, @Email,
                     @Phone, @Address, @Website, (now() at time zone 'utc'), @UpdatedByUserId)
                ON CONFLICT ("CompanySettingsId") DO UPDATE SET
                    "CompanyName"        = EXCLUDED."CompanyName",
                    "LegalName"          = EXCLUDED."LegalName",
                    "RegistrationNumber" = EXCLUDED."RegistrationNumber",
                    "Email"              = EXCLUDED."Email",
                    "Phone"              = EXCLUDED."Phone",
                    "Address"            = EXCLUDED."Address",
                    "Website"            = EXCLUDED."Website",
                    "UpdatedAt"          = (now() at time zone 'utc'),
                    "UpdatedByUserId"    = EXCLUDED."UpdatedByUserId"
                RETURNING "CompanyName", "LegalName", "RegistrationNumber", "Email", "Phone",
                          "Address", "Website", "UpdatedAt"
                """;

            AddParameter(command, "@CompanySettingsId", SingleRowId);
            AddParameter(command, "@CompanyName", companySettings.CompanyName);
            AddParameter(command, "@LegalName", (object?)companySettings.LegalName ?? DBNull.Value);
            AddParameter(command, "@RegistrationNumber", (object?)companySettings.RegistrationNumber ?? DBNull.Value);
            AddParameter(command, "@Email", (object?)companySettings.Email ?? DBNull.Value);
            AddParameter(command, "@Phone", (object?)companySettings.Phone ?? DBNull.Value);
            AddParameter(command, "@Address", (object?)companySettings.Address ?? DBNull.Value);
            AddParameter(command, "@Website", (object?)companySettings.Website ?? DBNull.Value);
            AddParameter(command, "@UpdatedByUserId", (object?)companySettings.UpdatedByUserId ?? DBNull.Value);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                return MapCompanySettings(reader);
            }

            throw new UserValidationException("Company settings were saved but could not be reloaded.");
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres UpsertCompanySettingsAsync failed.");
            throw new UserValidationException("Failed to save company settings.", ex);
        }
    }

    private static void AddParameter(DbCommand command, string name, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }

    private static CompanySettings MapCompanySettings(DbDataReader reader)
    {
        return new CompanySettings
        {
            CompanyName = GetString(reader, "CompanyName") ?? string.Empty,
            LegalName = GetString(reader, "LegalName"),
            RegistrationNumber = GetString(reader, "RegistrationNumber"),
            Email = GetString(reader, "Email"),
            Phone = GetString(reader, "Phone"),
            Address = GetString(reader, "Address"),
            Website = GetString(reader, "Website"),
            UpdatedAt = GetDateTime(reader, "UpdatedAt") ?? DateTime.MinValue
        };
    }

    private static string? GetString(DbDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
    }

    private static DateTime? GetDateTime(DbDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? null : reader.GetDateTime(ordinal);
    }
}
