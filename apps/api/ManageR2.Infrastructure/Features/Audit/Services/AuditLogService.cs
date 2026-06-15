using System.Text.Json;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Interfaces;
using ManageR2.Infrastructure.Models;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Services;

// Default audit trail service. Maps an AuditEvent into a persisted AuditLogEntry, serializing metadata
// to a compact JSON document. Writes are best-effort: any failure is logged to the server log and
// swallowed so the originating business action is never disrupted.
public class AuditLogService : IAuditLogService
{
    private static readonly JsonSerializerOptions MetadataJsonOptions = new()
    {
        // Keep the stored JSON small; metadata is non-sensitive context only.
        WriteIndented = false
    };

    // Defensive caps so a malformed caller can never exceed the column sizes defined in the migration.
    private const int MaxSummaryLength = 500;
    private const int MaxUserAgentLength = 512;
    private const int MaxClientIpLength = 64;

    private readonly IAuditLogRepository _auditLogRepository;
    private readonly ILogger<AuditLogService> _logger;

    public AuditLogService(IAuditLogRepository auditLogRepository, ILogger<AuditLogService> logger)
    {
        _auditLogRepository = auditLogRepository;
        _logger = logger;
    }

    public async Task LogAsync(AuditEvent auditEvent)
    {
        try
        {
            var entry = new AuditLogEntry
            {
                UserId = auditEvent.UserId,
                Action = auditEvent.Action,
                EntityType = auditEvent.EntityType,
                EntityId = auditEvent.EntityId,
                Severity = string.IsNullOrWhiteSpace(auditEvent.Severity) ? AuditSeverity.Info : auditEvent.Severity,
                Summary = Truncate(auditEvent.Summary, MaxSummaryLength) ?? string.Empty,
                MetadataJson = SerializeMetadata(auditEvent.Metadata),
                ClientIp = Truncate(auditEvent.ClientIp, MaxClientIpLength),
                UserAgent = Truncate(auditEvent.UserAgent, MaxUserAgentLength)
            };

            await _auditLogRepository.CreateAsync(entry);
        }
        catch (Exception ex)
        {
            // Never rethrow: auditing must not break the business operation it is observing.
            _logger.LogError(
                ex,
                "Failed to write audit log entry for Action={Action}, EntityType={EntityType}, EntityId={EntityId}.",
                auditEvent.Action,
                auditEvent.EntityType,
                auditEvent.EntityId);
        }
    }

    public Task<IReadOnlyList<AuditLogEntry>> GetListAsync(AuditLogQuery query)
    {
        return _auditLogRepository.GetListAsync(query);
    }

    private string? SerializeMetadata(IReadOnlyDictionary<string, object?>? metadata)
    {
        if (metadata == null || metadata.Count == 0)
        {
            return null;
        }

        try
        {
            return JsonSerializer.Serialize(metadata, MetadataJsonOptions);
        }
        catch (Exception ex)
        {
            // Bad metadata should degrade gracefully to a row without metadata, not lose the audit row.
            _logger.LogWarning(ex, "Failed to serialize audit metadata; storing entry without metadata.");
            return null;
        }
    }

    private static string? Truncate(string? value, int maxLength)
    {
        if (string.IsNullOrEmpty(value) || value.Length <= maxLength)
        {
            return value;
        }

        return value[..maxLength];
    }
}
