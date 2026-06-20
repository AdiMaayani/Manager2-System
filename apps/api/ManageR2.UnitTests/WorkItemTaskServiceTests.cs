using ManageR2.Domain.Entities;
using ManageR2.Domain.Features.WorkItems;
using ManageR2.Infrastructure.Features.WorkItems.Services;
using ManageR2.Infrastructure.Repositories;
using Moq;

namespace ManageR2.UnitTests;

public class WorkItemTaskServiceTests
{
    private readonly Mock<IWorkItemRepository> _workItemRepository = new();
    private readonly Mock<IProjectMilestoneRepository> _projectMilestoneRepository = new();

    private WorkItemTaskService CreateService() =>
        new(_workItemRepository.Object, _projectMilestoneRepository.Object);

    [Theory]
    [InlineData(WorkItemTaskCategories.Regular, WorkItemWorkTypes.Task)]
    [InlineData(WorkItemTaskCategories.Project, WorkItemWorkTypes.Task)]
    [InlineData(WorkItemTaskCategories.ServiceCall, WorkItemWorkTypes.ServiceCall)]
    public void DeriveWorkType_MapsCategoryToWorkType(string category, string expectedWorkType)
    {
        var service = CreateService();

        Assert.Equal(expectedWorkType, service.DeriveWorkType(category));
    }

    [Fact]
    public void ValidateCreateOrUpdate_RejectsRegularTaskWithProjectParent()
    {
        var service = CreateService();
        var input = new WorkItemTaskValidationInput
        {
            TaskCategory = WorkItemTaskCategories.Regular,
            ParentWorkItemId = 10
        };

        var exception = Assert.Throws<ArgumentException>(() => service.ValidateCreateOrUpdate(input));
        Assert.Contains("Regular tasks cannot have a project parent", exception.Message);
    }

    [Fact]
    public void ValidateCreateOrUpdate_RejectsProjectTaskWithoutParent()
    {
        var service = CreateService();
        var input = new WorkItemTaskValidationInput
        {
            TaskCategory = WorkItemTaskCategories.Project
        };

        var exception = Assert.Throws<ArgumentException>(() => service.ValidateCreateOrUpdate(input));
        Assert.Contains("Project tasks require an active project parent", exception.Message);
    }

    [Fact]
    public void ApplyCanonicalFields_DerivesEstimatedHoursFromPlannedRange()
    {
        var service = CreateService();
        var start = new DateTime(2026, 6, 19, 8, 0, 0, DateTimeKind.Utc);
        var end = start.AddHours(3);
        var input = new WorkItemTaskValidationInput
        {
            TaskCategory = WorkItemTaskCategories.Regular,
            PlannedStartUtc = start,
            PlannedEndUtc = end
        };

        var workItem = service.ApplyCanonicalFields(new WorkItem { Title = "Regular task" }, input);

        Assert.Equal(WorkItemWorkTypes.Task, workItem.WorkType);
        Assert.Equal(WorkItemTaskCategories.Regular, workItem.TaskCategory);
        Assert.Null(workItem.ParentWorkItemId);
        Assert.Equal(3m, workItem.EstimatedHours);
    }

    [Fact]
    public void ValidateCreateOrUpdate_ValidatesMilestoneBelongsToProject()
    {
        _workItemRepository
            .Setup(repository => repository.GetByIdAsync(5))
            .ReturnsAsync(new WorkItem
            {
                WorkItemId = 5,
                WorkType = WorkItemWorkTypes.Project,
                IsArchived = false
            });

        _projectMilestoneRepository
            .Setup(repository => repository.GetByProjectIdAsync(5))
            .ReturnsAsync(new List<ProjectMilestone>
            {
                new() { ProjectMilestoneId = 99, ProjectId = 5, IsActive = true, Title = "Phase 1" }
            });

        var service = CreateService();
        var input = new WorkItemTaskValidationInput
        {
            TaskCategory = WorkItemTaskCategories.Project,
            ParentWorkItemId = 5,
            MilestoneId = 99,
            PlannedStartUtc = DateTime.UtcNow,
            PlannedEndUtc = DateTime.UtcNow.AddHours(1)
        };

        service.ValidateCreateOrUpdate(input);
    }

    [Fact]
    public void ValidateCreateOrUpdate_RejectsInactiveMilestone()
    {
        _workItemRepository
            .Setup(repository => repository.GetByIdAsync(5))
            .ReturnsAsync(new WorkItem
            {
                WorkItemId = 5,
                WorkType = WorkItemWorkTypes.Project,
                IsArchived = false
            });

        _projectMilestoneRepository
            .Setup(repository => repository.GetByProjectIdAsync(5))
            .ReturnsAsync(new List<ProjectMilestone>
            {
                new() { ProjectMilestoneId = 99, ProjectId = 5, IsActive = false, Title = "Inactive" }
            });

        var service = CreateService();
        var input = new WorkItemTaskValidationInput
        {
            TaskCategory = WorkItemTaskCategories.Project,
            ParentWorkItemId = 5,
            MilestoneId = 99,
            PlannedStartUtc = DateTime.UtcNow,
            PlannedEndUtc = DateTime.UtcNow.AddHours(1)
        };

        var exception = Assert.Throws<ArgumentException>(() => service.ValidateCreateOrUpdate(input));
        Assert.Contains("Milestone does not belong", exception.Message);
    }

    [Fact]
    public void ValidateCreateOrUpdate_RejectsCrossProjectMilestone()
    {
        _workItemRepository
            .Setup(repository => repository.GetByIdAsync(5))
            .ReturnsAsync(new WorkItem
            {
                WorkItemId = 5,
                WorkType = WorkItemWorkTypes.Project,
                IsArchived = false
            });

        _projectMilestoneRepository
            .Setup(repository => repository.GetByProjectIdAsync(5))
            .ReturnsAsync(new List<ProjectMilestone>
            {
                new() { ProjectMilestoneId = 11, ProjectId = 5, IsActive = true, Title = "Own milestone" }
            });

        var service = CreateService();
        var input = new WorkItemTaskValidationInput
        {
            TaskCategory = WorkItemTaskCategories.Project,
            ParentWorkItemId = 5,
            MilestoneId = 99,
            PlannedStartUtc = DateTime.UtcNow,
            PlannedEndUtc = DateTime.UtcNow.AddHours(1)
        };

        var exception = Assert.Throws<ArgumentException>(() => service.ValidateCreateOrUpdate(input));
        Assert.Contains("Milestone does not belong", exception.Message);
    }

    [Fact]
    public void ValidateCreateOrUpdate_AllowsRegularDraftWithoutProject()
    {
        var service = CreateService();
        var input = new WorkItemTaskValidationInput
        {
            TaskCategory = WorkItemTaskCategories.Regular,
            PlannedStartUtc = DateTime.UtcNow,
            PlannedEndUtc = DateTime.UtcNow.AddHours(1)
        };

        service.ValidateCreateOrUpdate(input);
    }
}
