using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Services;

// Business entry point for the core audit trail.
//
// LogAsync is best-effort by contract: it sanitizes and persists the event and NEVER throws, so a
// failing audit write can never break the business action that triggered it. Callers that must block
// on a successful audit (e.g. secret reveal) keep using their own dedicated, throwing log in addition
// to this general trail.
public interface IAuditLogService
{
    Task LogAsync(AuditEvent auditEvent);

    Task<IReadOnlyList<AuditLogEntry>> GetListAsync(AuditLogQuery query);
}
