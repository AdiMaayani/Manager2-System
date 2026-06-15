namespace ManageR2.Domain.Entities;

// Input shape for recording an audit event. Built at the API boundary (which knows the acting user,
// client IP, and user agent) and handed to IAuditLogService, which sanitizes and persists it.
//
// IMPORTANT: callers must never place secret values, passwords, JWTs, or raw connection strings into
// Metadata. Use field names / identifiers / counts only.
public class AuditEvent
{
    public required string Action { get; init; }

    public required string EntityType { get; init; }

    public int? EntityId { get; init; }

    public string Severity { get; init; } = AuditSeverity.Info;

    public required string Summary { get; init; }

    // Optional non-sensitive context, serialized to JSON by the service.
    public IReadOnlyDictionary<string, object?>? Metadata { get; init; }

    public int? UserId { get; init; }

    public string? ClientIp { get; init; }

    public string? UserAgent { get; init; }
}
