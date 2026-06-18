using ManageR2.Api.Authorization;
using ManageR2.Api.Features.Audit.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Models;
using ManageR2.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Features.Audit;

// Read-only access to the core audit trail. Restricted to roles that satisfy CanViewAuditLog
// (Admin, SeniorManagement). There is intentionally no create endpoint: audit rows are written only
// internally by IAuditLogService from the actions being audited.
[ApiController]
[Route("api/audit")]
[Authorize(Policy = Policies.CanViewAuditLog)]
public class AuditController : ControllerBase
{
    private readonly IAuditLogService _auditLogService;

    public AuditController(IAuditLogService auditLogService)
    {
        _auditLogService = auditLogService;
    }

    // GET /api/audit?fromUtc=&toUtc=&action=&entityType=&severity=&userId=&search=&maxRows=
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AuditLogResponseDto>>> GetList(
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] string? action,
        [FromQuery] string? entityType,
        [FromQuery] string? severity,
        [FromQuery] int? userId,
        [FromQuery] string? search,
        [FromQuery] int maxRows = 200)
    {
        var query = new AuditLogQuery
        {
            FromUtc = fromUtc,
            ToUtc = toUtc,
            Action = action,
            EntityType = entityType,
            Severity = severity,
            UserId = userId,
            Search = search,
            MaxRows = maxRows
        };

        var entries = await _auditLogService.GetListAsync(query);
        return Ok(entries.Select(ToResponseDto).ToList());
    }

    private static AuditLogResponseDto ToResponseDto(AuditLogEntry entry)
    {
        return new AuditLogResponseDto
        {
            AuditLogId = entry.AuditLogId,
            OccurredAtUtc = entry.OccurredAtUtc,
            UserId = entry.UserId,
            UserName = entry.UserName,
            Action = entry.Action,
            EntityType = entry.EntityType,
            EntityId = entry.EntityId,
            Severity = entry.Severity,
            Summary = entry.Summary,
            MetadataJson = entry.MetadataJson,
            ClientIp = entry.ClientIp,
            UserAgent = entry.UserAgent
        };
    }
}
