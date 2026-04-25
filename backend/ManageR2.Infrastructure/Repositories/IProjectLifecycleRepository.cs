using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Repositories;

public interface IProjectLifecycleRepository
{
    Task<ProjectLifecycleModel?> GetProjectLifecycleAsync(int projectId);
}
