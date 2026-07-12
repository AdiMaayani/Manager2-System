using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.DAL.Providers;
using ManageR2.Infrastructure.Features.WorkItems.Models;
using ManageR2.Infrastructure.Models;
using ManageR2.Infrastructure.Repositories;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Features.WorkItems.Repositories;

// Dual-run router for the WorkItems / work-plan / assignments domain (Wave 3). Reads are shadow-compared;
// writes are dual-written best-effort. With default flags the router delegates purely to SQL Server.
public sealed class WorkItemRepositoryRouter : IWorkItemRepository
{
    private readonly WorkItemRepository _sqlServer;
    private readonly PostgresWorkItemRepository _postgres;
    private readonly IProviderConnectionResolver _resolver;
    private readonly IProviderDriftRecorder _driftRecorder;
    private readonly IPayloadParityComparer _parityComparer;
    private readonly ILogger<WorkItemRepositoryRouter> _logger;

    public WorkItemRepositoryRouter(
        WorkItemRepository sqlServer,
        PostgresWorkItemRepository postgres,
        IProviderConnectionResolver resolver,
        IProviderDriftRecorder driftRecorder,
        IPayloadParityComparer parityComparer,
        ILogger<WorkItemRepositoryRouter> logger)
    {
        _sqlServer = sqlServer;
        _postgres = postgres;
        _resolver = resolver;
        _driftRecorder = driftRecorder;
        _parityComparer = parityComparer;
        _logger = logger;
    }

    private IWorkItemRepository Primary =>
        _resolver.Options.Primary == DatabaseProvider.Postgres ? _postgres : _sqlServer;

    public async Task<List<WorkItem>> GetAllAsync()
    {
        var result = await Primary.GetAllAsync();
        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("WorkItems.GetAll", result, () => _postgres.GetAllAsync());
        }

