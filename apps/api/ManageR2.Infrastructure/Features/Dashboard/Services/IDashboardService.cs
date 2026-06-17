using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Services;

// Builds the role-aware command-center payload for the authenticated caller. All permission filtering
// happens here (server-side) based on the roles in DashboardContext; the controller only maps the result.
public interface IDashboardService
{
    Task<DashboardModel> GetDashboardAsync(DashboardContext context);
}
