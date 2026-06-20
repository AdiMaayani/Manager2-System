using ManageR2.Domain.Entities;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Features.Audit;

// Helper for building an AuditEvent from the current HTTP request. Keeps controllers thin: they supply
// the meaningful fields (action/entity/summary/metadata) while the acting user, client IP, and user
// agent are captured here from HttpContext/claims.
public static class ControllerAuditExtensions
{
    public static AuditEvent BuildAuditEvent(
        this ControllerBase controller,
        string action,
        string entityType,
        string summary,
        int? entityId = null,
        string severity = AuditSeverity.Info,
        IReadOnlyDictionary<string, object?>? metadata = null,
        int? userIdOverride = null)
    {
        return new AuditEvent
        {
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            Severity = severity,
            Summary = summary,
            Metadata = metadata,
            UserId = userIdOverride ?? GetCurrentUserId(controller),
            ClientIp = controller.HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = GetUserAgent(controller)
        };
    }

    public static int? GetCurrentUserId(this ControllerBase controller)
    {
        var claim = controller.User.FindFirst("userId")?.Value;
        return int.TryParse(claim, out var userId) ? userId : null;
    }

    private static string? GetUserAgent(ControllerBase controller)
    {
        var userAgent = controller.Request.Headers.UserAgent.ToString();
        return string.IsNullOrWhiteSpace(userAgent) ? null : userAgent;
    }
}