        return result;
    }

    public async Task<WorkItem?> GetByIdAsync(int id)
    {
        var result = await Primary.GetByIdAsync(id);
        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("WorkItems.GetById", result, () => _postgres.GetByIdAsync(id));
        }

        return result;
    }

    public async Task<List<WorkItem>> GetByTypeAsync(string workType)
    {
        var result = await Primary.GetByTypeAsync(workType);
        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("WorkItems.GetByType", result, () => _postgres.GetByTypeAsync(workType));
        }

        return result;
    }

    public async Task<List<WorkItem>> GetTasksByParentIdAsync(int parentWorkItemId)
    {
        var result = await Primary.GetTasksByParentIdAsync(parentWorkItemId);
        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("WorkItems.GetTasksByParentId", result,
                () => _postgres.GetTasksByParentIdAsync(parentWorkItemId));
        }

        return result;
    }

    public async Task<List<ProjectListItemResult>> GetProjectsListAsync()
    {
        var result = await Primary.GetProjectsListAsync();
        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("WorkItems.GetProjectsList", result, () => _postgres.GetProjectsListAsync());
        }

        return result;
    }

    public async Task<WorkPlanResult?> GetWorkPlanAsync(int projectId)
    {
        var result = await Primary.GetWorkPlanAsync(projectId);
        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("WorkItems.GetWorkPlan", result, () => _postgres.GetWorkPlanAsync(projectId));
        }

        return result;
    }

    public async Task<List<WorkPlanResult>> GetAllWorkPlansAsync()
    {
        var result = await Primary.GetAllWorkPlansAsync();
        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("WorkItems.GetAllWorkPlans", result, () => _postgres.GetAllWorkPlansAsync());
        }

        return result;
    }

    public async Task<WorkPlanScheduleResult> GetWorkPlanScheduleAsync(WorkPlanScheduleQuery query)
    {
        var result = await Primary.GetWorkPlanScheduleAsync(query);
        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("WorkItems.GetWorkPlanSchedule", result,
                () => _postgres.GetWorkPlanScheduleAsync(query));
        }

        return result;
    }

    public async Task<List<ProjectMilestoneResult>> GetProjectMilestonesAsync(int projectId)
    {
        var result = await Primary.GetProjectMilestonesAsync(projectId);
        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("WorkItems.GetProjectMilestones", result,
                () => _postgres.GetProjectMilestonesAsync(projectId));
        }

        return result;
    }

    public async Task<int> CreateAsync(WorkItem workItem)
    {
        var result = await Primary.CreateAsync(workItem);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("WorkItems.Create", () => _postgres.CreateAsync(workItem));
        }

        return result;
    }

    public async Task<bool> UpdateAsync(int id, WorkItem workItem)
    {
        var result = await Primary.UpdateAsync(id, workItem);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("WorkItems.Update", () => _postgres.UpdateAsync(id, workItem));
        }

        return result;
    }

    public async Task<bool> CloseAsync(int id)
    {
        var result = await Primary.CloseAsync(id);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("WorkItems.Close", () => _postgres.CloseAsync(id));
        }

        return result;
    }

    public async Task<DeleteWorkPlanTaskResult> DeleteWorkPlanTaskAsync(int workItemId)
    {
        var result = await Primary.DeleteWorkPlanTaskAsync(workItemId);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("WorkItems.DeleteWorkPlanTask", () => _postgres.DeleteWorkPlanTaskAsync(workItemId));
        }

        return result;
    }

    public async Task<bool> AssignEmployeeToWorkAsync(int workItemId, int employeeId, string assignmentRole)
    {
        var result = await Primary.AssignEmployeeToWorkAsync(workItemId, employeeId, assignmentRole);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("WorkItems.AssignEmployee",
                () => _postgres.AssignEmployeeToWorkAsync(workItemId, employeeId, assignmentRole));
        }

        return result;
    }

    public async Task<bool> AssignContractorToWorkAsync(int workItemId, int contractorId, string assignmentRole)
    {
        var result = await Primary.AssignContractorToWorkAsync(workItemId, contractorId, assignmentRole);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("WorkItems.AssignContractor",
                () => _postgres.AssignContractorToWorkAsync(workItemId, contractorId, assignmentRole));
        }

        return result;
    }

    public async Task<bool> SyncEmployeeAssignmentsByWorkItemIdAsync(
        int workItemId, IReadOnlyCollection<(int EmployeeId, string AssignmentRole)> assignments)
    {
        var result = await Primary.SyncEmployeeAssignmentsByWorkItemIdAsync(workItemId, assignments);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("WorkItems.SyncEmployeeAssignments",
                () => _postgres.SyncEmployeeAssignmentsByWorkItemIdAsync(workItemId, assignments));
        }

        return result;
    }

    public async Task<bool> DeleteEmployeeAssignmentsByWorkItemIdAsync(int workItemId)
    {
        var result = await Primary.DeleteEmployeeAssignmentsByWorkItemIdAsync(workItemId);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("WorkItems.DeleteEmployeeAssignments",
                () => _postgres.DeleteEmployeeAssignmentsByWorkItemIdAsync(workItemId));
        }

        return result;
    }

    public async Task<bool> DeleteContractorAssignmentsByWorkItemIdAsync(int workItemId)
    {
        var result = await Primary.DeleteContractorAssignmentsByWorkItemIdAsync(workItemId);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("WorkItems.DeleteContractorAssignments",
                () => _postgres.DeleteContractorAssignmentsByWorkItemIdAsync(workItemId));
        }

        return result;
    }

    private async Task ShadowCompareAsync<T>(string operation, T primaryResult, Func<Task<T>> shadowRead)
    {
        try
        {
            _driftRecorder.RecordShadowCompared(operation);
            var shadowResult = await shadowRead();
            var comparison = _parityComparer.Compare(primaryResult, shadowResult);
            if (!comparison.IsMatch)
            {
                _driftRecorder.RecordDriftDetected(operation, comparison.DiffSummary ?? "unspecified");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Shadow read failed for {Operation}.", operation);
        }
    }

    private async Task DualWriteAsync(string operation, Func<Task> dualWrite)
    {
        try
        {
            _driftRecorder.RecordDualWriteAttempted(operation);
            await dualWrite();
        }
        catch (Exception ex)
        {
            _driftRecorder.RecordDualWriteFailed(operation, ex);
        }
    }
}
