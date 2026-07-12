using ManageR2.Api.Controllers;
using ManageR2.Api.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Features.WorkItems;
using ManageR2.Infrastructure.Features.WorkItems.Models;
using ManageR2.Infrastructure.Features.WorkItems.Services;
using ManageR2.Infrastructure.Models;
using ManageR2.Infrastructure.Repositories;
using ManageR2.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace ManageR2.UnitTests;

public class WorkItemReportTargetsControllerTests
{
    [Fact]
    public async Task GetReportTargets_IncludesTaskAndInheritedProjectContext()
    {
        var plannedStart = new DateTime(2026, 7, 12, 8, 0, 0, DateTimeKind.Utc);
        var plannedEnd = new DateTime(2026, 7, 12, 11, 0, 0, DateTimeKind.Utc);
        var workItemRepository = new Mock<IWorkItemRepository>();
        workItemRepository
            .Setup(repository => repository.GetByTypeAsync(WorkItemWorkTypes.Task))
            .ReturnsAsync(
            [
                new WorkItem
                {
                    WorkItemId = 42,
                    Title = "Install panel",
                    WorkType = WorkItemWorkTypes.Task,
                    TaskCategory = WorkItemTaskCategories.Project,
                    ParentWorkItemId = 7,
                    PlannedStart = plannedStart,
                    PlannedEnd = plannedEnd,
                    RequiredRole = "Electrician"
                }
            ]);
        workItemRepository
            .Setup(repository => repository.GetByTypeAsync(WorkItemWorkTypes.ServiceCall))
            .ReturnsAsync([]);
        workItemRepository
            .Setup(repository => repository.GetByTypeAsync(WorkItemWorkTypes.Project))
            .ReturnsAsync(
            [
                new WorkItem
                {
                    WorkItemId = 7,
                    Title = "Project A",
                    WorkType = WorkItemWorkTypes.Project,
                    CustomerId = 3,
                    CustomerName = "Customer A",
                    SiteId = 5,
                    SiteName = "Site A"
                }
            ]);
        workItemRepository
            .Setup(repository => repository.GetWorkPlanScheduleAsync(It.IsAny<WorkPlanScheduleQuery>()))
            .ReturnsAsync(new WorkPlanScheduleResult
            {
                Assignments =
                [
                    new WorkPlanAssignmentResult
                    {
                        WorkItemId = 42,
                        EmployeeId = 8,
                        EmployeeName = "Worker A",
                        AssignmentRole = "Electrician",
                        IsManualAssignment = true,
                        AssignmentSource = "Task"
                    },
                    new WorkPlanAssignmentResult
                    {
                        WorkItemId = 42,
                        EmployeeId = 9,
                        EmployeeName = "Worker B",
                        AssignmentRole = "Installer",
                        IsManualAssignment = false,
                        AssignmentSource = "Task"
                    },
                    new WorkPlanAssignmentResult
                    {
                        WorkItemId = 42,
                        EmployeeId = 99,
                        EmployeeName = "Missing worker",
                        AssignmentRole = "Installer",
                        AssignmentSource = "Task"
                    }
                ],
                Employees =
                [
                    new WorkPlanEmployeeResult
                    {
                        EmployeeId = 8,
                        FullName = "Worker A",
                        IsActive = true,
                        IsAssignable = true
                    },
                    new WorkPlanEmployeeResult
                    {
                        EmployeeId = 9,
                        FullName = "Worker B",
                        IsActive = true,
                        IsAssignable = true
                    }
                ]
            });

        var controller = new WorkItemsController(
            workItemRepository.Object,
            Mock.Of<IWorkItemTaskService>(),
            Mock.Of<IAuditLogService>());

        var actionResult = await controller.GetReportTargets();
        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var targets = Assert.IsType<List<WorkItemReportTargetDto>>(okResult.Value);
        var target = Assert.Single(targets);

        Assert.Equal(42, target.WorkItemId);
        Assert.Equal(7, target.ProjectId);
        Assert.Equal("Project A", target.ProjectTitle);
        Assert.Equal(3, target.CustomerId);
        Assert.Equal("Customer A", target.CustomerName);
        Assert.Equal(5, target.SiteId);
        Assert.Equal("Site A", target.SiteName);
        Assert.Equal(plannedStart, target.PlannedStart);
        Assert.Equal(plannedEnd, target.PlannedEnd);
        Assert.Equal("Electrician", target.RequiredRole);
        Assert.Equal(3, target.Assignments.Count);
        Assert.True(target.Assignments.Single(assignment => assignment.EmployeeId == 8).IsActive);
        Assert.False(target.Assignments.Single(assignment => assignment.EmployeeId == 99).IsActive);
    }
}
