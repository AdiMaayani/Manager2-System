using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Interfaces;

// Focused, read-only data access for the dashboard command center. Every method maps to exactly one
// dbo.sp_Dashboard_* stored procedure and returns small, capped result sets (no inline SQL, no writes).
public interface IDashboardRepository
{
    Task<IReadOnlyList<DashboardPersonalTaskRow>> GetPersonalTasksAsync(int employeeId);

    Task<IReadOnlyList<DashboardServiceCallRow>> GetServiceCallExceptionsAsync(int? employeeId, bool includeOrgWide);

    Task<IReadOnlyList<DashboardProjectAttentionRow>> GetProjectsNeedingAttentionAsync(int? managerEmployeeId, bool onlyManaged);

    Task<IReadOnlyList<DashboardQuoteFollowUpRow>> GetQuotesNeedingFollowUpAsync(int staleDays);

    Task<IReadOnlyList<DashboardCustomerContactGapRow>> GetCustomersMissingContactInfoAsync();

    Task<IReadOnlyList<DashboardDraftReportRow>> GetMyDraftReportsAsync(int employeeId);
}
