using ManageR2.Api.Features.ServiceCalls;
using ManageR2.Api.Features.ServiceCalls.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Features.WorkItems;
using ManageR2.Infrastructure.Features.WorkItems.Services;
using ManageR2.Infrastructure.Repositories;
using ManageR2.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace ManageR2.UnitTests;

public class ServiceCallsControllerUtcResponseTests
{
    [Fact]
    public async Task GetById_ReturnsUtcMarkedDto()
    {
        var workItem = CreateUnspecifiedServiceCall(42);
        var repository = new Mock<IWorkItemRepository>();
        repository.Setup(r => r.GetByIdAsync(42)).ReturnsAsync(workItem);
        var controller = CreateController(repository);

        var result = await controller.GetById(42);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<ServiceCallResponseDto>(okResult.Value);
        Assert.Equal(DateTimeKind.Utc, dto.PlannedStart!.Value.Kind);
        Assert.Equal(DateTimeKind.Utc, dto.PlannedEnd!.Value.Kind);
        Assert.Equal(DateTimeKind.Utc, dto.CreatedAt.Kind);
        Assert.Equal(workItem.PlannedStart!.Value.Ticks, dto.PlannedStart.Value.Ticks);
    }

    [Fact]
    public async Task GetAll_ReturnsUtcMarkedDtos()
    {
        var repository = new Mock<IWorkItemRepository>();
        repository
            .Setup(r => r.GetByTypeAsync(WorkItemWorkTypes.ServiceCall))
            .ReturnsAsync([CreateUnspecifiedServiceCall(7), CreateUnspecifiedServiceCall(8)]);
        var controller = CreateController(repository);

        var result = await controller.GetAll();

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var dtos = Assert.IsAssignableFrom<List<ServiceCallResponseDto>>(okResult.Value);
        Assert.Equal(2, dtos.Count);
        Assert.All(dtos, dto =>
        {
            Assert.Equal(DateTimeKind.Utc, dto.PlannedStart!.Value.Kind);
            Assert.Equal(DateTimeKind.Utc, dto.PlannedEnd!.Value.Kind);
            Assert.Equal(DateTimeKind.Utc, dto.CreatedAt.Kind);
        });
    }

    private static ServiceCallsController CreateController(Mock<IWorkItemRepository> repository)
    {
        return new ServiceCallsController(
            repository.Object,
            Mock.Of<IWorkItemTaskService>(),
            Mock.Of<IAuditLogService>());
    }

    private static WorkItem CreateUnspecifiedServiceCall(int workItemId)
    {
        return new WorkItem
        {
            WorkItemId = workItemId,
            Title = "Service Call",
            WorkType = WorkItemWorkTypes.ServiceCall,
            Status = "Open",
            CustomerId = 1,
            SiteId = 2,
            PlannedStart = new DateTime(2026, 7, 19, 9, 33, 0, DateTimeKind.Unspecified),
            PlannedEnd = new DateTime(2026, 7, 19, 11, 33, 0, DateTimeKind.Unspecified),
            CreatedAt = new DateTime(2026, 6, 19, 17, 27, 16, DateTimeKind.Unspecified),
            IsLocked = false
        };
    }
}
