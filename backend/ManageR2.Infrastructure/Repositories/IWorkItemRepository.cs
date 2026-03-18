using ManageR2.Domain.Entities;

namespace ManageR2.Infrastructure.Repositories;

public interface IWorkItemRepository
{
    Task<List<WorkItem>> GetWorkItemsAsync();

    Task<List<WorkItem>> GetByTypeAsync(string workType);

    Task<bool> UpdateAsync(WorkItem workItem);

    Task<bool> CloseAsync(int workItemId);
}