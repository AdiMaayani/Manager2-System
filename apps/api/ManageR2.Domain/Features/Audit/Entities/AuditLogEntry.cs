namespace ManageR2.Domain.Entities;

// A single persisted audit-trail row. Represents a high-value security or operational event.
// Never contains plaintext secrets, passwords, tokens, or raw connection strings.
public class AuditLogEntry
{
    public long AuditLogId { get; set; }

    public DateTime OccurredAtUtc { get; set; }

    // Acting user when known. Null for events with no authenticated actor (e.g. a login attempt
    // against an unknown e-mail). Stored without a foreign key so rows survive user deletion.
    public int? UserId { get; set; }

    // Read-only convenience for display, resolved via LEFT JOIN in sp_AuditLog_GetList.
    public string? UserName { get; set; }

    public string Action { get; set; } = string.Empty;

    public string EntityType { get; set; } = string.Empty;

    public int? EntityId { get; set; }

    public string Severity { get; set; } = AuditSeverity.Info;

    public string Summary { get; set; } = string.Empty;

    // Small sanitized JSON document with extra non-sensitive context (e.g. changed field names).
    public string? MetadataJson { get; set; }

    public string? ClientIp { get; set; }

    public string? UserAgent { get; set; }
}
