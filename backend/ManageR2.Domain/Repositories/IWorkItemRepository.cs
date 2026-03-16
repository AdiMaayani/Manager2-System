using ManageR2.Domain.Entities;

namespace ManageR2.Domain.Repositories;

public interface IWorkItemRepository
{
    Task<List<WorkItem>> GetWorkItemsAsync();
}