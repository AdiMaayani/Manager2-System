using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Repositories;

public interface IProjectBoqRepository
{
    Task<IReadOnlyList<ProjectBoqItemModel>> GetByProjectIdAsync(int projectId);

    Task<int> CreateAsync(ProjectBoqItemModel boqItem);

    Task<bool> UpdateAsync(ProjectBoqItemModel boqItem);

    Task<bool> DeleteAsync(int projectId, int projectBoqItemId);

    Task<bool> ReorderAsync(int projectId, IReadOnlyList<ProjectBoqSortOrderModel> sortOrders);
}
