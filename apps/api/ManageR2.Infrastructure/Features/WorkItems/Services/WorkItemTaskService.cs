using ManageR2.Domain.Entities;
using ManageR2.Domain.Features.WorkItems;
using ManageR2.Infrastructure.Repositories;

namespace ManageR2.Infrastructure.Features.WorkItems.Services;

public sealed class WorkItemTaskValidationInput
{
    public string TaskCategory { get; set; } = string.Empty;
    public int? ParentWorkItemId { get; set; }
    public int? MilestoneId { get; set; }
    public int? CustomerId { get; set; }
    public int? SiteId { get; set; }
    public DateTime? PlannedStartUtc { get; set; }
    public DateTime? PlannedEndUtc { get; set; }
}

public interface IWorkItemTaskService
{
    string DeriveWorkType(string taskCategory);
    void ValidateCreateOrUpdate(WorkItemTaskValidationInput input, bool isServiceCallPath = false);
    WorkItem ApplyCanonicalFields(WorkItem workItem, WorkItemTaskValidationInput input);
}

public sealed class WorkItemTaskService : IWorkItemTaskService
{
    private readonly IWorkItemRepository _workItemRepository;
    private readonly IProjectMilestoneRepository _projectMilestoneRepository;

    public WorkItemTaskService(
        IWorkItemRepository workItemRepository,
        IProjectMilestoneRepository projectMilestoneRepository)
    {
        _workItemRepository = workItemRepository;
        _projectMilestoneRepository = projectMilestoneRepository;
    }

    public string DeriveWorkType(string taskCategory)
    {
        return taskCategory switch
        {
            WorkItemTaskCategories.Regular => WorkItemWorkTypes.Task,
            WorkItemTaskCategories.Project => WorkItemWorkTypes.Task,
            WorkItemTaskCategories.ServiceCall => WorkItemWorkTypes.ServiceCall,
            _ => throw new ArgumentException($"Invalid task category: {taskCategory}.")
        };
    }

    public void ValidateCreateOrUpdate(WorkItemTaskValidationInput input, bool isServiceCallPath = false)
    {
        var category = input.TaskCategory?.Trim() ?? string.Empty;

        if (isServiceCallPath)
        {
            if (!string.Equals(category, WorkItemTaskCategories.ServiceCall, StringComparison.Ordinal))
            {
                throw new ArgumentException("Service call creation must use TaskCategory ServiceCall.");
            }
        }
        else if (category is not (WorkItemTaskCategories.Regular or WorkItemTaskCategories.Project))
        {
            throw new ArgumentException("General work item endpoints may create only Regular or Project tasks.");
        }

        if (category == WorkItemTaskCategories.Regular)
        {
            if (input.ParentWorkItemId.HasValue)
            {
                throw new ArgumentException("Regular tasks cannot have a project parent.");
            }

            if (input.MilestoneId.HasValue)
            {
                throw new ArgumentException("Regular tasks cannot have a milestone.");
            }
        }

        if (category == WorkItemTaskCategories.Project)
        {
            if (!input.ParentWorkItemId.HasValue || input.ParentWorkItemId.Value <= 0)
            {
                throw new ArgumentException("Project tasks require an active project parent.");
            }

            ValidateActiveProjectParentAsync(input.ParentWorkItemId.Value).GetAwaiter().GetResult();
        }

        if (category == WorkItemTaskCategories.ServiceCall)
        {
            if (input.ParentWorkItemId.HasValue || input.MilestoneId.HasValue)
            {
                throw new ArgumentException("Service calls cannot have a project parent or milestone.");
            }
        }

        if (input.MilestoneId.HasValue)
        {
            if (!input.ParentWorkItemId.HasValue)
            {
                throw new ArgumentException("Milestone requires a project parent.");
            }

            ValidateMilestoneBelongsToProjectAsync(input.MilestoneId.Value, input.ParentWorkItemId.Value)
                .GetAwaiter()
                .GetResult();
        }

        if (input.PlannedStartUtc.HasValue || input.PlannedEndUtc.HasValue)
        {
            if (!input.PlannedStartUtc.HasValue || !input.PlannedEndUtc.HasValue)
            {
                throw new ArgumentException("Planned start and end must both be supplied or both be null.");
            }

            DurationCalculator.Calculate(input.PlannedStartUtc.Value, input.PlannedEndUtc.Value);
        }
    }

    public WorkItem ApplyCanonicalFields(WorkItem workItem, WorkItemTaskValidationInput input)
    {
        workItem.TaskCategory = input.TaskCategory;
        workItem.WorkType = DeriveWorkType(input.TaskCategory);
        workItem.ParentWorkItemId = input.TaskCategory == WorkItemTaskCategories.Project
            ? input.ParentWorkItemId
            : null;
        workItem.MilestoneId = input.TaskCategory == WorkItemTaskCategories.Project
            ? input.MilestoneId
            : null;
        workItem.CustomerId = input.CustomerId;
        workItem.SiteId = input.SiteId;
        workItem.PlannedStart = input.PlannedStartUtc;
        workItem.PlannedEnd = input.PlannedEndUtc;

        var duration = DurationCalculator.TryCalculate(input.PlannedStartUtc, input.PlannedEndUtc);
        workItem.EstimatedHours = duration?.EstimatedHours;

        return workItem;
    }

    private async Task ValidateActiveProjectParentAsync(int projectId)
    {
        var project = await _workItemRepository.GetByIdAsync(projectId);
        if (project == null ||
            project.IsArchived ||
            !string.Equals(project.WorkType, WorkItemWorkTypes.Project, StringComparison.Ordinal))
        {
            throw new ArgumentException("Project task requires an active project parent.");
        }
    }

    private async Task ValidateMilestoneBelongsToProjectAsync(int milestoneId, int projectId)
    {
        var milestones = await _projectMilestoneRepository.GetByProjectIdAsync(projectId);
        var milestone = milestones.FirstOrDefault(m => m.ProjectMilestoneId == milestoneId && m.IsActive);
        if (milestone == null)
        {
            throw new ArgumentException("Milestone does not belong to the selected project or is inactive.");
        }
    }
}
