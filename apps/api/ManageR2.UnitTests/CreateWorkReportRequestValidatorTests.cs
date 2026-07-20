using ManageR2.Api.DTOs;
using ManageR2.Api.Features.Reports.Validators;
using ManageR2.Domain.Features.Reports;

namespace ManageR2.UnitTests;

public class CreateWorkReportRequestValidatorTests
{
    private readonly CreateWorkReportRequestValidator _validator = new();

    [Fact]
    public void Draft_WithValidDateOnly_IsAccepted()
    {
        var request = CreateDraft();

        var result = _validator.Validate(request);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Draft_MayOmitTarget()
    {
        var request = CreateDraft();
        request.WorkItemId = null;
        request.ProjectId = null;
        request.ServiceCallId = null;

        var result = _validator.Validate(request);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Draft_ExistingValidDraft_RemainsValid()
    {
        var request = CreateDraft();
        request.WorkItemId = 42;
        request.ReporterId = 7;
        request.Start = "08:00";
        request.End = "12:00";
        request.Summary = "Partial draft summary";

        var result = _validator.Validate(request);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Submitted_RequiresValidTarget()
    {
        var request = CreateSubmitted();
        request.WorkItemId = null;
        request.ProjectId = null;
        request.ServiceCallId = null;

        var result = _validator.Validate(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.ErrorMessage.Contains("משימה או קריאת שירות"));
    }

    [Fact]
    public void Submitted_RequiresReporter()
    {
        var request = CreateSubmitted();
        request.ReporterId = null;

        var result = _validator.Validate(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.ErrorMessage.Contains("מדווח"));
    }

    [Fact]
    public void Submitted_RequiresStartAndEnd()
    {
        var request = CreateSubmitted();
        request.Start = null;
        request.End = null;

        var result = _validator.Validate(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.ErrorMessage.Contains("שעות עבודה"));
    }

    [Fact]
    public void Submitted_RejectsReversedTimeRange()
    {
        var request = CreateSubmitted();
        request.Start = "16:00";
        request.End = "08:00";

        var result = _validator.Validate(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.ErrorMessage.Contains("שעת הסיום"));
    }

    [Fact]
    public void Submitted_RequiresSummary()
    {
        var request = CreateSubmitted();
        request.Summary = "   ";

        var result = _validator.Validate(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.ErrorMessage.Contains("סיכום"));
    }

    [Fact]
    public void Submitted_ExistingValidSubmitted_RemainsValid()
    {
        var request = CreateSubmitted();

        var result = _validator.Validate(request);

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-a-status")]
    public void RejectsInvalidStatus(string? status)
    {
        var request = CreateDraft();
        request.Status = status;

        var result = _validator.Validate(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.ErrorMessage.Contains("סטטוס"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("unknown")]
    public void RejectsInvalidReportType(string? reportType)
    {
        var request = CreateDraft();
        request.ReportType = reportType;

        var result = _validator.Validate(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.ErrorMessage.Contains("סוג הדיווח"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-a-date")]
    public void RejectsInvalidDate(string? date)
    {
        var request = CreateDraft();
        request.Date = date;

        var result = _validator.Validate(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.ErrorMessage.Contains("תאריך"));
    }

    [Fact]
    public void RegularReport_AllowsWorkItemWithoutProjectId()
    {
        var request = CreateDraft();
        request.ReportType = WorkReportReportTypes.Regular;
        request.WorkItemId = 42;
        request.ProjectId = null;

        var result = _validator.Validate(request);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void RegularReport_RejectsProjectId()
    {
        var request = CreateDraft();
        request.ReportType = WorkReportReportTypes.Regular;
        request.WorkItemId = 42;
        request.ProjectId = 10;

        var result = _validator.Validate(request);

        Assert.False(result.IsValid);
    }

    [Fact]
    public void ProjectReport_Submitted_RequiresLinkedWorkItem()
    {
        var request = CreateSubmitted();
        request.ReportType = WorkReportReportTypes.Project;
        request.WorkItemId = 55;

        var result = _validator.Validate(request);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void ServiceCallReport_Submitted_RequiresLinkedWorkItem()
    {
        var request = CreateSubmitted();
        request.ReportType = WorkReportReportTypes.ServiceCall;
        request.WorkItemId = null;
        request.ServiceCallId = 77;

        var result = _validator.Validate(request);

        Assert.True(result.IsValid);
    }

    private static CreateWorkReportRequest CreateDraft() => new()
    {
        ReportType = WorkReportReportTypes.Regular,
        Date = "2026-06-19",
        Status = WorkReportWorkflowStatuses.Draft,
        Systems = [],
    };

    private static CreateWorkReportRequest CreateSubmitted() => new()
    {
        ReportType = WorkReportReportTypes.Regular,
        Date = "2026-06-19",
        Status = WorkReportWorkflowStatuses.Submitted,
        WorkItemId = 42,
        ReporterId = 7,
        Start = "08:00",
        End = "12:00",
        Summary = "עבודה הושלמה",
        Systems = [],
    };
}
