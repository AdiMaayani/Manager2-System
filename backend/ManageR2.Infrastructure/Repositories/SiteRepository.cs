using System.Data;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.DAL;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Repositories;

public class SiteRepository : ISiteRepository
{
    private readonly DBServices _dbServices;
    private readonly ILogger<SiteRepository> _logger;

    public SiteRepository(DBServices dbServices, ILogger<SiteRepository> logger)
    {
        _dbServices = dbServices;
        _logger = logger;
    }

    public async Task<IEnumerable<Site>> GetAllAsync()
    {
        _logger.LogInformation("GetAllAsync started for Sites.");

        var sites = new List<Site>();

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_GetSites", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                sites.Add(MapSite(reader));
            }

            _logger.LogInformation("GetAllAsync succeeded for Sites. Returned {Count} records.", sites.Count);

            return sites;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "GetAllAsync failed with SQL error for Sites.");
            throw new UserValidationException("Failed to retrieve sites from the database.", ex);
        }
    }

    public async Task<Site?> GetByIdAsync(int siteId)
    {
        _logger.LogInformation("GetByIdAsync started for SiteId={SiteId}.", siteId);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_GetSiteById", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@SiteId", siteId);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                var site = MapSite(reader);

                _logger.LogInformation("GetByIdAsync succeeded for SiteId={SiteId}.", siteId);

                return site;
            }

            _logger.LogWarning("GetByIdAsync returned no record for SiteId={SiteId}.", siteId);

            return null;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "GetByIdAsync failed with SQL error for SiteId={SiteId}.", siteId);
            throw new UserValidationException("Failed to retrieve the requested site.", ex);
        }
    }

    public async Task<int> CreateAsync(Site site)
    {
        _logger.LogInformation(
            "CreateAsync started for SiteName={SiteName}, CustomerId={CustomerId}.",
            site.SiteName,
            site.CustomerId);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_CreateSite", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@CustomerId", site.CustomerId);
            command.Parameters.AddWithValue("@SiteName", site.SiteName);
            command.Parameters.AddWithValue("@AddressLine", (object?)site.AddressLine ?? DBNull.Value);
            command.Parameters.AddWithValue("@City", (object?)site.City ?? DBNull.Value);
            command.Parameters.AddWithValue("@IsPrimary", site.IsPrimary);
            command.Parameters.AddWithValue("@Notes", (object?)site.Notes ?? DBNull.Value);

            await connection.OpenAsync();

            var result = await command.ExecuteScalarAsync();
            var newSiteId = result != null && result != DBNull.Value
                ? Convert.ToInt32(result)
                : 0;

            _logger.LogInformation("CreateAsync succeeded. Created SiteId={SiteId}.", newSiteId);

            return newSiteId;
        }
        catch (SqlException ex) when (ex.Number == 547)
        {
            _logger.LogWarning(
                ex,
                "CreateAsync failed for SiteName={SiteName} because of FK or CHECK constraint.",
                site.SiteName);

            throw new UserValidationException("Failed to create site because one or more referenced values are invalid.", ex);
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "CreateAsync failed with SQL error for SiteName={SiteName}.", site.SiteName);
            throw new UserValidationException("Failed to create site.", ex);
        }
    }

    public async Task<bool> UpdateAsync(Site site)
    {
        _logger.LogInformation(
            "UpdateAsync started for SiteId={SiteId}, SiteName={SiteName}.",
            site.SiteId,
            site.SiteName);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_UpdateSite", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@SiteId", site.SiteId);
            command.Parameters.AddWithValue("@CustomerId", site.CustomerId);
            command.Parameters.AddWithValue("@SiteName", site.SiteName);
            command.Parameters.AddWithValue("@AddressLine", (object?)site.AddressLine ?? DBNull.Value);
            command.Parameters.AddWithValue("@City", (object?)site.City ?? DBNull.Value);
            command.Parameters.AddWithValue("@IsPrimary", site.IsPrimary);
            command.Parameters.AddWithValue("@Notes", (object?)site.Notes ?? DBNull.Value);

            await connection.OpenAsync();

            var result = await command.ExecuteScalarAsync();
            var rowsAffected = result != null && result != DBNull.Value
                ? Convert.ToInt32(result)
                : 0;

            var updated = rowsAffected > 0;

            if (updated)
            {
                _logger.LogInformation("UpdateAsync succeeded for SiteId={SiteId}.", site.SiteId);
            }
            else
            {
                _logger.LogWarning("UpdateAsync affected 0 rows for SiteId={SiteId}.", site.SiteId);
            }

            return updated;
        }
        catch (SqlException ex) when (ex.Number == 547)
        {
            _logger.LogWarning(
                ex,
                "UpdateAsync failed for SiteId={SiteId} because of FK or CHECK constraint.",
                site.SiteId);

            throw new UserValidationException("Failed to update site because one or more referenced values are invalid.", ex);
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "UpdateAsync failed with SQL error for SiteId={SiteId}.", site.SiteId);
            throw new UserValidationException("Failed to update site.", ex);
        }
    }

    private static Site MapSite(SqlDataReader reader)
    {
        return new Site
        {
            SiteId = GetIntValue(reader, "SiteId"),
            CustomerId = GetIntValue(reader, "CustomerId"),
            SiteName = GetStringValue(reader, "SiteName") ?? string.Empty,
            AddressLine = GetStringValue(reader, "AddressLine"),
            City = GetStringValue(reader, "City"),
            IsPrimary = GetBoolValue(reader, "IsPrimary"),
            Notes = GetStringValue(reader, "Notes"),
            CreatedAt = GetDateTimeValue(reader, "CreatedAt") ?? DateTime.MinValue,
            UpdatedAt = GetDateTimeValue(reader, "UpdatedAt")
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