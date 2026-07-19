using ManageR2.Api.Features.ServiceCalls;
using ManageR2.Api.Features.ServiceCalls.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Domain.Features.WorkItems;
using ManageR2.Infrastructure.Features.WorkItems.Services;
using ManageR2.Infrastructure.Repositories;
using ManageR2.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace ManageR2.UnitTests;

public class ServiceCallsControllerLifecycleTests
{
    [Fact]
    public async Task Cancel_UsesCancelServiceCallAsync_NotCloseAsync()
    {
        var existing = CreateServiceCall(status: "Open", closedAt: null);
        var repository = new Mock<IWorkItemRepository>();
        repository.Setup(r => r.GetByIdAsync(42)).ReturnsAsync(existing);
        repository.Setup(r => r.CancelServiceCallAsync(42)).ReturnsAsync(true);
        var controller = CreateController(repository);

        var result = await controller.Cancel(42);

        Assert.IsType<OkObjectResult>(result);
        repository.Verify(r => r.CancelServiceCallAsync(42), Times.Once);
        repository.Verify(r => r.CloseAsync(It.IsAny<int>()), Times.Never);
        repository.Verify(r => r.UpdateAsync(It.IsAny<int>(), It.IsAny<WorkItem>()), Times.Never);
    }

    [Theory]
    [InlineData("Planned")]
    [InlineData("Open")]
    [InlineData("InProgress")]
    public async Task Cancel_AllowsActiveStatuses(string status)
    {
        var existing = CreateServiceCall(status: status, closedAt: null);
        var repository = new Mock<IWorkItemRepository>();
        repository.Setup(r => r.GetByIdAsync(42)).ReturnsAsync(existing);
        repository.Setup(r => r.CancelServiceCallAsync(42)).ReturnsAsync(true);
        var controller = CreateController(repository);

        var result = await controller.Cancel(42);

        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task Cancel_RejectsDone()
    {
        var existing = CreateServiceCall(status: "Done", closedAt: null);
        var repository = new Mock<IWorkItemRepository>();
        repository.Setup(r => r.GetByIdAsync(42)).ReturnsAsync(existing);
        var controller = CreateController(repository);

        var result = await controller.Cancel(42);

        Assert.IsType<BadRequestObjectResult>(result);
        repository.Verify(r => r.CancelServiceCallAsync(It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task Cancel_RejectsWhenAlreadyCancelled()
    {
        var existing = CreateServiceCall(
            status: "Cancelled",
            closedAt: new DateTime(2026, 7, 19, 11, 13, 0, DateTimeKind.Utc));
        var repository = new Mock<IWorkItemRepository>();
        repository.Setup(r => r.GetByIdAsync(42)).ReturnsAsync(existing);
        var controller = CreateController(repository);

        var result = await controller.Cancel(42);

        Assert.IsType<BadRequestObjectResult>(result);
        repository.Verify(r => r.CancelServiceCallAsync(It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task Cancel_MapsUserValidationExceptionToSafeHebrewMessage()
    {
        var existing = CreateServiceCall(status: "Open", closedAt: null);
        var repository = new Mock<IWorkItemRepository>();
        repository.Setup(r => r.GetByIdAsync(42)).ReturnsAsync(existing);
        repository
            .Setup(r => r.CancelServiceCallAsync(42))
            .ThrowsAsync(new UserValidationException("לא ניתן לבטל את קריאת השירות במצב הנוכחי."));
        var controller = CreateController(repository);

        var result = await controller.Cancel(42);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        using var document = System.Text.Json.JsonDocument.Parse(
            System.Text.Json.JsonSerializer.Serialize(badRequest.Value));
        var message = document.RootElement.GetProperty("message").GetString();
        Assert.Equal("לא ניתן לבטל את קריאת השירות במצב הנוכחי.", message);
        Assert.DoesNotContain("sp_CancelServiceCall", message);
        Assert.DoesNotContain("SqlException", message);
    }

    [Fact]
    public async Task Reopen_CallsReopenServiceCallAsync()
    {
        var existing = CreateServiceCall(
            status: "Cancelled",
            closedAt: new DateTime(2026, 7, 19, 11, 13, 0, DateTimeKind.Utc),
            actualStart: new DateTime(2026, 7, 19, 8, 0, 0, DateTimeKind.Utc),
            actualEnd: new DateTime(2026, 7, 19, 10, 0, 0, DateTimeKind.Utc));
        var repository = new Mock<IWorkItemRepository>();
        repository.Setup(r => r.GetByIdAsync(42)).ReturnsAsync(existing);
        repository.Setup(r => r.ReopenServiceCallAsync(42)).ReturnsAsync(true);
        var controller = CreateController(repository);

        var result = await controller.Reopen(42);

        Assert.IsType<OkObjectResult>(result);
        repository.Verify(r => r.ReopenServiceCallAsync(42), Times.Once);
        repository.Verify(r => r.UpdateAsync(It.IsAny<int>(), It.IsAny<WorkItem>()), Times.Never);
    }

    [Fact]
    public async Task Reopen_AllowsRepairWhenOpenHasStaleClosedAt()
    {
        var existing = CreateServiceCall(
            status: "Open",
            closedAt: new DateTime(2026, 7, 19, 11, 13, 0, DateTimeKind.Utc));
        var repository = new Mock<IWorkItemRepository>();
        repository.Setup(r => r.GetByIdAsync(42)).ReturnsAsync(existing);
        repository.Setup(r => r.ReopenServiceCallAsync(42)).ReturnsAsync(true);
        var controller = CreateController(repository);

        var result = await controller.Reopen(42);

        Assert.IsType<OkObjectResult>(result);
        repository.Verify(r => r.ReopenServiceCallAsync(42), Times.Once);
    }

    [Theory]
    [InlineData("Done")]
    [InlineData("InProgress")]
    [InlineData("Planned")]
    public async Task Reopen_RejectsUnsupportedStatusesEvenWithClosedAt(string status)
    {
        var existing = CreateServiceCall(
            status: status,
            closedAt: new DateTime(2026, 7, 19, 11, 13, 0, DateTimeKind.Utc));
        var repository = new Mock<IWorkItemRepository>();
        repository.Setup(r => r.GetByIdAsync(42)).ReturnsAsync(existing);
        var controller = CreateController(repository);

        var result = await controller.Reopen(42);

        Assert.IsType<BadRequestObjectResult>(result);
        repository.Verify(r => r.ReopenServiceCallAsync(It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task Update_RejectsLeavingCancelledWithoutReopen()
    {
        var existing = CreateServiceCall(
            status: "Cancelled",
            closedAt: new DateTime(2026, 7, 19, 11, 13, 0, DateTimeKind.Utc));
        var repository = new Mock<IWorkItemRepository>();
        repository.Setup(r => r.GetByIdAsync(42)).ReturnsAsync(existing);
        var taskService = new Mock<IWorkItemTaskService>();
        var controller = CreateController(repository, taskService);

        var result = await controller.Update(42, new UpdateServiceCallRequestDto
        {
            Title = "תקלה",
            BillingType = "Hourly",
            CustomerId = 7,
            SiteId = 13,
            Status = "Open"
        });

        Assert.IsType<BadRequestObjectResult>(result);
        repository.Verify(r => r.UpdateAsync(It.IsAny<int>(), It.IsAny<WorkItem>()), Times.Never);
    }

    private static ServiceCallsController CreateController(
        Mock<IWorkItemRepository> repository,
        Mock<IWorkItemTaskService>? taskService = null)
    {
        var controller = new ServiceCallsController(
            repository.Object,
            (taskService ?? new Mock<IWorkItemTaskService>()).Object,
            Mock.Of<IAuditLogService>());
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
        return controller;
    }

    private static WorkItem CreateServiceCall(
        string status,
        DateTime? closedAt,
        DateTime? actualStart = null,
        DateTime? actualEnd = null)
    {
        return new WorkItem
        {
            WorkItemId = 42,
            Title = "Service Call",
            WorkType = WorkItemWorkTypes.ServiceCall,
            Status = status,
            CustomerId = 7,
            SiteId = 13,
            ActualStart = actualStart,
            ActualEnd = actualEnd,
            CreatedAt = new DateTime(2026, 7, 19, 9, 31, 5, DateTimeKind.Utc),
            ClosedAt = closedAt,
            IsLocked = false
        };
    }
}
