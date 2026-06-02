using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Repositories;

public interface IProjectEquipmentRepository
{
    Task<IReadOnlyList<ProjectEquipmentItemModel>> GetByProjectIdAsync(int projectId);

    Task<int> CreateAsync(ProjectEquipmentItemModel equipmentItem);

    Task<bool> UpdateAsync(ProjectEquipmentItemModel equipmentItem);

    Task<bool> DeleteAsync(int projectId, int projectEquipmentItemId);

    Task<bool> ReorderAsync(int projectId, IReadOnlyList<ProjectEquipmentSortOrderModel> sortOrders);
}
