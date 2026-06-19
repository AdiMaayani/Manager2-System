using ManageR2.Domain.Entities;

namespace ManageR2.Infrastructure.Repositories;

public interface IProjectMilestoneRepository
{
    Task<List<ProjectMilestone>> GetByProjectIdAsync(int projectId);
    Task<int> CreateAsync(ProjectMilestone milestone);
    Task<bool> UpdateAsync(ProjectMilestone milestone);
    Task<bool> ReorderAsync(int projectId, IReadOnlyList<(int ProjectMilestoneId, int SortOrder)> items);
    Task<bool> DeactivateAsync(int projectId, int projectMilestoneId);
    Task<ProjectMilestone?> GetByIdAsync(int projectMilestoneId);
}
