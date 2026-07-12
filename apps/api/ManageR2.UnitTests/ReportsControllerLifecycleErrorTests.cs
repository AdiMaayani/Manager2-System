using System.Text.Json;
using ManageR2.Api.Controllers;
using ManageR2.Api.Features.Reports.DTOs;
using ManageR2.Api.Features.Reports.Services;
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
