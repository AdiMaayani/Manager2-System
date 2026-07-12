using System.Data.Common;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.DAL.Providers;
using ManageR2.Infrastructure.Repositories;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace ManageR2.Infrastructure.Features.Sites.Repositories;

// PostgreSQL implementation of the site contract (migration target). Reproduces sp_GetSites /
// sp_GetSiteById / sp_CreateSite / sp_UpdateSite / sp_DeactivateSite against the translated "Sites"
// table. Notable fidelity points preserved from the SQL Server procedures:
//   - reads and writes filter on IsActive = true (soft-delete model);
//   - CreatedAt uses server local time (SYSDATETIME) while UpdatedAt/DeletedAt use UTC (SYSUTCDATETIME);
//   - string columns are stored as-is (no trim/NULLIF, unlike customers/contacts);
//   - Deactivate is blocked when open work items reference the site, mirroring THROW 51010.
public sealed class PostgresSiteRepository : ISiteRepository
{
    private readonly PostgresConnectionFactory _connectionFactory;
    private readonly ILogger<PostgresSiteRepository> _logger;

    public PostgresSiteRepository(
        PostgresConnectionFactory connectionFactory,
        ILogger<PostgresSiteRepository> logger)
    {
        _connectionFactory = connectionFactory;
        _logger = logger;
    }

    private const string SiteColumns =
        """
        "SiteId", "CustomerId", "SiteName", "AddressLine", "City", "IsPrimary",
        "Notes", "CreatedAt", "UpdatedAt"
        """;

    public async Task<IEnumerable<Site>> GetAllAsync()
    {
        var sites = new List<Site>();
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText = $"""
                SELECT {SiteColumns}
                FROM "Sites"
                WHERE "IsActive" = true
                ORDER BY "SiteId" DESC
                """;

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                sites.Add(MapSite(reader));
            }

