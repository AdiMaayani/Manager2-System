using ManageR2.Domain.Entities;
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
        Task<int> CreateMilestoneAsync(WorkItem workItem);

        // Get-or-create the reserved internal/office work context (customer, site, container project).
        Task<InternalWorkContext> GetInternalWorkContextAsync();

        Task<bool> UpdateAsync(int id, WorkItem workItem);
        Task<bool> UpdateMilestoneAsync(int milestoneId, WorkItem workItem);

        Task<bool> CloseAsync(int id);
        Task<bool> SoftDeleteMilestoneAsync(int milestoneId);

        Task<bool> AssignEmployeeToWorkAsync(int workItemId, int employeeId, string assignmentRole);
        Task<bool> AssignContractorToWorkAsync(int workItemId, int contractorId, string assignmentRole);
        Task<bool> SyncEmployeeAssignmentsByWorkItemIdAsync(int workItemId, IReadOnlyCollection<(int EmployeeId, string AssignmentRole)> assignments);

        Task<bool> DeleteEmployeeAssignmentsByWorkItemIdAsync(int workItemId);
        Task<bool> DeleteContractorAssignmentsByWorkItemIdAsync(int workItemId);

        Task<List<ProjectListItemResult>> GetProjectsListAsync();

        // Work plan queries combine project + tasks + assignments.
        Task<WorkPlanResult?> GetWorkPlanAsync(int projectId);
        Task<List<WorkPlanResult>> GetAllWorkPlansAsync();

        // Milestone tree with embedded participants for project drill-down endpoints.
        Task<List<ProjectMilestoneResult>> GetProjectMilestonesAsync(int projectId);

    }
}