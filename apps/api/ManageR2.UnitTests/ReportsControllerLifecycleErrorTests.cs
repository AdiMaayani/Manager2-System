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
    public async Task Reverse_MapsSqlServerCodePrefixedDraftErrorToHebrewClientError()
    {
        var result = await ReverseThrowingAsync("51352 A Draft report cannot be reversed.");

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var message = GetResponseMessage(badRequest.Value);
        Assert.Contains("לא ניתן להחזיר לטיוטה", message);
        Assert.DoesNotContain("Draft", message);
        Assert.DoesNotContain("51352", message);
    }

    [Fact]
    public async Task Reverse_MapsPostgresNativeDraftErrorToHebrewClientError()
    {
        var result = await ReverseThrowingAsync("A Draft report cannot be reversed.");

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var message = GetResponseMessage(badRequest.Value);
        Assert.Contains("לא ניתן להחזיר לטיוטה", message);
        Assert.DoesNotContain("Draft", message);
    }

    [Fact]
    public async Task Reverse_MapsSqlServerCodePrefixedMissingReasonErrorToHebrewClientError()
    {
        var result = await ReverseThrowingAsync("51350 Reversal reason is required.");

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var message = GetResponseMessage(badRequest.Value);
        Assert.Contains("יש להזין סיבה", message);
        Assert.DoesNotContain("Reversal reason", message);
        Assert.DoesNotContain("51350", message);
    }

    [Fact]
    public async Task Reverse_MapsPostgresNativeMissingReasonErrorToHebrewClientError()
    {
        var result = await ReverseThrowingAsync("Reversal reason is required.");

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var message = GetResponseMessage(badRequest.Value);
        Assert.Contains("יש להזין סיבה", message);
        Assert.DoesNotContain("Reversal reason", message);
    }

    [Fact]
    public async Task Reverse_DoesNotMapUnrelatedValidationErrorAsDraftOrReasonLifecycleError()
    {
        var repository = new Mock<IWorkReportRepository>();
        repository
            .Setup(workReports => workReports.ReverseAsync(42, "reason", It.IsAny<int?>()))
            .ThrowsAsync(new Exception("Cannot reverse report inventory movements: quantity mismatch."));
        var controller = CreateController(repository);

        var result = await controller.Reverse(42, new ReverseWorkReportRequestDto
        {
            ReversalReason = "reason"
        });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var message = GetResponseMessage(badRequest.Value);
        Assert.Contains("תנועות המלאי", message);
        Assert.DoesNotContain("לא ניתן להחזיר לטיוטה דיווח שכבר נמצא בטיוטה", message);
        Assert.DoesNotContain("יש להזין סיבה", message);
    }

    private static async Task<IActionResult> ReverseThrowingAsync(string exceptionMessage)
    {
        var repository = new Mock<IWorkReportRepository>();
        repository
            .Setup(workReports => workReports.ReverseAsync(42, "reason", It.IsAny<int?>()))
            .ThrowsAsync(new Exception(exceptionMessage));
        var controller = CreateController(repository);

        return await controller.Reverse(42, new ReverseWorkReportRequestDto
        {
            ReversalReason = "reason"
        });
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
