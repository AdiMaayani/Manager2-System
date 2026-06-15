using System.Data;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.DAL;
using ManageR2.Infrastructure.Interfaces;
using ManageR2.Infrastructure.Models;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Repositories;

// Append-only audit trail persistence. ADO.NET + stored procedures only, no inline SQL.
public class AuditLogRepository : IAuditLogRepository
{
    private readonly DBServices _dbServices;
    private readonly ILogger<AuditLogRepository> _logger;

    public AuditLogRepository(DBServices dbServices, ILogger<AuditLogRepository> logger)
    {
        _dbServices = dbServices;
        _logger = logger;
    }

    public async Task<long> CreateAsync(AuditLogEntry entry)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_AuditLog_Create", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        command.Parameters.AddWithValue("@UserId", (object?)entry.UserId ?? DBNull.Value);
        command.Parameters.AddWithValue("@Action", entry.Action);
        command.Parameters.AddWithValue("@EntityType", entry.EntityType);
        command.Parameters.AddWithValue("@EntityId", (object?)entry.EntityId ?? DBNull.Value);
        command.Parameters.AddWithValue("@Severity", string.IsNullOrWhiteSpace(entry.Severity) ? AuditSeverity.Info : entry.Severity);
        command.Parameters.AddWithValue("@Summary", entry.Summary);
        command.Parameters.AddWithValue("@MetadataJson", (object?)entry.MetadataJson ?? DBNull.Value);
        command.Parameters.AddWithValue("@ClientIp", (object?)entry.ClientIp ?? DBNull.Value);
        command.Parameters.AddWithValue("@UserAgent", (object?)entry.UserAgent ?? DBNull.Value);

        await connection.OpenAsync();

        var result = await command.ExecuteScalarAsync();
        return result != null && result != DBNull.Value ? Convert.ToInt64(result) : 0;
    }

    public async Task<IReadOnlyList<AuditLogEntry>> GetListAsync(AuditLogQuery query)
    {
        var entries = new List<AuditLogEntry>();

        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_AuditLog_GetList", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        command.Parameters.AddWithValue("@FromUtc", (object?)query.FromUtc ?? DBNull.Value);
        command.Parameters.AddWithValue("@ToUtc", (object?)query.ToUtc ?? DBNull.Value);
        command.Parameters.AddWithValue("@Action", (object?)NullIfBlank(query.Action) ?? DBNull.Value);
        command.Parameters.AddWithValue("@EntityType", (object?)NullIfBlank(query.EntityType) ?? DBNull.Value);
        command.Parameters.AddWithValue("@Severity", (object?)NullIfBlank(query.Severity) ?? DBNull.Value);
        command.Parameters.AddWithValue("@UserId", (object?)query.UserId ?? DBNull.Value);
        command.Parameters.AddWithValue("@MaxRows", query.MaxRows);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            entries.Add(MapEntry(reader));
        }

        _logger.LogInformation("GetListAsync returned {Count} audit rows.", entries.Count);

        return entries;
    }

    private static string? NullIfBlank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static AuditLogEntry MapEntry(SqlDataReader reader)
    {
        return new AuditLogEntry
        {
            AuditLogId = GetInt64Value(reader, "AuditLogId"),
            OccurredAtUtc = GetDateTimeValue(reader, "OccurredAtUtc") ?? DateTime.MinValue,
            UserId = GetNullableIntValue(reader, "UserId"),
            UserName = GetStringValue(reader, "UserName"),
            Action = GetStringValue(reader, "Action") ?? string.Empty,
            EntityType = GetStringValue(reader, "EntityType") ?? string.Empty,
            EntityId = GetNullableIntValue(reader, "EntityId"),
            Severity = GetStringValue(reader, "Severity") ?? AuditSeverity.Info,
            Summary = GetStringValue(reader, "Summary") ?? string.Empty,
            MetadataJson = GetStringValue(reader, "MetadataJson"),
            ClientIp = GetStringValue(reader, "ClientIp"),
            UserAgent = GetStringValue(reader, "UserAgent")
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

    private static long GetInt64Value(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return 0;
        }

        return Convert.ToInt64(reader[columnName]);
    }

    private static int? GetNullableIntValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return null;
        }

        return Convert.ToInt32(reader[columnName]);
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
