using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Features.WorkItems.Models;
using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Repositories
{
    // WorkItemsController depends on this; WorkItemRepository fulfills with stored procedures + WorkItem/plan models.
    // Repository contract for work item lifecycle, work plan, milestones, and assignment operations.
    public interface IWorkItemRepository
    {
        // Basic work item queries.
        Task<List<WorkItem>> GetAllAsync();
        Task<WorkItem?> GetByIdAsync(int id);
        Task<List<WorkItem>> GetByTypeAsync(string workType);
        Task<List<WorkItem>> GetTasksByParentIdAsync(int parentWorkItemId);
        Task<int> CreateAsync(WorkItem workItem);

        Task<bool> UpdateAsync(int id, WorkItem workItem);

        Task<bool> CloseAsync(int id);
        Task<DeleteWorkPlanTaskResult> DeleteWorkPlanTaskAsync(int workItemId);

        Task<bool> AssignEmployeeToWorkAsync(int workItemId, int employeeId, string assignmentRole);
        Task<bool> AssignContractorToWorkAsync(int workItemId, int contractorId, string assignmentRole);
        Task<bool> SyncEmployeeAssignmentsByWorkItemIdAsync(int workItemId, IReadOnlyCollection<(int EmployeeId, string AssignmentRole)> assignments);

        Task<bool> DeleteEmployeeAssignmentsByWorkItemIdAsync(int workItemId);
        Task<bool> DeleteContractorAssignmentsByWorkItemIdAsync(int workItemId);

        Task<List<ProjectListItemResult>> GetProjectsListAsync();

        // Legacy nested work plan (compatibility wrapper).
        Task<WorkPlanResult?> GetWorkPlanAsync(int projectId);
        Task<List<WorkPlanResult>> GetAllWorkPlansAsync();

        // Flat work plan schedule contract.
        Task<WorkPlanScheduleResult> GetWorkPlanScheduleAsync(WorkPlanScheduleQuery query);

        // Milestone list for legacy GET endpoint (reads ProjectMilestones table).
        Task<List<ProjectMilestoneResult>> GetProjectMilestonesAsync(int projectId);
    }
}