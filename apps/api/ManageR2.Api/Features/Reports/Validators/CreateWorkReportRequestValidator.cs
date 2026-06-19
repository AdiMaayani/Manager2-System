using FluentValidation;
using ManageR2.Api.DTOs;

namespace ManageR2.Api.Features.Reports.Validators;

public sealed class CreateWorkReportRequestValidator : AbstractValidator<CreateWorkReportRequest>
{
    public CreateWorkReportRequestValidator()
    {
        RuleFor(request => request.Date)
            .NotEmpty().WithMessage("Date is required.");

        RuleFor(request => request)
            .Must(request => HasLinkedWorkItem(request))
            .WithMessage("A work item must be selected for the report.");

        RuleFor(request => request)
            .Must(request => !IsRegularReport(request) || !request.ProjectId.HasValue)
            .WithMessage("Regular task reports cannot include a project context.");

        RuleFor(request => request)
            .Must(request => !IsProjectReport(request) || request.ProjectId.HasValue || request.WorkItemId.HasValue)
            .WithMessage("Project task reports require a linked work item.");

        RuleFor(request => request)
            .Must(request => !IsServiceCallReport(request) || request.ServiceCallId.HasValue || request.WorkItemId.HasValue)
            .WithMessage("Service call reports require a linked service call.");
    }

    private static bool HasLinkedWorkItem(CreateWorkReportRequest request) =>
        request.WorkItemId > 0
        || request.ProjectId > 0
        || request.ServiceCallId > 0;

    private static bool IsRegularReport(CreateWorkReportRequest request) =>
        string.Equals(request.ReportType, "regular", StringComparison.OrdinalIgnoreCase);

    private static bool IsProjectReport(CreateWorkReportRequest request) =>
        string.Equals(request.ReportType, "project", StringComparison.OrdinalIgnoreCase);

    private static bool IsServiceCallReport(CreateWorkReportRequest request) =>
        string.Equals(request.ReportType, "service_call", StringComparison.OrdinalIgnoreCase);
}
