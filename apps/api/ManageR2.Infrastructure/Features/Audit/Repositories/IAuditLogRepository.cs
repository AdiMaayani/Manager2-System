using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Interfaces;

// DB access for the core audit trail. Implementation uses dbo.sp_AuditLog_Create / dbo.sp_AuditLog_GetList
// stored procedures only (no inline SQL). There is no update/delete path: audit rows are append-only.
public interface IAuditLogRepository
{
    Task<long> CreateAsync(AuditLogEntry entry);

    Task<IReadOnlyList<AuditLogEntry>> GetListAsync(AuditLogQuery query);
}
