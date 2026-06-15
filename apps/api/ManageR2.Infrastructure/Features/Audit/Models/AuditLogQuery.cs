namespace ManageR2.Infrastructure.Models;

// Optional filter set for reading audit rows via dbo.sp_AuditLog_GetList. All members are nullable so
// an empty query returns the most recent rows (capped by MaxRows).
public class AuditLogQuery
{
    public DateTime? FromUtc { get; set; }

    public DateTime? ToUtc { get; set; }

    public string? Action { get; set; }

    public string? EntityType { get; set; }

    public string? Severity { get; set; }

    public int? UserId { get; set; }

    public int MaxRows { get; set; } = 200;
}
