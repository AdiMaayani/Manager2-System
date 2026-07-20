using ManageR2.Api.Controllers;
using ManageR2.Api.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Features.WorkItems;
using ManageR2.Infrastructure.Features.WorkItems.Services;
using ManageR2.Infrastructure.Repositories;
using ManageR2.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace ManageR2.UnitTests;

/// <summary>
/// Behavioral coverage for GAP-009: Project classification integrity on update paths.
/// </summary>
public class WorkItemsControllerProjectClassificationTests
{
    [Fact]
    public async Task Update_Project_SucceedsWithoutChangingClassification()
    {
        var repository = new Mock<IWorkItemRepository>();
        repository
            .Setup(workItemRepository => workItemRepository.GetByIdAsync(10))
            .ReturnsAsync(CreateProject());
        repository
            .Setup(workItemRepository => workItemRepository.UpdateAsync(
                10,
                It.Is<WorkItem>(workItem =>
                    workItem.WorkType == WorkItemWorkTypes.Project
                    && workItem.TaskCategory == null
                    && workItem.ParentWorkItemId == null
                    && workItem.MilestoneId == null
                    && workItem.Title == "Updated project"
                    && workItem.Status == "Open")))
            .ReturnsAsync(true);

        var controller = CreateController(repository);

        var result = await controller.Update(10, new WorkItem
        {
            Title = "Updated project",
            Description = "Updated description",
            WorkType = WorkItemWorkTypes.Project,
            Status = "Open",
            BillingType = "Fixed",
            CustomerId = 3,
            SiteId = 5
        });

        Assert.IsType<OkObjectResult>(result);
        repository.Verify(
            workItemRepository => workItemRepository.UpdateAsync(
                10,
                It.Is<WorkItem>(workItem => workItem.WorkType == WorkItemWorkTypes.Project)),
            Times.Once);
    }

    [Theory]
    [InlineData(WorkItemWorkTypes.Task, null)]
    [InlineData(WorkItemWorkTypes.ServiceCall, null)]
    [InlineData(WorkItemWorkTypes.Project, WorkItemTaskCategories.Regular)]
    [InlineData(WorkItemWorkTypes.Project, WorkItemTaskCategories.ServiceCall)]
    [InlineData(WorkItemWorkTypes.Task, WorkItemTaskCategories.Regular)]
    public async Task Update_Project_RejectsReclassificationAttempt(string workType, string? taskCategory)
    {
        var repository = new Mock<IWorkItemRepository>();
        repository
            .Setup(workItemRepository => workItemRepository.GetByIdAsync(10))
            .ReturnsAsync(CreateProject());

        var controller = CreateController(repository);

        var result = await controller.Update(10, new WorkItem
        {
            Title = "Updated project",
            WorkType = workType,
            TaskCategory = taskCategory,
            Status = "Open",
            BillingType = "Fixed",
            CustomerId = 3,
            SiteId = 5
        });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        using var document = System.Text.Json.JsonDocument.Parse(
            System.Text.Json.JsonSerializer.Serialize(badRequest.Value));
        Assert.Equal(
            "Reclassifying a Project is not allowed.",
            document.RootElement.GetProperty("message").GetString());
        repository.Verify(
            workItemRepository => workItemRepository.UpdateAsync(It.IsAny<int>(), It.IsAny<WorkItem>()),
            Times.Never);
    }

    [Fact]
    public async Task UpdateTask_RejectsExistingProjectWorkItem()
    {
        var repository = new Mock<IWorkItemRepository>();
        repository
            .Setup(workItemRepository => workItemRepository.GetByIdAsync(10))
            .ReturnsAsync(CreateProject());

        var controller = CreateController(repository);

        var result = await controller.UpdateTask(10, new UpdateTaskRequest
        {
            Title = "Should not update",
            BillingType = "Hourly",
            TaskCategory = WorkItemTaskCategories.Regular,
            Status = "Planned"
        });

        Assert.IsType<BadRequestObjectResult>(result);
        repository.Verify(
            workItemRepository => workItemRepository.UpdateAsync(It.IsAny<int>(), It.IsAny<WorkItem>()),
            Times.Never);
    }

    [Fact]
    public async Task Update_NonProjectTask_StillAllowsTaskCategoryUpdate()
    {
        var repository = new Mock<IWorkItemRepository>();
        repository
            .Setup(workItemRepository => workItemRepository.GetByIdAsync(20))
            .ReturnsAsync(new WorkItem
            {
                WorkItemId = 20,
                Title = "Regular task",
                WorkType = WorkItemWorkTypes.Task,
                TaskCategory = WorkItemTaskCategories.Regular,
                Status = "Planned",
                BillingType = "Hourly"
            });
        repository
            .Setup(workItemRepository => workItemRepository.UpdateAsync(
                20,
                It.Is<WorkItem>(workItem =>
                    workItem.WorkType == WorkItemWorkTypes.Task
                    && workItem.TaskCategory == WorkItemTaskCategories.Regular
                    && workItem.Title == "Updated task")))
            .ReturnsAsync(true);

        var controller = CreateController(repository);

        var result = await controller.Update(20, new WorkItem
        {
            Title = "Updated task",
            WorkType = WorkItemWorkTypes.Task,
            TaskCategory = WorkItemTaskCategories.Regular,
            Status = "Planned",
            BillingType = "Hourly"
        });

        Assert.IsType<OkObjectResult>(result);
        repository.Verify(
            workItemRepository => workItemRepository.UpdateAsync(
                20,
                It.Is<WorkItem>(workItem => workItem.WorkType == WorkItemWorkTypes.Task)),
            Times.Once);
    }

    private static WorkItemsController CreateController(Mock<IWorkItemRepository> repository)
    {
        var controller = new WorkItemsController(
            repository.Object,
            Mock.Of<IWorkItemTaskService>(),
            Mock.Of<IAuditLogService>());
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
        return controller;
    }

    private static WorkItem CreateProject() =>
        new()
        {
            WorkItemId = 10,
            Title = "Existing project",
            WorkType = WorkItemWorkTypes.Project,
            TaskCategory = null,
            Status = "Open",
            BillingType = "Fixed",
            CustomerId = 3,
            SiteId = 5,
            ParentWorkItemId = null,
            MilestoneId = null
        };
}
