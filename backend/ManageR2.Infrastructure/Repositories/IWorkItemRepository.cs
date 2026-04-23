using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Repositories
{
    public interface IWorkItemRepository
    {
        Task<List<WorkItem>> GetAllAsync();
        Task<WorkItem?> GetByIdAsync(int id);
        Task<List<WorkItem>> GetByTypeAsync(string workType);
        Task<List<WorkItem>> GetTasksByParentIdAsync(int parentWorkItemId);
        Task<int> CreateAsync(WorkItem workItem);
        Task<bool> UpdateAsync(int id, WorkItem workItem);
        Task<bool> CloseAsync(int id);

        Task<bool> AssignEmployeeToWorkAsync(int workItemId, int employeeId, string assignmentRole);
        Task<bool> AssignContractorToWorkAsync(int workItemId, int contractorId, string assignmentRole);

        Task<bool> EmployeeExistsAsync(int employeeId);
        Task<bool> ContractorExistsAsync(int contractorId);

        Task<List<ProjectListItemResult>> GetProjectsListAsync();

        Task<WorkPlanResult?> GetWorkPlanAsync(int projectId);
        Task<List<WorkPlanResult>> GetAllWorkPlansAsync();

        Task<List<ProjectMilestoneResult>> GetProjectMilestonesAsync(int projectId);
    }
}