using System.Data;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.DAL;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Repositories;

// Company settings persistence; all database access is via stored procedures.
public class CompanySettingsRepository : ICompanySettingsRepository
{
    private readonly DBServices _dbServices;
    private readonly ILogger<CompanySettingsRepository> _logger;

    public CompanySettingsRepository(DBServices dbServices, ILogger<CompanySettingsRepository> logger)
    {
        _dbServices = dbServices;
        _logger = logger;
    }

    public async Task<CompanySettings?> GetCompanySettingsAsync()
    {
        _logger.LogInformation("GetCompanySettingsAsync started.");

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_Settings_GetCompanySettings", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                return MapCompanySettings(reader);
            }

            _logger.LogWarning("GetCompanySettingsAsync returned no settings row.");
            return null;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "GetCompanySettingsAsync failed with SQL error.");
            throw new UserValidationException("Failed to retrieve company settings.", ex);
        }
    }

    public async Task<CompanySettings> UpsertCompanySettingsAsync(CompanySettings companySettings)
    {
        _logger.LogInformation("UpsertCompanySettingsAsync started.");

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_Settings_UpsertCompanySettings", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@CompanyName", companySettings.CompanyName);
            command.Parameters.AddWithValue("@LegalName", (object?)companySettings.LegalName ?? DBNull.Value);
            command.Parameters.AddWithValue("@RegistrationNumber", (object?)companySettings.RegistrationNumber ?? DBNull.Value);
            command.Parameters.AddWithValue("@Email", (object?)companySettings.Email ?? DBNull.Value);
            command.Parameters.AddWithValue("@Phone", (object?)companySettings.Phone ?? DBNull.Value);
            command.Parameters.AddWithValue("@Address", (object?)companySettings.Address ?? DBNull.Value);
            command.Parameters.AddWithValue("@Website", (object?)companySettings.Website ?? DBNull.Value);
            command.Parameters.AddWithValue("@UpdatedByUserId", (object?)companySettings.UpdatedByUserId ?? DBNull.Value);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                return MapCompanySettings(reader);
            }

            throw new UserValidationException("Company settings were saved but could not be reloaded.");
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "UpsertCompanySettingsAsync failed with SQL error.");
            throw new UserValidationException("Failed to save company settings.", ex);
        }
    }

    private static CompanySettings MapCompanySettings(SqlDataReader reader)
    {
        return new CompanySettings
        {
            CompanyName = GetStringValue(reader, "CompanyName") ?? string.Empty,
            LegalName = GetStringValue(reader, "LegalName"),
            RegistrationNumber = GetStringValue(reader, "RegistrationNumber"),
            Email = GetStringValue(reader, "Email"),
            Phone = GetStringValue(reader, "Phone"),
            Address = GetStringValue(reader, "Address"),
            Website = GetStringValue(reader, "Website"),
            UpdatedAt = GetDateTimeValue(reader, "UpdatedAt") ?? DateTime.MinValue
        };
    }

    private static string? GetStringValue(SqlDataReader reader, string columnName)
    {
        return reader[columnName] == DBNull.Value ? null : reader[columnName]?.ToString();
    }

    private static DateTime? GetDateTimeValue(SqlDataReader reader, string columnName)
    {
        return reader[columnName] == DBNull.Value ? null : Convert.ToDateTime(reader[columnName]);
    }
}
