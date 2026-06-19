using ManageR2.Api.DTOs;
using ManageR2.Api.Features.Reports.Validators;

namespace ManageR2.UnitTests;

public class CreateWorkReportRequestValidatorTests
{
    private readonly CreateWorkReportRequestValidator _validator = new();

    [Fact]
    public void RegularReport_AllowsWorkItemWithoutProjectId()
    {
        var request = new CreateWorkReportRequest
        {
            ReportType = "regular",
            Date = "2026-06-19",
            WorkItemId = 42,
            ProjectId = null,
            Systems = [],
        };

        var result = _validator.Validate(request);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void RegularReport_RejectsProjectId()
    {
        var request = new CreateWorkReportRequest
        {
            ReportType = "regular",
            Date = "2026-06-19",
            WorkItemId = 42,
            ProjectId = 10,
            Systems = [],
        };

        var result = _validator.Validate(request);

        Assert.False(result.IsValid);
    }

    [Fact]
    public void ProjectReport_RequiresLinkedWorkItem()
    {
        var request = new CreateWorkReportRequest
        {
            ReportType = "project",
            Date = "2026-06-19",
            WorkItemId = 55,
            Systems = [],
        };

        var result = _validator.Validate(request);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void ServiceCallReport_RequiresLinkedWorkItem()
    {
        var request = new CreateWorkReportRequest
        {
            ReportType = "service_call",
            Date = "2026-06-19",
            ServiceCallId = 77,
            Systems = [],
        };

        var result = _validator.Validate(request);

        Assert.True(result.IsValid);
    }
}
