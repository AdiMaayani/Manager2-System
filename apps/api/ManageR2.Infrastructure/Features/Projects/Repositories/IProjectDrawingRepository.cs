using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Repositories;

public interface IProjectDrawingRepository
{
    Task<IReadOnlyList<ProjectDrawingModel>> GetByProjectIdAsync(int projectId);

    Task<int> CreateAsync(ProjectDrawingModel drawing);

    Task<bool> UpdateAsync(ProjectDrawingModel drawing);

    Task<bool> DeleteAsync(int projectId, int projectDrawingId);
}
