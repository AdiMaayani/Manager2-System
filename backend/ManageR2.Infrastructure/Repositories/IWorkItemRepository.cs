using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Repositories
{
    // Repository contract for work item lifecycle, work plan, milestones, and assignment operations.
    public interface IWorkItemRepository
    {
        // Basic work item queries.
        Task<List<WorkItem>> GetAllAsync();
        Task<WorkItem?> GetByIdAsync(int id);
        Task<List<WorkItem>> GetByTypeAsync(string workType);
        Task<List<WorkItem>> GetTasksByParentIdAsync(int parentWorkItemId);
        Task<int> CreateAsync(WorkItem workItem);
        Task<int> CreateMilestoneAsync(WorkItem workItem);

        Task<bool> UpdateAsync(int id, WorkItem workItem);
        Task<bool> UpdateMilestoneAsync(int milestoneId, WorkItem workItem);

        Task<bool> CloseAsync(int id);
        Task<bool> SoftDeleteMilestoneAsync(int milestoneId);

        Task<bool> AssignEmployeeToWorkAsync(int workItemId, int employeeId, string assignmentRole);
        Task<bool> AssignContractorToWorkAsync(int workItemId, int contractorId, string assignmentRole);

        Task<bool> DeleteEmployeeAssignmentsByWorkItemIdAsync(int workItemId);
        Task<bool> DeleteContractorAssignmentsByWorkItemIdAsync(int workItemId);

        Task<bool> EmployeeExistsAsync(int employeeId);
        Task<bool> ContractorExistsAsync(int contractorId);

        Task<List<ProjectListItemResult>> GetProjectsListAsync();

        // Work plan queries combine project + tasks + assignments.
        Task<WorkPlanResult?> GetWorkPlanAsync(int projectId);
        Task<List<WorkPlanResult>> GetAllWorkPlansAsync();

        Task<List<ProjectMilestoneResult>> GetProjectMilestonesAsync(int projectId);

    }
}