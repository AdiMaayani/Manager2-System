using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Repositories;

// Lifecycle aggregate for one project id (ProjectLifecycleRepository + sp_GetProjectLifecycle).
public interface IProjectLifecycleRepository
{
    Task<ProjectLifecycleModel?> GetProjectLifecycleAsync(int projectId);
}
