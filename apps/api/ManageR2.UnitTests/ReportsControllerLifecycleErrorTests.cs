using System.Text.Json;
using ManageR2.Api.Controllers;
using ManageR2.Api.Features.Reports.DTOs;
using ManageR2.Api.Features.Reports.Services;
using ManageR2.Domain.Features.Reports;
using ManageR2.Infrastructure.Models;
using ManageR2.Infrastructure.Repositories;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace ManageR2.UnitTests;

public class ReportsControllerLifecycleErrorTests
{
    [Fact]
    public async Task Finalize_MapsInsufficientStockToHebrewClientError()
    {
        var repository = new Mock<IWorkReportRepository>();
        repository
            .Setup(workReports => workReports.FinalizeAsync(42, It.IsAny<int?>()))
            .ThrowsAsync(new Exception("51332 Insufficient or inactive inventory item."));
        var controller = CreateController(repository);

        var result = await controller.Finalize(42);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var message = GetResponseMessage(badRequest.Value);
        Assert.Contains("המלאי אינו מספיק", message);
        Assert.DoesNotContain("Insufficient", message);
    }

    [Fact]
    public async Task Reverse_MapsDraftLifecycleErrorToHebrewClientError()
    {
        var repository = new Mock<IWorkReportRepository>();
        repository
            .Setup(workReports => workReports.ReverseAsync(42, "reason", It.IsAny<int?>()))
            .ThrowsAsync(new Exception("51352 A Draft report cannot be reversed."));
        var controller = CreateController(repository);

        var result = await controller.Reverse(42, new ReverseWorkReportRequestDto
        {
            ReversalReason = "reason"
        });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var message = GetResponseMessage(badRequest.Value);
        Assert.Contains("לא ניתן להחזיר לטיוטה", message);
        Assert.DoesNotContain("Draft", message);
    }

    [Fact]
    public async Task Delete_DraftWithoutAttachments_Deletes()
    {
        var repository = new Mock<IWorkReportRepository>();
        repository
            .Setup(workReports => workReports.GetByIdAsync(42))
            .ReturnsAsync(CreateReport(WorkReportLifecycleStatuses.Draft));
        repository
            .Setup(workReports => workReports.DeleteAsync(42))
            .ReturnsAsync(true);
        var controller = CreateController(repository);

        var result = await controller.Delete(42);

        Assert.IsType<NoContentResult>(result);
        repository.Verify(workReports => workReports.DeleteAsync(42), Times.Once);
    }

    [Fact]
    public async Task Delete_DraftWithAttachments_IsRejectedWithoutCallingRepositoryDelete()
    {
        var repository = new Mock<IWorkReportRepository>();
        var report = CreateReport(WorkReportLifecycleStatuses.Draft);
        report.Attachments.Add(new WorkReportAttachmentModel
        {
            WorkReportAttachmentId = 9,
            WorkReportId = 42,
            OriginalFileName = "photo.jpg"
        });
        repository
            .Setup(workReports => workReports.GetByIdAsync(42))
            .ReturnsAsync(report);
        var controller = CreateController(repository);

        var result = await controller.Delete(42);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("קבצים המצורפים", GetResponseMessage(badRequest.Value));
        repository.Verify(workReports => workReports.DeleteAsync(It.IsAny<int>()), Times.Never);
    }

    [Theory]
    [InlineData(WorkReportLifecycleStatuses.Finalized)]
    [InlineData(WorkReportLifecycleStatuses.Reversed)]
    public async Task Delete_NonDraftLifecycle_IsRejectedWithoutCallingRepositoryDelete(string lifecycleStatus)
    {
        var repository = new Mock<IWorkReportRepository>();
        repository
            .Setup(workReports => workReports.GetByIdAsync(42))
            .ReturnsAsync(CreateReport(lifecycleStatus));
        var controller = CreateController(repository);

        var result = await controller.Delete(42);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("טיוטת מלאי", GetResponseMessage(badRequest.Value));
        repository.Verify(workReports => workReports.DeleteAsync(It.IsAny<int>()), Times.Never);
    }

    private static WorkReportDetailsModel CreateReport(string lifecycleStatus) => new()
    {
        WorkReportId = 42,
        LifecycleStatus = lifecycleStatus,
        Status = WorkReportWorkflowStatuses.Draft
    };

    private static ReportsController CreateController(Mock<IWorkReportRepository> repository)
    {
        var controller = new ReportsController(
            repository.Object,
            Mock.Of<IWorkReportAttachmentStorageService>());
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
        return controller;
    }

    private static string GetResponseMessage(object? response)
    {
        using var document = JsonDocument.Parse(JsonSerializer.Serialize(response));
        return document.RootElement.GetProperty("message").GetString() ?? string.Empty;
    }
}
