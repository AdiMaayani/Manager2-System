namespace ManageR2.Api.Features.Audit.DTOs;

// Read model returned by GET /api/audit. Mirrors a persisted audit row plus the resolved user name.
public class AuditLogResponseDto
{
    public long AuditLogId { get; set; }

    public DateTime OccurredAtUtc { get; set; }

    public int? UserId { get; set; }

    public string? UserName { get; set; }

    public string Action { get; set; } = string.Empty;

    public string EntityType { get; set; } = string.Empty;

    public int? EntityId { get; set; }

    public string Severity { get; set; } = string.Empty;

    public string Summary { get; set; } = string.Empty;

    public string? MetadataJson { get; set; }

    public string? ClientIp { get; set; }

    public string? UserAgent { get; set; }
}
