using ManageR2.Api.Authorization;
using ManageR2.Api.Controllers;
using ManageR2.Api.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Features.WorkItems.Services;
using ManageR2.Infrastructure.Repositories;
using ManageR2.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace ManageR2.UnitTests;

public sealed class WorkEmployeeAssignmentUpdateContractTests
{
    [Fact]
    public void UpdateProcedure_UpdatesOnlyTheExactAssignmentAsAManualOverride()
    {
        var sql = ReadRepoFile("database/SP/sp_UpdateEmployeeWorkAssignment.sql");

        Assert.Contains("CREATE OR ALTER PROCEDURE dbo.sp_UpdateEmployeeWorkAssignment", sql);
        Assert.Contains("UPDATE dbo.WorkEmployeeAssignments", sql);
        Assert.Contains("WorkEmployeeAssignmentId = @WorkEmployeeAssignmentId", sql);
        Assert.Contains("WorkItemId = @WorkItemId", sql);
        Assert.Contains("@ExistingEmployeeId = @EmployeeId", sql);
        Assert.Contains("employee.IsActive = 1", sql);
        Assert.Contains("duplicateAssignment.EmployeeId = @EmployeeId", sql);
        Assert.Contains("IF @WorkItemIsArchived = 1", sql);
        Assert.Contains("IF @WorkItemIsLocked = 1", sql);
        Assert.DoesNotContain("@AssignmentRole", sql);
        Assert.DoesNotContain("AssignmentRole =", sql);
        Assert.Contains("IsManualAssignment = 1", sql);
        Assert.Contains("SmartAssignmentRecommendationId = NULL", sql);
        Assert.DoesNotContain("DELETE ", sql, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("INSERT ", sql, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Rec_TaskAssignmentRecommendations", sql);
        Assert.DoesNotContain("Rec_RecommendationFeedback", sql);
    }

    [Fact]
    public void ScheduleAndRepository_ExposeAndUseTheStableAssignmentIdentifier()
    {
        var scheduleSql = ReadRepoFile("database/SP/sp_GetWorkPlanSchedule.sql");
        var repositorySource = ReadRepoFile(
            "apps/api/ManageR2.Infrastructure/Features/WorkItems/Repositories/WorkItemRepository.cs");

        Assert.Contains(
            "SELECT a.WorkEmployeeAssignmentId,a.WorkItemId",
            scheduleSql);
        Assert.Contains("dbo.sp_UpdateEmployeeWorkAssignment", repositorySource);
        Assert.Contains("CommandType = CommandType.StoredProcedure", repositorySource);
        Assert.Contains(
            "WorkEmployeeAssignmentId = GetIntValue(reader, \"WorkEmployeeAssignmentId\")",
            repositorySource);
    }

    [Fact]
    public void Controller_ExposesProtectedExactAssignmentUpdateRoute()
    {
        var method = typeof(WorkItemsController)
            .GetMethod(nameof(WorkItemsController.UpdateEmployeeAssignment));

        Assert.NotNull(method);
        var route = Assert.Single(method!.GetCustomAttributes(typeof(HttpPutAttribute), false))
            as HttpPutAttribute;
        Assert.Equal(
            "{workItemId:int}/employee-assignments/{assignmentId:int}",
            route!.Template);
        var authorize = Assert.Single(method.GetCustomAttributes(typeof(AuthorizeAttribute), false))
            as AuthorizeAttribute;
        Assert.Equal(Policies.CanManageWorkPlan, authorize!.Policy);
    }

    [Fact]
    public void ReplacementContract_AcceptsOnlyTheReplacementEmployeeAndPreservesTheRole()
    {
        var requestProperties = typeof(UpdateEmployeeAssignmentRequest)
            .GetProperties()
            .Select(property => property.Name)
            .ToArray();
        Assert.Equal(
            new[] { nameof(UpdateEmployeeAssignmentRequest.EmployeeId) },
            requestProperties);

        var repositoryMethod = typeof(IWorkItemRepository)
            .GetMethod(nameof(IWorkItemRepository.UpdateEmployeeWorkAssignmentAsync));
        Assert.NotNull(repositoryMethod);
        Assert.Equal(
            new[] { "workItemId", "workEmployeeAssignmentId", "employeeId" },
            repositoryMethod!.GetParameters().Select(parameter => parameter.Name).ToArray());
    }

    [Fact]
    public void TaskEditReplacementContract_IsAtomicAndCarriesNoRoleInput()
    {
        var repositorySource = ReadRepoFile(
            "apps/api/ManageR2.Infrastructure/Features/WorkItems/Repositories/WorkItemRepository.cs");
        var controllerSource = ReadRepoFile(
            "apps/api/ManageR2.Api/Features/WorkItems/WorkItemsController.cs");
        var drawerSource = ReadRepoFile(
            "apps/web/src/features/workplan/components/EditTaskDrawer/EditTaskDrawer.tsx");

        Assert.Contains("UpdateWithEmployeeReplacementsAsync", repositorySource);
        Assert.Contains("BeginTransactionAsync", repositorySource);
        Assert.True(
            repositorySource.IndexOf("sp_UpdateEmployeeWorkAssignment", StringComparison.Ordinal) <
            repositorySource.IndexOf("CreateWorkItemUpdateCommand(\n                connection,\n                transaction", StringComparison.Ordinal));
        Assert.Contains("CommitAsync", repositorySource);
        Assert.Contains("TryRollbackAsync", repositorySource);
        Assert.Contains("UpdateWithEmployeeReplacementsAsync", controllerSource);
        Assert.Contains("employeeReplacements,", drawerSource);
        Assert.DoesNotContain("replaceEmployeeAssignmentAsync(", drawerSource);
        Assert.DoesNotContain("assignmentRole:", drawerSource);
    }

    [Fact]
    public async Task Controller_UpdatesTheRequestedAssignmentAndAuditsTheManualOverride()
    {
        var repository = new Mock<IWorkItemRepository>();
        repository
            .Setup(value => value.UpdateEmployeeWorkAssignmentAsync(17, 91, 8))
            .ReturnsAsync(true);
        AuditEvent? loggedEvent = null;
        var auditLog = new Mock<IAuditLogService>();
        auditLog
            .Setup(value => value.LogAsync(It.IsAny<AuditEvent>()))
            .Callback<AuditEvent>(value => loggedEvent = value)
            .Returns(Task.CompletedTask);
        var controller = new WorkItemsController(
            repository.Object,
            Mock.Of<IWorkItemTaskService>(),
            auditLog.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

        var result = await controller.UpdateEmployeeAssignment(
            17,
            91,
            new UpdateEmployeeAssignmentRequest
            {
                EmployeeId = 8
            });

        Assert.IsType<OkObjectResult>(result);
        repository.Verify(
            value => value.UpdateEmployeeWorkAssignmentAsync(17, 91, 8),
            Times.Once);
        Assert.NotNull(loggedEvent);
        Assert.Equal(AuditActions.WorkItemAssignmentUpdated, loggedEvent!.Action);
        Assert.Equal(17, loggedEvent.EntityId);
        Assert.Equal(91, loggedEvent.Metadata!["workEmployeeAssignmentId"]);
        Assert.False(loggedEvent.Metadata.ContainsKey("assignmentRole"));
        Assert.Equal("Manual", loggedEvent.Metadata["assignmentMethod"]);
        Assert.Equal(true, loggedEvent.Metadata["smartAssignmentRecommendationCleared"]);
    }

    private static string ReadRepoFile(string relativePath) =>
        File.ReadAllText(GetRepoRelativePath(relativePath));

    private static string GetRepoRelativePath(string relativePath)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate))
            {
                return candidate;
            }

            current = current.Parent;
        }

        throw new FileNotFoundException($"Could not locate repository file: {relativePath}");
    }
}