            return sites;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres GetAllAsync failed for Sites.");
            throw new UserValidationException("Failed to retrieve sites from the database.", ex);
        }
    }

    public async Task<Site?> GetByIdAsync(int siteId)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText = $"""
                SELECT {SiteColumns}
                FROM "Sites"
                WHERE "SiteId" = @SiteId
                  AND "IsActive" = true
                """;
            AddParameter(command, "@SiteId", siteId);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();
            return await reader.ReadAsync() ? MapSite(reader) : null;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres GetByIdAsync failed for SiteId={SiteId}.", siteId);
            throw new UserValidationException("Failed to retrieve the requested site.", ex);
        }
    }

    public async Task<int> CreateAsync(Site site)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                INSERT INTO "Sites"
                    ("CustomerId", "SiteName", "AddressLine", "City", "IsPrimary", "Notes", "CreatedAt")
                VALUES
                    (@CustomerId::int, @SiteName::text, @AddressLine::text, @City::text,
                     @IsPrimary::boolean, @Notes::text, localtimestamp)
                RETURNING "SiteId"
                """;

            AddParameter(command, "@CustomerId", site.CustomerId);
            AddParameter(command, "@SiteName", site.SiteName);
            AddParameter(command, "@AddressLine", (object?)site.AddressLine ?? DBNull.Value);
            AddParameter(command, "@City", (object?)site.City ?? DBNull.Value);
            AddParameter(command, "@IsPrimary", site.IsPrimary);
            AddParameter(command, "@Notes", (object?)site.Notes ?? DBNull.Value);

            await connection.OpenAsync();
            var result = await command.ExecuteScalarAsync();
            return result is null or DBNull ? 0 : Convert.ToInt32(result);
        }
        catch (PostgresException ex) when (ex.SqlState is "23503" or "23514")
        {
            _logger.LogWarning(ex, "Postgres CreateAsync failed for SiteName={SiteName} (FK/CHECK).", site.SiteName);
            throw new UserValidationException("Failed to create site because one or more referenced values are invalid.", ex);
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres CreateAsync failed for SiteName={SiteName}.", site.SiteName);
            throw new UserValidationException("Failed to create site.", ex);
        }
    }

    public async Task<bool> UpdateAsync(Site site)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                UPDATE "Sites" SET
                    "CustomerId"  = @CustomerId::int,
                    "SiteName"    = @SiteName::text,
                    "AddressLine" = @AddressLine::text,
                    "City"        = @City::text,
                    "IsPrimary"   = @IsPrimary::boolean,
                    "Notes"       = @Notes::text,
                    "UpdatedAt"   = (now() at time zone 'utc')
                WHERE "SiteId" = @SiteId::int
                  AND "IsActive" = true
                """;

            AddParameter(command, "@SiteId", site.SiteId);
            AddParameter(command, "@CustomerId", site.CustomerId);
            AddParameter(command, "@SiteName", site.SiteName);
            AddParameter(command, "@AddressLine", (object?)site.AddressLine ?? DBNull.Value);
            AddParameter(command, "@City", (object?)site.City ?? DBNull.Value);
            AddParameter(command, "@IsPrimary", site.IsPrimary);
            AddParameter(command, "@Notes", (object?)site.Notes ?? DBNull.Value);

            await connection.OpenAsync();
            var rowsAffected = await command.ExecuteNonQueryAsync();
            return rowsAffected > 0;
        }
        catch (PostgresException ex) when (ex.SqlState is "23503" or "23514")
        {
            _logger.LogWarning(ex, "Postgres UpdateAsync failed for SiteId={SiteId} (FK/CHECK).", site.SiteId);
            throw new UserValidationException("Failed to update site because one or more referenced values are invalid.", ex);
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres UpdateAsync failed for SiteId={SiteId}.", site.SiteId);
            throw new UserValidationException("Failed to update site.", ex);
        }
    }

    public async Task<bool> DeactivateAsync(int siteId)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await connection.OpenAsync();

            if (await HasOpenWorkItemsAsync(connection, siteId))
            {
                // Mirrors THROW 51010 in sp_DeactivateSite, which the SQL Server repository surfaces
                // to the API as the generic "Failed to deactivate site." message.
                _logger.LogWarning(
                    "Postgres DeactivateAsync blocked for SiteId={SiteId}: site is referenced by open work items.",
                    siteId);
                throw new UserValidationException("Failed to deactivate site.");
            }

            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                UPDATE "Sites" SET
                    "IsActive"  = false,
                    "UpdatedAt" = (now() at time zone 'utc'),
                    "DeletedAt" = (now() at time zone 'utc')
                WHERE "SiteId" = @SiteId::int
                  AND "IsActive" = true
                """;
            AddParameter(command, "@SiteId", siteId);

            var rowsAffected = await command.ExecuteNonQueryAsync();
            return rowsAffected > 0;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Postgres DeactivateAsync failed for SiteId={SiteId}.", siteId);
            throw new UserValidationException("Failed to deactivate site.", ex);
        }
    }

    private static async Task<bool> HasOpenWorkItemsAsync(DbConnection connection, int siteId)
    {
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT 1
            FROM "WorkItems"
            WHERE "SiteId" = @SiteId::int
              AND "ClosedAt" IS NULL
              AND "Status" NOT IN ('Closed', 'Cancelled', 'Done')
            LIMIT 1
            """;
        AddParameter(command, "@SiteId", siteId);

        var result = await command.ExecuteScalarAsync();
        return result is not null && result != DBNull.Value;
    }

    private static void AddParameter(DbCommand command, string name, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }

    private static Site MapSite(DbDataReader reader)
    {
        return new Site
        {
            SiteId = GetInt(reader, "SiteId"),
            CustomerId = GetInt(reader, "CustomerId"),
            SiteName = GetString(reader, "SiteName") ?? string.Empty,
            AddressLine = GetString(reader, "AddressLine"),
            City = GetString(reader, "City"),
            IsPrimary = GetBool(reader, "IsPrimary"),
            Notes = GetString(reader, "Notes"),
            CreatedAt = GetDateTime(reader, "CreatedAt") ?? DateTime.MinValue,
            UpdatedAt = GetDateTime(reader, "UpdatedAt")
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
